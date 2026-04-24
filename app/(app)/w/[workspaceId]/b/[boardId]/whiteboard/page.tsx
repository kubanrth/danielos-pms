import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CanvasEditorLazy } from "@/components/canvas/canvas-editor-lazy";
import { BoardShell } from "@/components/view/board-shell";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";

// One canvas per board. Auto-created on first visit so users never see an
// empty state — gives the per-board whiteboard "zero config" feel.
async function ensureBoardCanvas(
  boardId: string,
  workspaceId: string,
  creatorId: string,
  boardName: string,
) {
  const existing = await db.processCanvas.findFirst({
    where: { boardId, deletedAt: null },
    include: {
      nodes: {
        include: {
          taskLinks: {
            include: { task: { select: { id: true, title: true, deletedAt: true } } },
          },
        },
      },
      edges: true,
    },
  });
  if (existing) return existing;

  const created = await db.processCanvas.create({
    data: {
      workspaceId,
      boardId,
      name: boardName,
      creatorId,
    },
    include: {
      nodes: {
        include: {
          taskLinks: {
            include: { task: { select: { id: true, title: true, deletedAt: true } } },
          },
        },
      },
      edges: true,
    },
  });
  return created;
}

export default async function BoardWhiteboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: { workspace: { select: { enabledViews: true } } },
  });
  if (!board) notFound();

  const canvas = await ensureBoardCanvas(
    board.id,
    workspaceId,
    ctx.userId,
    board.name,
  );

  const canEdit = can(ctx.role, "canvas.edit");
  const canCreateTask = can(ctx.role, "task.create");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  const boardTasks = await db.task.findMany({
    where: { boardId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: { id: true, title: true },
  });

  const linksByNode = new Map<string, { taskId: string; title: string }[]>();
  for (const n of canvas.nodes) {
    const alive = n.taskLinks
      .filter((l) => l.task && !l.task.deletedAt)
      .map((l) => ({ taskId: l.task.id, title: l.task.title }));
    if (alive.length > 0) linksByNode.set(n.id, alive);
  }

  return (
    <BoardShell bgCss={null}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        active="whiteboard"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={board.id} />}
      />

      <div className="h-[calc(100dvh-18rem)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-card">
        <CanvasEditorLazy
          workspaceId={workspaceId}
          canvasId={canvas.id}
          initialNodes={canvas.nodes.map((n) => ({
            id: n.id,
            shape: n.shape === "ICON" ? "RECTANGLE" : n.shape,
            label: n.label,
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            colorHex: n.colorHex,
            linkedTasks: linksByNode.get(n.id) ?? [],
          }))}
          initialEdges={canvas.edges.map((e) => ({
            id: e.id,
            fromNodeId: e.fromNodeId,
            toNodeId: e.toNodeId,
            label: e.label,
            style: e.style === "dashed" ? "dashed" : "solid",
          }))}
          canEdit={canEdit}
          canCreateTask={canCreateTask}
          workspaceTasks={boardTasks}
          defaultBoardId={board.id}
        />
      </div>
    </BoardShell>
  );
}
