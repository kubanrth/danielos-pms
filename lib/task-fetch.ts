import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import type { TaskDetailProps } from "@/components/task/task-detail";
import type { RichTextDoc } from "@/components/task/rich-text-editor";

// Task.descriptionJson was historically stored as `{ plain: "text" }` (F1f).
// Now it holds ProseMirror doc JSON (F4a). Convert legacy entries on read so
// the editor renders them as a paragraph; otherwise pass through a valid doc;
// anything else collapses to null (empty editor).
function normalizeDescription(raw: unknown): RichTextDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { type?: unknown; plain?: unknown };
  if (obj.type === "doc") return raw as RichTextDoc;
  if (typeof obj.plain === "string" && obj.plain.length > 0) {
    return {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: obj.plain }] },
      ],
    };
  }
  return null;
}

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

  const [members, tags, comments, auditEntries] = await Promise.all([
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
    db.comment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.auditLog.findMany({
      where: { workspaceId, objectType: "Task", objectId: taskId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);

  return {
    workspaceId,
    role: ctx.role,
    task: {
      id: task.id,
      title: task.title,
      descriptionJson: normalizeDescription(task.descriptionJson),
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
    comments: comments.map((c) => ({
      id: c.id,
      author: c.author,
      bodyJson: (c.bodyJson as RichTextDoc | null) ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      isAuthor: c.authorId === ctx.userId,
    })),
    canComment: can(ctx.role, "task.comment"),
    canModerateComments: ctx.role === "ADMIN",
    currentUserId: ctx.userId,
    activity: auditEntries.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor,
      diff: (e.diff ?? null) as Record<string, unknown> | null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
