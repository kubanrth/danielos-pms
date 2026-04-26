"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

// F11-21 (#25): Creative brief CRUD. Tworzenie wymaga membership;
// edycja/usuwanie creator + admin (task.update perm).

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
});

const TEMPLATE_DOC = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "🎯 Cel projektu" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Co chcemy osiągnąć? Jakim biznesowym problem rozwiązuje ten projekt?" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "👥 Grupa docelowa" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Kto jest odbiorcą? Persony, segmenty, key user types." }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "📦 Deliverables" }],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Materiał 1" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Materiał 2" }] }] },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "🎨 Brand guidelines" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Kolory, fonty, ton wypowiedzi, tabu." }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "🔗 Referencje" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Linki do inspiracji, konkurencji, mood-boardów." }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "📅 Timeline" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Kluczowe milestones, deadline finalny, kto zatwierdza." }] },
  ],
};

export async function createBriefAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);

  const brief = await db.creativeBrief.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      creatorId: ctx.userId,
      title: parsed.data.title,
      contentJson: TEMPLATE_DOC as Prisma.InputJsonValue,
    },
  });
  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Workspace",
    objectId: parsed.data.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.created",
    diff: { briefId: brief.id, title: parsed.data.title },
  });
  redirect(`/w/${parsed.data.workspaceId}/briefs/${brief.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  contentJson: z.string().max(200_000).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"]).optional(),
  emoji: z.string().max(8).optional(),
  headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function updateBriefAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    contentJson: formData.get("contentJson") ?? undefined,
    status: formData.get("status") ?? undefined,
    emoji: formData.get("emoji") ?? undefined,
    headerColor: formData.get("headerColor") ?? undefined,
  });
  if (!parsed.success) return;

  const brief = await db.creativeBrief.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, workspaceId: true, creatorId: true },
  });
  if (!brief) return;
  // Creator can update own; admins (task.update) can update any.
  const ctx = await requireWorkspaceAction(brief.workspaceId, "task.update");

  const data: Prisma.CreativeBriefUncheckedUpdateInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.contentJson !== undefined && parsed.data.contentJson !== "") {
    try {
      const doc = JSON.parse(parsed.data.contentJson);
      if (doc && typeof doc === "object") data.contentJson = doc as Prisma.InputJsonValue;
    } catch {
      /* skip */
    }
  }
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.emoji !== undefined) data.emoji = parsed.data.emoji || null;
  if (parsed.data.headerColor !== undefined) data.headerColor = parsed.data.headerColor;

  if (Object.keys(data).length === 0) return;

  await db.creativeBrief.update({ where: { id: brief.id }, data });
  await writeAudit({
    workspaceId: brief.workspaceId,
    objectType: "Workspace",
    objectId: brief.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.updated",
    diff: { briefId: brief.id, fields: Object.keys(data) },
  });
  revalidatePath(`/w/${brief.workspaceId}/briefs/${brief.id}`);
  revalidatePath(`/w/${brief.workspaceId}/briefs`);
}

export async function deleteBriefAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const brief = await db.creativeBrief.findUnique({
    where: { id },
    select: { id: true, workspaceId: true },
  });
  if (!brief) return;
  const ctx = await requireWorkspaceAction(brief.workspaceId, "task.update");

  await db.creativeBrief.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId: brief.workspaceId,
    objectType: "Workspace",
    objectId: brief.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.deleted",
    diff: { briefId: id },
  });
  redirect(`/w/${brief.workspaceId}/briefs`);
}
