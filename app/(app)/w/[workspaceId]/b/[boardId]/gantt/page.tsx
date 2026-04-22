import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { GanttView } from "@/components/roadmap/gantt-view";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { ViewSwitcher } from "@/components/view/view-switcher";

export default async function BoardGanttPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ startAt: "asc" }, { rowOrder: "asc" }],
        include: {
          statusColumn: { select: { name: true, colorHex: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            take: 1,
          },
        },
      },
    },
  });
  if (!board) notFound();

  const canCreate = can(ctx.role, "task.create");

  const scheduled = board.tasks
    .filter((t) => t.startAt && t.stopAt)
    .map((t) => ({
      id: t.id,
      title: t.title,
      startAt: t.startAt?.toISOString() ?? null,
      stopAt: t.stopAt?.toISOString() ?? null,
      statusColor: t.statusColumn?.colorHex ?? "#94A3B8",
      statusName: t.statusColumn?.name ?? null,
      assignee: t.assignees[0]?.user ?? null,
    }));
  const unscheduled = board.tasks
    .filter((t) => !t.startAt || !t.stopAt)
    .map((t) => ({ id: t.id, title: t.title }));

  return (
    <div className="relative -mx-8 -my-10 min-h-[calc(100dvh-14rem)] px-8 py-10 md:-mx-14 md:px-14">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em]">
              {board.name}
            </h2>
            <ViewSwitcher workspaceId={workspaceId} boardId={boardId} active="gantt" />
          </div>
          {canCreate && <CreateTaskButton workspaceId={workspaceId} boardId={boardId} />}
        </div>

        <GanttView
          workspaceId={workspaceId}
          scheduled={scheduled}
          unscheduled={unscheduled}
        />
      </div>
    </div>
  );
}
