import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardTable } from "@/components/table/board-table";
import { StatusColumnManager } from "@/components/table/status-column-manager";
import { CreateTaskButton } from "@/components/task/create-task-button";

export default async function BoardTablePage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      statusColumns: { orderBy: { order: "asc" } },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
        include: {
          assignees: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          },
          tags: { include: { tag: true } },
        },
      },
    },
  });
  if (!board) notFound();

  const canEdit = can(ctx.role, "task.update");
  const canCreate = can(ctx.role, "task.create");
  const canManageBoard = can(ctx.role, "board.update");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Widok tabeli</span>
          <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em]">
            {board.name}
          </h2>
          {board.description && (
            <p className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              {board.description}
            </p>
          )}
        </div>
        {canCreate && (
          <CreateTaskButton workspaceId={workspaceId} boardId={board.id} />
        )}
      </div>

      <BoardTable
        workspaceId={workspaceId}
        boardId={board.id}
        statusColumns={board.statusColumns.map((c) => ({
          id: c.id,
          name: c.name,
          colorHex: c.colorHex,
        }))}
        tasks={board.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          statusColumnId: t.statusColumnId,
          startAt: t.startAt ? t.startAt.toISOString() : null,
          stopAt: t.stopAt ? t.stopAt.toISOString() : null,
          assignees: t.assignees.map((a) => ({
            id: a.userId,
            name: a.user.name,
            email: a.user.email,
            avatarUrl: a.user.avatarUrl,
          })),
          tags: t.tags.map((tt) => ({
            id: tt.tag.id,
            name: tt.tag.name,
            colorHex: tt.tag.colorHex,
          })),
        }))}
        canEdit={canEdit}
      />

      {canManageBoard && (
        <StatusColumnManager
          workspaceId={workspaceId}
          boardId={board.id}
          columns={board.statusColumns.map((c) => ({
            id: c.id,
            name: c.name,
            colorHex: c.colorHex,
          }))}
        />
      )}
    </div>
  );
}
