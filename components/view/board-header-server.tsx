import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardHeader } from "@/components/view/board-header";
import type { CustomViewDescriptor } from "@/components/view/view-switcher";
import { viewTypeToName, type ViewName } from "@/lib/board-views";
import { CreateViewDialog } from "@/components/view/create-view-dialog";

// Server wrapper that hydrates BoardHeader with custom views from the DB
// and appends the `+ Widok` create button. Use this from every board page
// instead of BoardHeader directly — keeps the fetch close to the render.
export async function BoardHeaderServer({
  workspaceId,
  boardId,
  board,
  active,
  activeViewId,
  enabledViews,
  actions,
  extra,
}: {
  workspaceId: string;
  boardId: string;
  board: { name: string; description?: string | null };
  active?: ViewName;
  activeViewId?: string;
  enabledViews: ViewName[];
  actions?: ReactNode;
  extra?: ReactNode;
}) {
  const ctx = await requireWorkspaceMembership(workspaceId);
  const canManage = can(ctx.role, "board.update");

  const custom = await db.boardView.findMany({
    where: {
      boardId,
      name: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });

  const customViews: CustomViewDescriptor[] = custom.map((v) => ({
    id: v.id,
    name: v.name ?? "Widok",
    type: viewTypeToName(v.type) ?? "table",
    path: `/w/${workspaceId}/b/${boardId}/v/${v.id}`,
  }));

  return (
    <BoardHeader
      workspaceId={workspaceId}
      boardId={boardId}
      board={board}
      active={active}
      activeViewId={activeViewId}
      enabledViews={enabledViews}
      customViews={customViews}
      canManageViews={canManage}
      createViewButton={
        canManage ? (
          <CreateViewDialog
            workspaceId={workspaceId}
            boardId={boardId}
            enabled={enabledViews}
          />
        ) : null
      }
      actions={actions}
      extra={extra}
    />
  );
}
