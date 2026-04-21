"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { broadcastWorkspaceChange } from "@/lib/realtime";
import { writeAudit } from "@/lib/audit";
import {
  createTagSchema,
  createTaskSchema,
  toggleAssigneeSchema,
  toggleTagSchema,
  updateTaskSchema,
} from "@/lib/schemas/task";

type CreateFieldErrors = { title?: string };
type UpdateFieldErrors = {
  title?: string;
  descriptionJson?: string;
  statusColumnId?: string;
  startAt?: string;
  stopAt?: string;
};

export type CreateTaskState =
  | { ok: true; taskId: string }
  | { ok: false; error?: string; fieldErrors?: CreateFieldErrors }
  | null;

export type UpdateTaskState =
  | { ok: true; message: string }
  | { ok: false; error?: string; fieldErrors?: UpdateFieldErrors }
  | null;

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createTaskAction(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const parsed = createTaskSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    const fe: CreateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "title") fe.title = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "task.create");

  // Use the first status column as default (Do zrobienia).
  const firstColumn = await db.statusColumn.findFirst({
    where: { boardId: parsed.data.boardId },
    orderBy: { order: "asc" },
  });

  // Compute next rowOrder — last-in-column + 1 (or 1 if empty).
  const lastTask = firstColumn
    ? await db.task.findFirst({
        where: { statusColumnId: firstColumn.id, deletedAt: null },
        orderBy: { rowOrder: "desc" },
      })
    : null;

  const task = await db.task.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      boardId: parsed.data.boardId,
      statusColumnId: firstColumn?.id,
      creatorId: ctx.userId,
      title: parsed.data.title,
      rowOrder: (lastTask?.rowOrder ?? 0) + 1,
    },
  });

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.created",
    diff: { title: task.title },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
    boardId: task.boardId,
  });
  return { ok: true, taskId: task.id };
}

export async function updateTaskAction(
  _prev: UpdateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  const parsed = updateTaskSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    descriptionJson: formData.get("descriptionJson"),
    statusColumnId: formData.get("statusColumnId"),
    startAt: formData.get("startAt"),
    stopAt: formData.get("stopAt"),
  });

  if (!parsed.success) {
    const fe: UpdateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "title" || k === "descriptionJson" || k === "statusColumnId" || k === "startAt" || k === "stopAt")
        fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const existing = await db.task.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { ok: false, error: "Zadanie nie istnieje." };

  const ctx = await requireWorkspaceAction(existing.workspaceId, "task.update");

  const updated = await db.task.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      descriptionJson: parsed.data.descriptionJson
        ? (parsed.data.descriptionJson as Prisma.InputJsonValue)
        : Prisma.DbNull,
      statusColumnId: parsed.data.statusColumnId || null,
      startAt: parseDate(formData.get("startAt")),
      stopAt: parseDate(formData.get("stopAt")),
      version: { increment: 1 },
    },
  });

  await writeAudit({
    workspaceId: updated.workspaceId,
    objectType: "Task",
    objectId: updated.id,
    actorId: ctx.userId,
    action: "task.updated",
    diff: { title: updated.title },
  });

  revalidatePath(`/w/${updated.workspaceId}`);
  revalidatePath(`/w/${updated.workspaceId}/t/${updated.id}`);
  await broadcastWorkspaceChange(updated.workspaceId, {
    type: "task.changed",
    taskId: updated.id,
    boardId: updated.boardId,
  });
  return { ok: true, message: "Zapisano." };
}

export async function deleteTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!id || !workspaceId) return;
  const ctx = await requireWorkspaceAction(workspaceId, "task.delete");

  await db.task.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    workspaceId,
    objectType: "Task",
    objectId: id,
    actorId: ctx.userId,
    action: "task.deleted",
  });
  revalidatePath(`/w/${workspaceId}`);
  await broadcastWorkspaceChange(workspaceId, { type: "task.changed", taskId: id });
  redirect(`/w/${workspaceId}`);
}

