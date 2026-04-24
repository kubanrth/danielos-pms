import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { WorkspacesLayoutToggle } from "@/components/workspaces/workspaces-layout-toggle";
import { boardPl, workspacePl } from "@/lib/pluralize";

export default async function WorkspacesPage() {
  const session = await auth();
  const user = session!.user;

  const memberships = await db.workspaceMembership.findMany({
    where: { userId: user.id, workspace: { deletedAt: null } },
    include: {
      workspace: {
        include: {
          _count: { select: { boards: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const rows = memberships.map(({ workspace, role }) => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    description: workspace.description,
    role,
    boardCount: workspace._count.boards,
    updatedAt: workspace.updatedAt,
  }));

  return (
    <main className="flex-1 px-8 py-12 md:px-14 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-3">
          <span className="eyebrow">Twoje przestrzenie</span>
          <h1 className="font-display text-[2.4rem] font-bold leading-[1.05] tracking-[-0.03em]">
            Cześć, {user.name?.split(" ")[0] ?? "kolego"}.
          </h1>
          <p className="max-w-[52ch] text-[0.98rem] leading-[1.6] text-muted-foreground">
            Masz {memberships.length} {workspacePl(memberships.length)}. Wybierz
            jedną, żeby kontynuować, albo utwórz nową.
          </p>
        </div>

        <WorkspacesLayoutToggle
          grid={
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((w) => (
                <Link
                  key={w.id}
                  href={`/w/${w.id}`}
                  className="group relative flex min-h-[180px] flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(10,10,40,0.04)] transition-all hover:-translate-y-[2px] hover:border-primary/30 hover:shadow-[0_12px_32px_-16px_rgba(123,104,238,0.35)] focus-visible:-translate-y-[2px] focus-visible:border-primary focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">{w.role.toLowerCase()}</span>
                    <span className="font-mono text-[0.68rem] text-muted-foreground">
                      /{w.slug}
                    </span>
                  </div>
                  <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
                    {w.name}
                  </h2>
                  {w.description && (
                    <p className="line-clamp-2 text-[0.9rem] leading-[1.55] text-muted-foreground">
                      {w.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {w.boardCount} {boardPl(w.boardCount)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary">
                      wejdź <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
              <CreateWorkspaceDialog />
            </div>
          }
          list={
            <div className="flex flex-col gap-4">
              <ul className="overflow-hidden rounded-xl border border-border bg-card">
                {rows.length === 0 && (
                  <li className="px-5 py-6 text-center text-[0.9rem] text-muted-foreground">
                    Brak przestrzeni — utwórz pierwszą poniżej.
                  </li>
                )}
                {rows.map((w) => (
                  <li key={w.id} className="border-b border-border last:border-b-0">
                    <Link
                      href={`/w/${w.id}`}
                      className="group grid grid-cols-[minmax(0,1fr)_90px_130px_30px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-display text-[1.05rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
                          {w.name}
                        </span>
                        <span className="truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                          /{w.slug}
                          {w.description ? ` · ${w.description}` : ""}
                        </span>
                      </div>
                      <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {w.role.toLowerCase()}
                      </span>
                      <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {w.boardCount} {boardPl(w.boardCount)}
                      </span>
                      <ArrowRight
                        size={14}
                        className="justify-self-end text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="grid max-w-md">
                <CreateWorkspaceDialog />
              </div>
            </div>
          }
        />
      </div>
    </main>
  );
}
