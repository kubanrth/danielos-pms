import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) notFound();

  const canEditSettings = can(ctx.role, "workspace.updateSettings");

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-border px-8 pb-6 pt-8 md:flex-row md:items-end md:justify-between md:px-14">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Przestrzeń · /{workspace.slug}</span>
          <h1 className="font-display text-[2.2rem] leading-[1.05] tracking-[-0.025em] text-foreground">
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="max-w-[64ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
              {workspace.description}
            </p>
          )}
        </div>

        <nav className="flex items-center gap-6">
          <Link
            href={`/w/${workspace.id}`}
            className="eyebrow transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            Przegląd
          </Link>
          <Link
            href={`/w/${workspace.id}/members`}
            className="eyebrow transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            Członkowie
          </Link>
          {canEditSettings && (
            <Link
              href={`/w/${workspace.id}/settings`}
              className="eyebrow transition-colors hover:text-foreground focus-visible:text-foreground"
            >
              Ustawienia
            </Link>
          )}
          <span className="eyebrow text-muted-foreground/60">
            Twoja rola: <span className="text-foreground">{ctx.role.toLowerCase()}</span>
          </span>
        </nav>
      </header>

      <main className="flex-1 px-8 py-10 md:px-14">{children}</main>
    </>
  );
}
