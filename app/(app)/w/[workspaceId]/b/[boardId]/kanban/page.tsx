import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { BackgroundCustomizer } from "@/components/view/background-customizer";
import { ViewSwitcher } from "@/components/view/view-switcher";
import { CollapsibleColumnManager } from "@/components/table/collapsible-column-manager";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";

export default async function BoardKanbanPage({
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
      views: { where: { type: "KANBAN" } },
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

  const canCreate = can(ctx.role, "task.create");
  const canManageBoard = can(ctx.role, "board.update");
  const canCustomize = can(ctx.role, "background.customize");
  const kanbanView = board.views[0];
  const background = (kanbanView?.background ?? null) as BackgroundConfig | null;
  const bgCss = backgroundToCss(background);

  return (
    <div
      className="relative -mx-8 -my-10 min-h-[calc(100dvh-14rem)] px-8 py-10 md:-mx-14 md:px-14"
      style={bgCss ? { background: bgCss } : undefined}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em]">
              {board.name}
            </h2>
            <ViewSwitcher workspaceId={workspaceId} boardId={board.id} active="kanban" />
          </div>
          <div className="flex items-center gap-2">
            {canCustomize && (
              <BackgroundCustomizer
                workspaceId={workspaceId}
                boardId={board.id}
                viewType="KANBAN"
                initial={background}
              />
            )}
            {canCreate && (
              <CreateTaskButton workspaceId={workspaceId} boardId={board.id} />
            )}
          </div>
        </div>

        {canManageBoard && (
          <CollapsibleColumnManager
            workspaceId={workspaceId}
            boardId={board.id}
            columns={board.statusColumns.map((c) => ({
              id: c.id,
              name: c.name,
              colorHex: c.colorHex,
            }))}
          />
        )}

        <KanbanBoard
          workspaceId={workspaceId}
          boardId={board.id}
          statusColumns={board.statusColumns.map((c) => ({
            id: c.id,
            name: c.name,
            colorHex: c.colorHex,
          }))}
          initialTasks={board.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            statusColumnId: t.statusColumnId,
            rowOrder: t.rowOrder,
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
        />
      </div>
    </div>
  );
}
