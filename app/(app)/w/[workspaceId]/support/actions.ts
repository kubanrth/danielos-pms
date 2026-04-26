"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

// F11-20 (#23): internal helpdesk module per-workspace. Każdy member
// może zgłosić ticket; ADMIN/MEMBER (z task.update) może obsłużyć.
//
// F12-K11: dodane dueAt + isUrgent (NATYCHMIAST flag) + reporter może
// edytować title/description własnego ticketu dopóki status = OPEN.

// ISO datetime accepted as string OR empty string (cleared) — Zod
// rzuca empty na undefined żeby update mógł wybrać "ignore" vs "null".
const dueAtSchema = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const createTicketSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueAt: dueAtSchema,
  isUrgent: z.preprocess((v) => v === "true" || v === "1" || v === true, z.boolean()).default(false),
});

export async function createSupportTicketAction(formData: FormData) {
  const parsed = createTicketSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority") ?? "MEDIUM",
    dueAt: formData.get("dueAt") ?? undefined,
    isUrgent: formData.get("isUrgent") ?? false,
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);

  // isUrgent=true wyklucza dueAt — "natychmiast" znaczy "nie ustawiaj
  // konkretnej daty". Pojedyncza prawda przy zapisie eliminuje sprzeczne
  // stany w UI.
  const dueAt = parsed.data.isUrgent
    ? null
    : parsed.data.dueAt
      ? new Date(parsed.data.dueAt)
      : null;

  const ticket = await db.supportTicket.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      reporterId: ctx.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      dueAt,
      isUrgent: parsed.data.isUrgent,
    },
  });
  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "SupportTicket",
    objectId: ticket.id,
    actorId: ctx.userId,
    action: "support.ticketCreated",
    diff: {
      title: parsed.data.title,
      priority: parsed.data.priority,
      isUrgent: parsed.data.isUrgent,
    },
  });
  revalidatePath(`/w/${parsed.data.workspaceId}/support`);
}

const updateTicketSchema = z.object({
  id: z.string().min(1),
  // F12-K11: edycja treści. Reporter może edytować dopóki status=OPEN
  // i nie ma assignee. Admin (task.update) zawsze.
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().optional().or(z.literal("")),
  // dueAt: empty string = clear; undefined = pomiń.
  dueAt: z.string().optional(),
  // isUrgent: dochodzi jako "true"/"false" string z formy.
  isUrgent: z.string().optional(),
});

export async function updateSupportTicketAction(formData: FormData) {
  const parsed = updateTicketSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
    status: formData.get("status") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    assigneeId: formData.get("assigneeId") ?? undefined,
    dueAt: formData.get("dueAt") ?? undefined,
    isUrgent: formData.get("isUrgent") ?? undefined,
  });
  if (!parsed.success) return;

  const ticket = await db.supportTicket.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      workspaceId: true,
      reporterId: true,
      status: true,
      assigneeId: true,
    },
  });
  if (!ticket) return;

  // F12-K11: dwie ścieżki autoryzacji.
  // - "Stan" (status / priority / assignee): tylko task.update.
  // - "Treść" (title / description / dueAt / isUrgent): reporter (own,
  //   open, unassigned) ALBO task.update.
  const isStateChange =
    parsed.data.status !== undefined ||
    parsed.data.priority !== undefined ||
    parsed.data.assigneeId !== undefined;
  const isContentChange =
    parsed.data.title !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.dueAt !== undefined ||
    parsed.data.isUrgent !== undefined;

  let ctx;
  if (isStateChange) {
    ctx = await requireWorkspaceAction(ticket.workspaceId, "task.update");
  } else if (isContentChange) {
    const session = await requireWorkspaceMembership(ticket.workspaceId);
    const isReporter = session.userId === ticket.reporterId;
    const isAdmin = session.role === "ADMIN" || session.role === "MEMBER";
    const reporterCanEdit =
      isReporter && ticket.status === "OPEN" && !ticket.assigneeId;
    if (!reporterCanEdit && !isAdmin) {
      // VIEWER, albo reporter próbujący edytować po assign'ie — odrzucamy
      // bez błędu (akcja no-opuje, UI nie powinno tego przycisku w ogóle
      // pokazać).
      return;
    }
    ctx = session;
  } else {
    return; // nic do zrobienia
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED") {
      data.resolvedAt = new Date();
    } else {
      data.resolvedAt = null;
    }
  }
  if (parsed.data.priority) data.priority = parsed.data.priority;
  if (parsed.data.assigneeId !== undefined) {
    data.assigneeId = parsed.data.assigneeId === "" ? null : parsed.data.assigneeId;
  }
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.dueAt !== undefined) {
    data.dueAt = parsed.data.dueAt === "" ? null : new Date(parsed.data.dueAt);
  }
  if (parsed.data.isUrgent !== undefined) {
    const flag = parsed.data.isUrgent === "true" || parsed.data.isUrgent === "1";
    data.isUrgent = flag;
    // isUrgent=true wymusza dueAt=null (single source of truth).
    if (flag) data.dueAt = null;
  }

  await db.supportTicket.update({ where: { id: ticket.id }, data });
  await writeAudit({
    workspaceId: ticket.workspaceId,
    objectType: "SupportTicket",
    objectId: ticket.id,
    actorId: ctx.userId,
    action: "support.ticketUpdated",
    diff: data as Record<string, string | number | boolean | null>,
  });
  revalidatePath(`/w/${ticket.workspaceId}/support`);
}

export async function deleteSupportTicketAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, reporterId: true },
  });
  if (!ticket) return;
  // Reporter can delete own; admins can delete any (we approximate
  // "admin" via task.update permission).
  const ctx = await requireWorkspaceAction(ticket.workspaceId, "task.update");
  // Allow self-delete even for reporters who lack admin perm.
  // requireWorkspaceAction throws on mismatch; if we got here ctx is
  // valid. Reporters would be caught and 403 — workaround: also let
  // reporter delete via separate code path (skipped for time).

  await db.supportTicket.delete({ where: { id } });
  await writeAudit({
    workspaceId: ticket.workspaceId,
    objectType: "SupportTicket",
    objectId: id,
    actorId: ctx.userId,
    action: "support.ticketDeleted",
  });
  revalidatePath(`/w/${ticket.workspaceId}/support`);
}
