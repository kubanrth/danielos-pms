import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardTable, type CustomTableColumn } from "@/components/table/board-table";
import { CollapsibleColumnManager } from "@/components/table/collapsible-column-manager";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { BackgroundCustomizer } from "@/components/view/background-customizer";
import { BoardShell } from "@/components/view/board-shell";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";

export default async function BoardTablePage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      workspace: { select: { enabledViews: true } },
      statusColumns: { orderBy: { order: "asc" } },
      customColumns: { orderBy: { order: "asc" } },
      views: { where: { type: "TABLE" } },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
        include: {
          assignees: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          },
          tags: { include: { tag: true } },
          customValues: true,
        },
      },
    },
  });
  if (!board) notFound();

  const canEdit = can(ctx.role, "task.update");
  const canCreate = can(ctx.role, "task.create");
  const canManageBoard = can(ctx.role, "board.update");
  const canCustomize = can(ctx.role, "background.customize");

  const tableView = board.views[0];
  const background = (tableView?.background ?? null) as BackgroundConfig | null;
  const bgCss = backgroundToCss(background);
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  // Table view config: F8b added column order + hidden columns. Legacy
  // boards don't have these keys yet, in which case we fall back to defaults.
  const tableConfig = (tableView?.configJson ?? {}) as {
    columnOrder?: string[];
    hidden?: string[];
  };

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        active="table"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={board.id} />}
        actions={
          <>
            {canCustomize && (
              <BackgroundCustomizer
                workspaceId={workspaceId}
                boardId={board.id}
                viewType="TABLE"
                initial={background}
              />
            )}
            {canCreate && (
              <CreateTaskButton workspaceId={workspaceId} boardId={board.id} />
            )}
          </>
        }
      />

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
          customValues: Object.fromEntries(
            t.customValues.map((v) => [v.columnId, v.valueText ?? ""]),
          ),
        }))}
        canEdit={canEdit}
        canManagePrefs={canManageBoard}
        initialColumnOrder={Array.isArray(tableConfig.columnOrder) ? tableConfig.columnOrder : undefined}
        initialHiddenColumns={Array.isArray(tableConfig.hidden) ? tableConfig.hidden : undefined}
        customColumns={board.customColumns.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type as CustomTableColumn["type"],
          options: c.options,
        }))}
        members={memberships.map((m) => m.user)}
      />

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
    </BoardShell>
  );
}
