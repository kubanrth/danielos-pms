import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function loadAssignments(userId: string) {
  return db.taskAssignee.findMany({
    where: { userId, task: { deletedAt: null } },
    orderBy: { task: { updatedAt: "desc" } },
    include: {
      task: {
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
          board: { select: { id: true, name: true } },
          statusColumn: true,
          tags: { include: { tag: true } },
        },
      },
    },
  });
}

type Assignment = Awaited<ReturnType<typeof loadAssignments>>[number];

export default async function MyTasksPage() {
  const session = await auth();
  const userId = session!.user.id;

  const assignments = await loadAssignments(userId);

  // Filter out any tasks whose workspace was soft-deleted
  const active = assignments.filter((a) => a.task.workspace);

  // Bucket: overdue / today / upcoming / no-date / done-like (no dedicated "done" flag — skip)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  const buckets: Record<"overdue" | "today" | "upcoming" | "nodate", Assignment[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    nodate: [],
  };

  for (const a of active) {
    const d = a.task.stopAt?.getTime();
    if (!d) buckets.nodate.push(a);
    else if (d < todayStart) buckets.overdue.push(a);
    else if (d < todayEnd) buckets.today.push(a);
    else buckets.upcoming.push(a);
  }

  const totalCount = active.length;

  return (
    <main className="flex-1 px-8 py-12 md:px-14 md:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Zadania dla Ciebie</span>
          <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
            Twoja lista. <span className="text-brand-gradient">{totalCount}</span>{" "}
            {totalCount === 1 ? "zadanie" : "zadań"}.
          </h1>
          <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
            Wszystko, gdzie Ty jesteś assignee — ze wszystkich twoich przestrzeni
            roboczych.
          </p>
        </div>

        <Bucket label="Zaległe" accent="destructive" items={buckets.overdue} />
        <Bucket label="Na dziś" accent="primary" items={buckets.today} />
        <Bucket label="Nadchodzące" accent="muted" items={buckets.upcoming} />
        <Bucket label="Bez terminu" accent="muted" items={buckets.nodate} />

        {totalCount === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-[1.1rem] font-semibold">Nikt Cię nie przypisał.</p>
            <p className="mt-2 text-[0.92rem] text-muted-foreground">
              Jak ktoś przypisze Cię do zadania, pojawi się tutaj.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Bucket({
  label,
  accent,
  items,
}: {
  label: string;
  accent: "destructive" | "primary" | "muted";
  items: Assignment[];
}) {
  if (items.length === 0) return null;
  const accentClass =
    accent === "destructive"
      ? "text-destructive"
      : accent === "primary"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className={`eyebrow ${accentClass}`}>{label}</h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        {items.map((a) => (
          <li key={a.taskId} className="border-b border-border last:border-b-0">
            <Link
              href={`/w/${a.task.workspace.id}/t/${a.task.id}`}
              className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {a.task.statusColumn && (
                    <span
                      className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] font-semibold"
                      style={{
                        color: a.task.statusColumn.colorHex,
                        background: `${a.task.statusColumn.colorHex}22`,
                      }}
                    >
                      {a.task.statusColumn.name}
                    </span>
                  )}
                  {a.task.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                      style={{ background: `${tag.colorHex}1A`, color: tag.colorHex }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tag.colorHex }} />
                      {tag.name}
                    </span>
                  ))}
                </div>
                <span className="truncate font-display text-[0.98rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
                  {a.task.title}
                </span>
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {a.task.workspace.name} · /{a.task.board.name}
                </span>
              </div>
              {a.task.stopAt && (
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                  {new Date(a.task.stopAt).toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

