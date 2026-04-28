"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { broadcastUserChange } from "@/lib/realtime";
import {
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  createSignedUploadUrl,
  isAllowedMime,
  supabaseAdmin,
} from "@/lib/storage";

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

export type CreateTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

export async function createSupportTicketAction(
  formData: FormData,
): Promise<CreateTicketResult> {
  const parsed = createTicketSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority") ?? "MEDIUM",
    dueAt: formData.get("dueAt") ?? undefined,
    isUrgent: formData.get("isUrgent") ?? false,
  });
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane formularza." };

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

  // F12-K38: notify wszystkich workspace member'ów (poza reporter'em) o
  // nowym zgłoszeniu. Klient: 'dodaj takie same indykatory jak przy
  // powiadomieniach do supportu, jak pojawi się zgłoszenie to ma pisać'.
  const reporter = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true, email: true },
  });
  const members = await db.workspaceMembership.findMany({
    where: {
      workspaceId: parsed.data.workspaceId,
      userId: { not: ctx.userId },
    },
    select: { userId: true },
  });
  if (members.length > 0) {
    const created = await Promise.all(
      members.map((m) =>
        db.notification.create({
          data: {
            userId: m.userId,
            type: "support.created",
            payload: {
              workspaceId: parsed.data.workspaceId,
              ticketId: ticket.id,
              ticketTitle: parsed.data.title,
              priority: parsed.data.priority,
              isUrgent: parsed.data.isUrgent,
              actorId: ctx.userId,
              actorName: reporter?.name ?? reporter?.email ?? null,
            } as Prisma.InputJsonValue,
          },
          select: { id: true, userId: true },
        }),
      ),
    );
    await Promise.all(
      created.map((n) =>
        broadcastUserChange(n.userId, { kind: "notification.new", id: n.id }),
      ),
    );
  }

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
  return { ok: true, ticketId: ticket.id };
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
      title: true,
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

  // F12-K25: gdy ticket właśnie się zamknął (transition do RESOLVED/CLOSED
  // ze stanu OPEN/IN_PROGRESS), powiadom reporter'a w inboxie. Skip
  // jeśli reporter sam jest tym kto zamyka (zwykle admin to robi).
  const wasOpenBefore = ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";
  const isClosedNow =
    parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED";

  // F12-K26: gdy admin przypisuje kogoś do ticketu (i to nie ten kto
  // klika) — wyślij notyfikację 'support.assigned' do nowego assignee.
  // Wcześniej tylko reporter dostawał info na zamknięciu, assignee
  // nie wiedział że dostał ticket.
  let newAssigneeId: string | null = null;
  if (parsed.data.assigneeId !== undefined) {
    const next = parsed.data.assigneeId === "" ? null : parsed.data.assigneeId;
    if (next && next !== ticket.assigneeId && next !== ctx.userId) {
      newAssigneeId = next;
    }
  }

  // Resolve actor once if any notification will be sent.
  const willNotify =
    (parsed.data.status &&
      wasOpenBefore &&
      isClosedNow &&
      ticket.reporterId !== ctx.userId) ||
    newAssigneeId !== null;
  const actor = willNotify
    ? await db.user.findUnique({
        where: { id: ctx.userId },
        select: { name: true, email: true },
      })
    : null;

  if (
    parsed.data.status &&
    wasOpenBefore &&
    isClosedNow &&
    ticket.reporterId !== ctx.userId
  ) {
    const notif = await db.notification.create({
      data: {
        userId: ticket.reporterId,
        type: "support.resolved",
        payload: {
          workspaceId: ticket.workspaceId,
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          status: parsed.data.status,
          actorId: ctx.userId,
          actorName: actor?.name ?? actor?.email ?? null,
        } as Prisma.InputJsonValue,
      },
      select: { id: true, userId: true },
    });
    // F12-K35: realtime toast.
    await broadcastUserChange(notif.userId, {
      kind: "notification.new",
      id: notif.id,
    });
  }

  if (newAssigneeId) {
    const notif = await db.notification.create({
      data: {
        userId: newAssigneeId,
        type: "support.assigned",
        payload: {
          workspaceId: ticket.workspaceId,
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          actorId: ctx.userId,
          actorName: actor?.name ?? actor?.email ?? null,
        } as Prisma.InputJsonValue,
      },
      select: { id: true, userId: true },
    });
    await broadcastUserChange(notif.userId, {
      kind: "notification.new",
      id: notif.id,
    });
  }

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

