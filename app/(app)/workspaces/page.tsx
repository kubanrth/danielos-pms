import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/(app)/actions";
import { db } from "@/lib/db";

export default async function WorkspacesPage() {
  const session = await auth();
  const user = session!.user;

  const memberships = await db.workspaceMembership.findMany({
    where: { userId: user.id, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-border px-8 py-5 md:px-14">
        <div className="flex items-center gap-3">
          <span
            className="font-display text-[1.4rem] leading-none tracking-[-0.02em]"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            DANIELOS
          </span>
          <span className="eyebrow hidden sm:inline">System zarządzania projektami</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[0.72rem] text-muted-foreground">
            {user.email}
            {user.isSuperAdmin && (
              <span className="ml-2 rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary">
                super admin
              </span>
            )}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground focus-visible:text-foreground"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-16 md:px-14">
        <div className="mb-12 flex flex-col gap-3">
          <span className="eyebrow">Twoje przestrzenie</span>
          <h1
            className="font-display text-[2.6rem] leading-[1.05] tracking-[-0.03em]"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
          >
            Witaj, {user.name?.split(" ")[0] ?? "kolego"}.
          </h1>
          <p className="max-w-[52ch] text-[0.98rem] leading-[1.65] text-muted-foreground">
            Masz {memberships.length}{" "}
            {memberships.length === 1 ? "przestrzeń roboczą" : "przestrzenie robocze"}.
            Wybierz jedną, żeby kontynuować, albo utwórz nową.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ workspace, role }) => (
            <article
              key={workspace.id}
              className="group relative flex flex-col gap-4 border border-border bg-card p-6 transition-[border-color,transform] hover:-translate-y-[2px] hover:border-primary/40"
              style={{
                boxShadow:
                  "0 1px 0 color-mix(in oklch, var(--foreground) 4%, transparent)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">{role.toLowerCase()}</span>
                <span className="font-mono text-[0.68rem] text-muted-foreground">
                  /{workspace.slug}
                </span>
              </div>
              <h2
                className="font-display text-[1.6rem] leading-[1.1] tracking-[-0.02em] text-foreground"
              >
                {workspace.name}
              </h2>
              {workspace.description && (
                <p className="text-[0.9rem] leading-[1.55] text-muted-foreground">
                  {workspace.description}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                  wejdź →
                </span>
              </div>
            </article>
          ))}

          {/* Create new card placeholder */}
          <article
            className="flex min-h-[180px] flex-col items-start justify-between border border-dashed border-border p-6 text-muted-foreground"
          >
            <span className="eyebrow">Nowa przestrzeń</span>
            <div className="flex flex-col gap-1">
              <span className="font-display text-[1.4rem] leading-[1.1] tracking-[-0.02em]">
                + Utwórz workspace
              </span>
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                dostępne w F1c
              </span>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
