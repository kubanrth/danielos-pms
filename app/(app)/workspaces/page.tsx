import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";

export default async function WorkspacesPage() {
  const session = await auth();
  const user = session!.user;

  const memberships = await db.workspaceMembership.findMany({
    where: { userId: user.id, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <main className="flex-1 px-8 py-12 md:px-14 md:py-16">
      <div className="mx-auto max-w-6xl">
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
            <Link
              key={workspace.id}
              href={`/w/${workspace.id}`}
              className="group relative flex min-h-[180px] flex-col gap-4 border border-border bg-card p-6 transition-[border-color,transform] hover:-translate-y-[2px] hover:border-primary/40 focus-visible:-translate-y-[2px] focus-visible:border-primary focus-visible:outline-none"
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
              <h2 className="font-display text-[1.6rem] leading-[1.1] tracking-[-0.02em] text-foreground">
                {workspace.name}
              </h2>
              {workspace.description && (
                <p className="line-clamp-2 text-[0.9rem] leading-[1.55] text-muted-foreground">
                  {workspace.description}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary">
                  wejdź →
                </span>
              </div>
            </Link>
          ))}

          <CreateWorkspaceDialog />
        </div>
      </div>
    </main>
  );
}
