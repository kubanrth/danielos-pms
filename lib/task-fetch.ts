import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import type { TaskDetailProps } from "@/components/task/task-detail";

// Shared data loader for the task detail view (reused by standalone
// /w/[workspaceId]/t/[taskId] page AND the intercepting modal route).
export async function fetchTaskDetail(
  workspaceId: string,
  taskId: string,
): Promise<TaskDetailProps> {
  const ctx = await requireWorkspaceMembership(workspaceId);

  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    include: {
      board: {
        include: {
          statusColumns: { orderBy: { order: "asc" } },
        },
      },
      assignees: { select: { userId: true } },
      tags: { select: { tagId: true } },
    },
  });
  if (!task) notFound();

  const [members, tags] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.tag.findMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: null }], // workspace-local + global
      },
      orderBy: [{ workspaceId: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    }),
  ]);

  const descriptionValue =
    task.descriptionJson && typeof task.descriptionJson === "object" && "plain" in task.descriptionJson
      ? String((task.descriptionJson as { plain?: unknown }).plain ?? "")
      : "";

  return {
    workspaceId,
    role: ctx.role,
    task: {
      id: task.id,
      title: task.title,
      description: descriptionValue,
      statusColumnId: task.statusColumnId,
      startAt: task.startAt ? task.startAt.toISOString() : null,
      stopAt: task.stopAt ? task.stopAt.toISOString() : null,
    },
    statusColumns: task.board.statusColumns.map((c) => ({
      id: c.id,
      name: c.name,
      colorHex: c.colorHex,
    })),
    allMembers: members.map((m) => m.user),
    assigneeIds: new Set(task.assignees.map((a) => a.userId)),
    allTags: tags.map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex })),
    tagIds: new Set(task.tags.map((t) => t.tagId)),
    canEdit: can(ctx.role, "task.update"),
    canDelete: can(ctx.role, "task.delete"),
  };
}
