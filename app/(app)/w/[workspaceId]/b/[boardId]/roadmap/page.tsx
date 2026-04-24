import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { BackgroundCustomizer } from "@/components/view/background-customizer";
import { BoardShell } from "@/components/view/board-shell";
import { BoardHeader } from "@/components/view/board-header";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/components/view/view-switcher";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      workspace: { select: { enabledViews: true } },
      views: { where: { type: "ROADMAP" } },
      milestones: {
        where: { deletedAt: null },
        orderBy: [{ orderIndex: "asc" }, { startAt: "asc" }],
        include: {
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          tasks: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              statusColumnId: true,
            },
          },
        },
      },
    },
  });
  if (!board) notFound();

  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  const roadmapView = board.views[0];
  const background = (roadmapView?.background ?? null) as BackgroundConfig | null;
  const bgCss = backgroundToCss(background);
  const canCreate = can(ctx.role, "milestone.create");
  const canUpdate = can(ctx.role, "milestone.update");
  const canDelete = can(ctx.role, "milestone.delete");
  const canCustomize = can(ctx.role, "background.customize");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeader
        workspaceId={workspaceId}
        boardId={boardId}
        board={{ name: board.name, description: board.description }}
        active="roadmap"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={boardId} />}
        actions={
          canCustomize && roadmapView ? (
            <BackgroundCustomizer
              workspaceId={workspaceId}
              boardId={boardId}
              viewType="ROADMAP"
              initial={background}
            />
          ) : null
        }
      />

      <RoadmapView
        workspaceId={workspaceId}
        boardId={boardId}
        members={memberships.map((m) => m.user)}
        milestones={board.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          startAt: m.startAt.toISOString(),
          stopAt: m.stopAt.toISOString(),
          assignee: m.assignee,
          taskCount: m.tasks.length,
          tasks: m.tasks.map((t) => ({ id: t.id, title: t.title })),
        }))}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </BoardShell>
  );
}
