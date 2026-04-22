import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CanvasEditor } from "@/components/canvas/canvas-editor";

export default async function CanvasEditorPage({
  params,
}: {
  params: Promise<{ workspaceId: string; canvasId: string }>;
}) {
  const { workspaceId, canvasId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const canvas = await db.processCanvas.findFirst({
    where: { id: canvasId, workspaceId, deletedAt: null },
    include: {
      nodes: true,
      edges: true,
    },
  });
  if (!canvas) notFound();

  const canEdit = can(ctx.role, "canvas.edit");

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b border-border bg-background/95 px-8 py-3 backdrop-blur md:px-14">
        <div className="flex items-center gap-3">
          <Link
            href={`/w/${workspaceId}/canvases`}
            className="eyebrow inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} /> wróć do listy
          </Link>
          <span className="text-muted-foreground">·</span>
          <h1 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em]">
            {canvas.name}
          </h1>
        </div>
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
          {canvas.nodes.length} węzłów · {canvas.edges.length} krawędzi
        </span>
      </header>

      <div className="flex-1 min-h-0">
        <CanvasEditor
          canvasId={canvas.id}
          initialNodes={canvas.nodes.map((n) => ({
            id: n.id,
            // F6a handles 3 shapes; legacy ICON nodes (future feature) fall
            // back to RECTANGLE so their data survives round-trips.
            shape: n.shape === "ICON" ? "RECTANGLE" : n.shape,
            label: n.label,
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            colorHex: n.colorHex,
          }))}
          initialEdges={canvas.edges.map((e) => ({
            id: e.id,
            fromNodeId: e.fromNodeId,
            toNodeId: e.toNodeId,
            label: e.label,
            style: e.style === "dashed" ? "dashed" : "solid",
          }))}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