// Small-field patches used by the Table view's inline-edit cells.
// Unlike updateTaskAction, this updates only the fields present in
// the FormData, so a click-to-edit title or a status dropdown can
// each fire their own action without round-tripping the whole task.
export async function patchTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) return;
  const ctx = await requireWorkspaceAction(existing.workspaceId, "task.update");

  const data: Record<string, unknown> = {};
  const keys = ["title", "statusColumnId", "startAt", "stopAt", "rowOrder"] as const;
  let hasChange = false;

  for (const k of keys) {
    const raw = formData.get(k);
    if (raw === null) continue;
    if (k === "title") {
      const v = String(raw).trim();
      if (v.length === 0 || v.length > 200) continue;
      data.title = v;
      hasChange = true;
    } else if (k === "statusColumnId") {
      const v = String(raw);
      data.statusColumnId = v === "" ? null : v;
      hasChange = true;
    } else if (k === "startAt" || k === "stopAt") {
      data[k] = parseDate(raw);
      hasChange = true;
    } else if (k === "rowOrder") {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      data.rowOrder = n;
      hasChange = true;
    }
  }

  if (!hasChange) return;

  const updated = await db.task.update({
    where: { id },
    data: { ...data, version: { increment: 1 } },
  });

  await writeAudit({
    workspaceId: updated.workspaceId,
    objectType: "Task",
    objectId: updated.id,
    actorId: ctx.userId,
    action: "task.patched",
    diff: data as Prisma.InputJsonValue,
  });

  revalidatePath(`/w/${updated.workspaceId}`);
  revalidatePath(`/w/${updated.workspaceId}/b/${updated.boardId}/table`);
  revalidatePath(`/w/${updated.workspaceId}/b/${updated.boardId}/kanban`);
  revalidatePath(`/w/${updated.workspaceId}/t/${updated.id}`);
  await broadcastWorkspaceChange(updated.workspaceId, {
    type: "task.changed",
    taskId: updated.id,
    boardId: updated.boardId,
  });
}

export async function toggleAssigneeAction(formData: FormData) {
  const parsed = toggleAssigneeSchema.safeParse({
    taskId: formData.get("taskId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return;

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return;

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.assignUsers");

  // Assignee must be a member of the workspace.
  const membership = await db.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: { workspaceId: task.workspaceId, userId: parsed.data.userId },
    },
  });
  if (!membership) return;

  const existing = await db.taskAssignee.findUnique({
    where: { taskId_userId: { taskId: parsed.data.taskId, userId: parsed.data.userId } },
  });

  if (existing) {
    await db.taskAssignee.delete({
      where: { taskId_userId: { taskId: parsed.data.taskId, userId: parsed.data.userId } },
    });
  } else {
    await db.taskAssignee.create({
      data: { taskId: parsed.data.taskId, userId: parsed.data.userId },
    });
  }

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: existing ? "task.assigneeRemoved" : "task.assigneeAdded",
    diff: { userId: parsed.data.userId },
  });

  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  revalidatePath(`/w/${task.workspaceId}/b/${task.boardId}/table`);
  revalidatePath(`/w/${task.workspaceId}/b/${task.boardId}/kanban`);
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
    boardId: task.boardId,
  });
}

export async function toggleTagAction(formData: FormData) {
  const parsed = toggleTagSchema.safeParse({
    taskId: formData.get("taskId"),
    tagId: formData.get("tagId"),
  });
  if (!parsed.success) return;

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return;

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  const existing = await db.taskTag.findUnique({
    where: { taskId_tagId: { taskId: parsed.data.taskId, tagId: parsed.data.tagId } },
  });

  if (existing) {
    await db.taskTag.delete({
      where: { taskId_tagId: { taskId: parsed.data.taskId, tagId: parsed.data.tagId } },
    });
  } else {
    await db.taskTag.create({
      data: { taskId: parsed.data.taskId, tagId: parsed.data.tagId },
    });
  }

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: existing ? "task.tagRemoved" : "task.tagAdded",
    diff: { tagId: parsed.data.tagId },
  });

  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  revalidatePath(`/w/${task.workspaceId}/b/${task.boardId}/table`);
  revalidatePath(`/w/${task.workspaceId}/b/${task.boardId}/kanban`);
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
    boardId: task.boardId,
  });
}

export async function createTagAction(formData: FormData) {
  const parsed = createTagSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    colorHex: formData.get("colorHex"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "tag.manage");

  await db.tag.upsert({
    where: {
      workspaceId_name: { workspaceId: parsed.data.workspaceId, name: parsed.data.name },
    },
    update: { colorHex: parsed.data.colorHex },
    create: {
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      colorHex: parsed.data.colorHex,
      creatorId: ctx.userId,
    },
  });
  revalidatePath(`/w/${parsed.data.workspaceId}`);
}
