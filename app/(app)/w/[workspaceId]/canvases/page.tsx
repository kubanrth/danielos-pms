import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { NewCanvasForm } from "@/components/canvas/new-canvas-form";
import { DeleteCanvasButton } from "@/components/canvas/delete-canvas-button";
import { plPlural } from "@/lib/pluralize";

export default async function CanvasesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const canvases = await db.processCanvas.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { nodes: true, edges: true } },
    },
  });

  const canCreate = can(ctx.role, "canvas.create");
  const canDelete = can(ctx.role, "canvas.delete");

  return (
    <main className="flex-1 px-8 py-12 md:px-14 md:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Whiteboard</span>
          <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
            Procesy. {canvases.length} {plPlural(canvases.length, "kanwa", "kanwy", "kanw")}.
          </h1>
          <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
            Diagramy procesów, flowcharty, mapy myśli. Każda kanwa trzyma węzły i krawędzie
            w tej przestrzeni.
          </p>
        </div>

        {canCreate && <NewCanvasForm workspaceId={workspaceId} />}

        {canvases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-[1.1rem] font-semibold">Brak kanw.</p>
            <p className="mt-2 text-[0.92rem] text-muted-foreground">
              {canCreate
                ? "Utwórz pierwszą, żeby zacząć rysować."
                : "Jak admin utworzy kanwę, pojawi się tutaj."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {canvases.map((c) => (
              <li key={c.id}>
                <article className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/w/${workspaceId}/c/${c.id}`}
                      className="min-w-0 flex-1 font-display text-[1.05rem] font-semibold tracking-[-0.01em] transition-colors group-hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    {canDelete && <DeleteCanvasButton id={c.id} name={c.name} />}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                    <span>{c._count.nodes} węzłów</span>
                    <span>{c._count.edges} krawędzi</span>
                    <span className="ml-auto">
                      {c.creator.name ?? c.creator.email.split("@")[0]}
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
