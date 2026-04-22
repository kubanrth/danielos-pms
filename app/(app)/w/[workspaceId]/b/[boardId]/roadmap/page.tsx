import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { BackgroundCustomizer } from "@/components/view/background-customizer";
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

  return (
    <div
      className="relative -mx-8 -my-10 min-h-[calc(100dvh-14rem)] px-8 py-10 md:-mx-14 md:px-14"
      style={bgCss ? { background: bgCss } : undefined}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Roadmapa</span>
            <h1 className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.03em]">
              {board.name}
            </h1>
          </div>
          {canCustomize && roadmapView && (
            <BackgroundCustomizer
              workspaceId={workspaceId}
              boardId={boardId}
              viewType="ROADMAP"
              initial={background}
            />
          )}
        </div>

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
      </div>
    </div>
  );
}
