"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { assertCan, ForbiddenError } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import {
  createCommentSchema,
  deleteCommentSchema,
  updateCommentSchema,
} from "@/lib/schemas/comment";

type CreateFieldErrors = { bodyJson?: string };
type UpdateFieldErrors = { bodyJson?: string };

export type CreateCommentState =
  | { ok: true; commentId: string }
  | { ok: false; error?: string; fieldErrors?: CreateFieldErrors }
  | null;

export type UpdateCommentState =
  | { ok: true; commentId: string }
  | { ok: false; error?: string; fieldErrors?: UpdateFieldErrors }
  | null;

async function revalidateTaskRoutes(workspaceId: string, taskId: string) {
  revalidatePath(`/w/${workspaceId}/t/${taskId}`);
}

export async function createCommentAction(
  _prev: CreateCommentState,
  formData: FormData,
): Promise<CreateCommentState> {
  const parsed = createCommentSchema.safeParse({
    taskId: formData.get("taskId"),
    bodyJson: formData.get("bodyJson"),
  });
  if (!parsed.success) {
    const fe: CreateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "bodyJson") fe.bodyJson = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task || task.deletedAt) return { ok: false, error: "Zadanie nie istnieje." };

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.comment");

  const comment = await db.comment.create({
    data: {
      taskId: task.id,
      authorId: ctx.userId,
      bodyJson: parsed.data.bodyJson as Prisma.InputJsonValue,
    },
  });

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "comment.created",
    diff: { commentId: comment.id },
  });

  await revalidateTaskRoutes(task.workspaceId, task.id);
  return { ok: true, commentId: comment.id };
}

export async function updateCommentAction(
  _prev: UpdateCommentState,
  formData: FormData,
): Promise<UpdateCommentState> {
  const parsed = updateCommentSchema.safeParse({
    id: formData.get("id"),
    bodyJson: formData.get("bodyJson"),
  });
  if (!parsed.success) {
    const fe: UpdateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "bodyJson") fe.bodyJson = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const existing = await db.comment.findUnique({
    where: { id: parsed.data.id },
    include: { task: { select: { id: true, workspaceId: true } } },
  });
  if (!existing || existing.deletedAt) return { ok: false, error: "Komentarz nie istnieje." };

  const ctx = await requireWorkspaceMembership(existing.task.workspaceId);
  // Only the author may edit (admins can delete, not rewrite).
  if (existing.authorId !== ctx.userId) throw new ForbiddenError("task.comment");

  await db.comment.update({
    where: { id: existing.id },
    data: { bodyJson: parsed.data.bodyJson as Prisma.InputJsonValue },
  });

  await writeAudit({
    workspaceId: existing.task.workspaceId,
    objectType: "Task",
    objectId: existing.task.id,
    actorId: ctx.userId,
    action: "comment.updated",
    diff: { commentId: existing.id },
  });

  await revalidateTaskRoutes(existing.task.workspaceId, existing.task.id);
  return { ok: true, commentId: existing.id };
}

export async function deleteCommentAction(formData: FormData) {
  const parsed = deleteCommentSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const existing = await db.comment.findUnique({
    where: { id: parsed.data.id },
    include: { task: { select: { id: true, workspaceId: true } } },
  });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceMembership(existing.task.workspaceId);
  const canAct = existing.authorId === ctx.userId || ctx.role === "ADMIN";
  if (!canAct) throw new ForbiddenError("task.comment");
  // Sanity: admins still need the comment capability (future-proof: if we
  // ever strip it from ADMIN, this prevents silent privilege creep).
  assertCan(ctx.role, "task.comment");

  await db.comment.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    workspaceId: existing.task.workspaceId,
    objectType: "Task",
    objectId: existing.task.id,
    actorId: ctx.userId,
    action: "comment.deleted",
    diff: { commentId: existing.id },
  });

  await revalidateTaskRoutes(existing.task.workspaceId, existing.task.id);
}
