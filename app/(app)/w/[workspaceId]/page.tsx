import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CreateTaskButton } from "@/components/task/create-task-button";

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [memberCount, boards] = await Promise.all([
    db.workspaceMembership.count({ where: { workspaceId } }),
    db.board.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        statusColumns: { orderBy: { order: "asc" } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
          take: 20,
          include: {
            assignees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
            tags: { include: { tag: true } },
            statusColumn: true,
          },
        },
      },
    }),
  ]);

  const canCreateTask = can(ctx.role, "task.create");
  const firstBoard = boards[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <div className="flex items-baseline justify-between">
        <Metric label="Członkowie" value={memberCount} />
        {firstBoard && canCreateTask && (
          <CreateTaskButton workspaceId={workspaceId} boardId={firstBoard.id} />
        )}
      </div>

      {boards.map((board) => (
        <section key={board.id} className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[1.25rem] font-bold leading-[1.2] tracking-[-0.02em]">
              <Link
                href={`/w/${workspaceId}/b/${board.id}/table`}
                className="transition-colors hover:text-primary"
              >
                {board.name}
              </Link>
              <span className="ml-3 font-mono text-[0.72rem] font-normal uppercase tracking-[0.14em] text-muted-foreground">
                {board._count.tasks}{" "}
                {board._count.tasks === 1 ? "zadanie" : "zadań"}
              </span>
            </h2>
            <div className="flex items-center gap-3">
              <Link
                href={`/w/${workspaceId}/b/${board.id}/table`}
                className="eyebrow transition-colors hover:text-foreground"
              >
                Tabela →
              </Link>
              <Link
                href={`/w/${workspaceId}/b/${board.id}/kanban`}
                className="eyebrow transition-colors hover:text-foreground"
              >
                Kanban →
              </Link>
            </div>
          </div>

          {board.tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <p className="font-display text-[1.05rem] font-semibold">Brak zadań.</p>
              <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em]">
                zacznij od przycisku „Nowe zadanie" powyżej
              </p>
            </div>
          ) : (
            <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
              {board.tasks.map((task) => (
                <li key={task.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/w/${workspaceId}/t/${task.id}`}
                    className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        {task.statusColumn && (
                          <span
                            className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] font-semibold"
                            style={{
                              color: task.statusColumn.colorHex,
                              background: `${task.statusColumn.colorHex}22`,
                            }}
                          >
                            {task.statusColumn.name}
                          </span>
                        )}
                        {task.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                            style={{
                              background: `${tag.colorHex}1A`,
                              color: tag.colorHex,
                            }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tag.colorHex }} />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                      <span className="truncate font-display text-[0.98rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {task.assignees.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {task.assignees.slice(0, 3).map((a) => (
                            <span
                              key={a.userId}
                              className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-background bg-brand-gradient font-display text-[0.6rem] font-bold text-white"
                              title={a.user.name ?? a.user.email}
                            >
                              {a.user.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                (a.user.name ?? a.user.email).slice(0, 2).toUpperCase()
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {task.stopAt && (
                        <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                          do {new Date(task.stopAt).toLocaleDateString("pl-PL")}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-4 border-t border-border pt-10">
        <h3 className="font-display text-[1.1rem] font-bold leading-[1.2] tracking-[-0.02em]">
          Dalsze kroki
        </h3>
        <ul className="grid gap-3 text-[0.92rem] leading-[1.55] text-muted-foreground md:grid-cols-2">
          <Step phase="F2" label="Edytowalny widok tabeli (Jira-like)" />
          <Step phase="F3" label="Kanban z drag & drop + real-time sync" />
          <Step phase="F4" label="Komentarze, załączniki, audit log w modalu" />
          <Step phase="F5" label="Roadmap + Milestones" />
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="eyebrow">{label}</span>
      <span className="font-display text-[1.8rem] font-bold leading-none tracking-[-0.02em]">
        {value}
      </span>
    </div>
  );
}

function Step({ phase, label }: { phase: string; label: string }) {
  return (
    <li className="flex items-start gap-3 border-l-2 border-border pl-4 py-1">
      <span className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-primary">
        {phase}
      </span>
      <span>{label}</span>
    </li>
  );
}
