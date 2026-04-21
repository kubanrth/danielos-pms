import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  await requireWorkspaceMembership(workspaceId);

  const [memberCount, boards] = await Promise.all([
    db.workspaceMembership.count({ where: { workspaceId } }),
    db.board.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <Metric label="Członkowie" value={memberCount} />

      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[1.4rem] leading-[1.15] tracking-[-0.02em]">
            Tablice
          </h2>
          <span className="eyebrow text-muted-foreground">
            dodawanie tablic dostępne w F2
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <article
              key={board.id}
              className="flex flex-col gap-4 border border-border bg-card p-5"
              style={{
                boxShadow:
                  "0 1px 0 color-mix(in oklch, var(--foreground) 4%, transparent)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">Tablica</span>
                <span className="font-mono text-[0.68rem] text-muted-foreground">
                  {board._count.tasks}{" "}
                  {board._count.tasks === 1 ? "zadanie" : "zadań"}
                </span>
              </div>
              <h3 className="font-display text-[1.25rem] leading-[1.15] tracking-[-0.02em]">
                {board.name}
              </h3>
              {board.description && (
                <p className="line-clamp-2 text-[0.9rem] leading-[1.55] text-muted-foreground">
                  {board.description}
                </p>
              )}
              <div className="mt-auto flex items-center gap-4 pt-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground/70">
                <span>table · kanban · roadmap (F2+)</span>
              </div>
            </article>
          ))}

          {boards.length === 0 && (
            <div className="col-span-full border border-dashed border-border p-8 text-center text-muted-foreground">
              <p className="font-display text-[1.2rem]">Brak tablic.</p>
              <p className="mt-1 font-mono text-[0.72rem] uppercase tracking-[0.14em]">
                dodawanie w fazie F2
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[1.4rem] leading-[1.15] tracking-[-0.02em]">
            Dalsze kroki
          </h2>
        </div>
        <ul className="grid gap-3 text-[0.92rem] leading-[1.55] text-muted-foreground md:grid-cols-2">
          <Step phase="F1d" label="Zaproszenia i członkowie workspace'u" />
          <Step phase="F1f" label="Uniwersalny Task Modal + tworzenie zadań" />
          <Step phase="F2" label="Edytowalny widok tabeli (Jira-like)" />
          <Step phase="F3" label="Kanban z drag & drop + real-time sync" />
        </ul>
      </section>

      <SettingsHint workspaceId={workspaceId} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="eyebrow">{label}</span>
      <span
        className="font-display text-[2rem] leading-none tracking-[-0.02em]"
      >
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

async function SettingsHint({ workspaceId }: { workspaceId: string }) {
  return (
    <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
      Admini mogą zmienić nazwę lub usunąć przestrzeń w{" "}
      <Link
        href={`/w/${workspaceId}/settings`}
        className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary"
      >
        Ustawieniach
      </Link>
      .
    </p>
  );
}
