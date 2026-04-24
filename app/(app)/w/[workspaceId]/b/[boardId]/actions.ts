"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  createStatusColumnSchema,
  deleteStatusColumnSchema,
  renameBoardSchema,
  reorderStatusColumnsSchema,
  updateStatusColumnSchema,
} from "@/lib/schemas/board";
import { backgroundSchema, updateBackgroundSchema } from "@/lib/schemas/background";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

const NICE_COLORS = [
  "#64748B",
  "#F59E0B",
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#14B8A6",
];

export async function renameBoardAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = renameBoardSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");
  const board = await db.board.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: board.id,
    actorId: ctx.userId,
    action: "board.renamed",
    diff: { name: board.name },
  });
  revalidatePath(`/w/${workspaceId}`);
  revalidatePath(`/w/${workspaceId}/b/${board.id}/table`);
}

export async function createStatusColumnAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = createStatusColumnSchema.safeParse({
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    colorHex: formData.get("colorHex") || undefined,
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");

  const count = await db.statusColumn.count({ where: { boardId: parsed.data.boardId } });
  const color = parsed.data.colorHex || NICE_COLORS[count % NICE_COLORS.length];

  const col = await db.statusColumn.create({
    data: {
      boardId: parsed.data.boardId,
      name: parsed.data.name,
      colorHex: color,
      order: count,
    },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "board.statusColumnCreated",
    diff: { name: col.name },
  });
  revalidatePath(`/w/${workspaceId}/b/${parsed.data.boardId}/table`);
}

export async function updateStatusColumnAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = updateStatusColumnSchema.safeParse({
    columnId: formData.get("columnId"),
    name: formData.get("name"),
    colorHex: formData.get("colorHex"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");

  const col = await db.statusColumn.update({
    where: { id: parsed.data.columnId },
    data: { name: parsed.data.name, colorHex: parsed.data.colorHex },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: col.boardId,
    actorId: ctx.userId,
    action: "board.statusColumnUpdated",
    diff: { name: col.name },
  });
  revalidatePath(`/w/${workspaceId}/b/${col.boardId}/table`);
}

export async function deleteStatusColumnAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = deleteStatusColumnSchema.safeParse({
    columnId: formData.get("columnId"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");

  const col = await db.statusColumn.findUnique({ where: { id: parsed.data.columnId } });
  if (!col) return;

  // Move all tasks in this column to "no status" (null).
  await db.$transaction([
    db.task.updateMany({
      where: { statusColumnId: parsed.data.columnId },
      data: { statusColumnId: null },
    }),
    db.statusColumn.delete({ where: { id: parsed.data.columnId } }),
  ]);

  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: col.boardId,
    actorId: ctx.userId,
    action: "board.statusColumnDeleted",
    diff: { name: col.name },
  });
  revalidatePath(`/w/${workspaceId}/b/${col.boardId}/table`);
}

// BoardView background — "ikona pędzla" per-view customization (color /
// gradient / image URL). Persists on BoardView.background as JSON.
export async function updateBackgroundAction(formData: FormData) {
  const parsedMeta = updateBackgroundSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    viewType: formData.get("viewType"),
    payload: formData.get("payload"),
  });
  if (!parsedMeta.success) return;

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(parsedMeta.data.payload);
  } catch {
    return;
  }
  const parsed = backgroundSchema.safeParse(parsedPayload);
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(
    parsedMeta.data.workspaceId,
    "background.customize",
  );

  // F8 dropped the @@unique([boardId, type]) index so a board can host
  // multiple views of the same type (custom views). The "default" view
  // for each type is the one with name = null, so we target that here.
  const bg = parsed.data === null ? Prisma.DbNull : (parsed.data as Prisma.InputJsonValue);
  const existing = await db.boardView.findFirst({
    where: {
      boardId: parsedMeta.data.boardId,
      type: parsedMeta.data.viewType,
      name: null,
    },
    select: { id: true },
  });
  if (existing) {
    await db.boardView.update({
      where: { id: existing.id },
      data: { background: bg },
    });
  } else {
    await db.boardView.create({
      data: {
        boardId: parsedMeta.data.boardId,
        type: parsedMeta.data.viewType,
        background: bg,
      },
    });
  }

  await writeAudit({
    workspaceId: parsedMeta.data.workspaceId,
    objectType: "Board",
    objectId: parsedMeta.data.boardId,
    actorId: ctx.userId,
    action: "board.backgroundCustomized",
    diff: { viewType: parsedMeta.data.viewType, kind: (parsed.data ?? { kind: "none" }).kind },
  });

  revalidatePath(`/w/${parsedMeta.data.workspaceId}/b/${parsedMeta.data.boardId}/table`);
}

export async function reorderStatusColumnsAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const rawIds = formData.get("ids");
  const parsed = reorderStatusColumnsSchema.safeParse({
    boardId: formData.get("boardId"),
    ids: typeof rawIds === "string" ? rawIds.split(",").filter(Boolean) : [],
  });
  if (!parsed.success) return;
  await requireWorkspaceAction(workspaceId, "board.update");

  await db.$transaction(
    parsed.data.ids.map((id, idx) =>
      db.statusColumn.update({ where: { id }, data: { order: idx } }),
    ),
  );
  revalidatePath(`/w/${workspaceId}/b/${parsed.data.boardId}/table`);
}
