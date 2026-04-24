"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

const workspaceFromTask = async (taskId: string) =>
  db.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });

const createSubtaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
});

export async function createSubtaskAction(formData: FormData) {
  const parsed = createSubtaskSchema.safeParse({
    taskId: formData.get("taskId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return;

  const ownership = await workspaceFromTask(parsed.data.taskId);
  if (!ownership) return;
  const ctx = await requireWorkspaceAction(ownership.workspaceId, "subtask.manage");

  const last = await db.subtask.findFirst({
    where: { taskId: parsed.data.taskId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const sub = await db.subtask.create({
    data: {
      taskId: parsed.data.taskId,
      title: parsed.data.title,
      order: nextOrder,
    },
  });

  await writeAudit({
    workspaceId: ownership.workspaceId,
    objectType: "Task",
    objectId: parsed.data.taskId,
    actorId: ctx.userId,
    action: "subtask.created",
    diff: { id: sub.id, title: sub.title },
  });

  revalidatePath(`/w/${ownership.workspaceId}/t/${parsed.data.taskId}`);
}

const toggleSchema = z.object({
  subtaskId: z.string().min(1),
  completed: z.enum(["true", "false"]),
});

export async function toggleSubtaskAction(formData: FormData) {
  const parsed = toggleSchema.safeParse({
    subtaskId: formData.get("subtaskId"),
    completed: formData.get("completed"),
  });
  if (!parsed.success) return;

  const sub = await db.subtask.findUnique({
    where: { id: parsed.data.subtaskId },
    select: { taskId: true, task: { select: { workspaceId: true } } },
  });
  if (!sub) return;

  const ctx = await requireWorkspaceAction(sub.task.workspaceId, "subtask.manage");
  const next = parsed.data.completed === "true";
  await db.subtask.update({
    where: { id: parsed.data.subtaskId },
    data: { completed: next },
  });

  await writeAudit({
    workspaceId: sub.task.workspaceId,
    objectType: "Task",
    objectId: sub.taskId,
    actorId: ctx.userId,
    action: next ? "subtask.completed" : "subtask.reopened",
    diff: { subtaskId: parsed.data.subtaskId },
  });
  revalidatePath(`/w/${sub.task.workspaceId}/t/${sub.taskId}`);
}

const deleteSchema = z.object({ subtaskId: z.string().min(1) });

export async function deleteSubtaskAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ subtaskId: formData.get("subtaskId") });
  if (!parsed.success) return;

  const sub = await db.subtask.findUnique({
    where: { id: parsed.data.subtaskId },
    select: { taskId: true, title: true, task: { select: { workspaceId: true } } },
  });
  if (!sub) return;

  const ctx = await requireWorkspaceAction(sub.task.workspaceId, "subtask.manage");
  await db.subtask.delete({ where: { id: parsed.data.subtaskId } });

  await writeAudit({
    workspaceId: sub.task.workspaceId,
    objectType: "Task",
    objectId: sub.taskId,
    actorId: ctx.userId,
    action: "subtask.deleted",
    diff: { title: sub.title },
  });
  revalidatePath(`/w/${sub.task.workspaceId}/t/${sub.taskId}`);
}