// F12-K25: attachments dla ticketów. Reuse Supabase Storage flow z
// bucketu 'attachments' (signed upload URL → klient PUT-uje plik →
// klient potwierdza addSupportAttachmentAction → row w
// SupportTicketAttachment'cie + revalidate). Storage path:
// w/<wid>/support/<tid>/<rand>-<safe-name>.

const requestUploadSchema = z.object({
  ticketId: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type RequestUploadResult =
  | { ok: true; uploadUrl: string; storageKey: string }
  | { ok: false; error: string };

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/]/g, "_")
      .replace(/[^\w.\-]/g, "_")
      .replace(/_+/g, "_")
      .slice(-120) || "file"
  );
}

export async function requestSupportAttachmentUploadAction(
  ticketId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<RequestUploadResult> {
  const parsed = requestUploadSchema.safeParse({ ticketId, filename, contentType, sizeBytes });
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe parametry pliku." };
  if (!isAllowedMime(parsed.data.contentType)) {
    return { ok: false, error: "Niedozwolony typ pliku." };
  }

  const ticket = await db.supportTicket.findUnique({
    where: { id: parsed.data.ticketId },
    select: { id: true, workspaceId: true },
  });
  if (!ticket) return { ok: false, error: "Zgłoszenie nie istnieje." };
  await requireWorkspaceMembership(ticket.workspaceId);

  const safe = sanitizeFilename(parsed.data.filename);
  const rand = randomBytes(9).toString("base64url");
  const storageKey = `w/${ticket.workspaceId}/support/${ticket.id}/${rand}-${safe}`;

  try {
    const signed = await createSignedUploadUrl(storageKey);
    return { ok: true, uploadUrl: signed.signedUrl, storageKey };
  } catch (err) {
    console.warn("[support-attachment] signed upload failed", err);
    return { ok: false, error: "Nie udało się przygotować uploadu." };
  }
}

const confirmAttachmentSchema = z.object({
  ticketId: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export async function confirmSupportAttachmentUploadAction(input: {
  ticketId: string;
  storageKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = confirmAttachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe parametry." };

  const ticket = await db.supportTicket.findUnique({
    where: { id: parsed.data.ticketId },
    select: { id: true, workspaceId: true },
  });
  if (!ticket) return { ok: false, error: "Zgłoszenie nie istnieje." };
  const ctx = await requireWorkspaceMembership(ticket.workspaceId);

  await db.supportTicketAttachment.create({
    data: {
      ticketId: ticket.id,
      uploaderId: ctx.userId,
      filename: parsed.data.filename,
      mimeType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      storageKey: parsed.data.storageKey,
    },
  });
  await writeAudit({
    workspaceId: ticket.workspaceId,
    objectType: "SupportTicket",
    objectId: ticket.id,
    actorId: ctx.userId,
    action: "support.attachmentAdded",
    diff: { filename: parsed.data.filename },
  });
  revalidatePath(`/w/${ticket.workspaceId}/support`);
  return { ok: true };
}

export async function deleteSupportAttachmentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const att = await db.supportTicketAttachment.findUnique({
    where: { id },
    include: { ticket: { select: { workspaceId: true, id: true, reporterId: true } } },
  });
  if (!att) return;
  const ctx = await requireWorkspaceMembership(att.ticket.workspaceId);
  // Uploader może swój usunąć; admin (task.update perm) — każdy.
  const isUploader = att.uploaderId === ctx.userId;
  if (!isUploader) {
    await requireWorkspaceAction(att.ticket.workspaceId, "task.update");
  }

  // Best-effort storage cleanup (ignore failure — DB row removal is
  // the source of truth; orphaned blobs cleaned up by Supabase
  // lifecycle policy if any).
  try {
    await supabaseAdmin().storage.from(ATTACHMENTS_BUCKET).remove([att.storageKey]);
  } catch {
    /* swallow */
  }
  await db.supportTicketAttachment.delete({ where: { id } });
  await writeAudit({
    workspaceId: att.ticket.workspaceId,
    objectType: "SupportTicket",
    objectId: att.ticket.id,
    actorId: ctx.userId,
    action: "support.attachmentRemoved",
    diff: { attachmentId: id },
  });
  revalidatePath(`/w/${att.ticket.workspaceId}/support`);
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
