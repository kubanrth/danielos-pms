"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import {
  Circle as CircleIcon,
  Diamond as DiamondIcon,
  Link2,
  Save,
  Square as SquareIcon,
  Trash2,
  Unlink2,
  X,
} from "lucide-react";
import { saveCanvasSnapshotAction } from "@/app/(app)/w/[workspaceId]/c/actions";
import {
  createAndLinkTaskFromNodeAction,
  linkTaskToNodeAction,
  unlinkTaskFromNodeAction,
} from "@/app/(app)/w/[workspaceId]/c/node-task-actions";
import { ShapeNode, type NodeTaskChip, type ShapeNodeData } from "@/components/canvas/shape-node";
import { useRouter } from "next/navigation";

export interface EditorInitialNode {
  id: string;
  shape: "RECTANGLE" | "DIAMOND" | "CIRCLE";
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
  linkedTasks: NodeTaskChip[];
}

export interface WorkspaceTaskOption {
  id: string;
  title: string;
}

export interface EditorInitialEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string | null;
  style: "solid" | "dashed";
}

type RFNode = Node<ShapeNodeData>;

const PALETTE = [
  "#FFFFFF",
  "#F5F5F5",
  "#FEF3C7",
  "#DBEAFE",
  "#DCFCE7",
  "#FCE7F3",
  "#EDE9FE",
  "#FEE2E2",
];

function cuidish(): string {
  // Small client-side id with enough entropy for a short editor session.
  // The server re-accepts the same id on save so we keep RF ↔ DB identity.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `n_${Date.now().toString(36)}${rand}`;
}

function toRFNode(n: EditorInitialNode, workspaceId: string): RFNode {
  return {
    id: n.id,
    type: "shape",
    position: { x: n.x, y: n.y },
    data: {
      shape: n.shape,
      label: n.label,
      colorHex: n.colorHex,
      width: n.width,
      height: n.height,
      linkedTasks: n.linkedTasks,
      workspaceId,
    },
    width: n.width,
    height: n.height,
  };
}

function toRFEdge(e: EditorInitialEdge): Edge {
  return {
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.label ?? undefined,
    style: e.style === "dashed" ? { strokeDasharray: "6 4" } : undefined,
    data: { style: e.style },
  };
}

export function CanvasEditor(props: {
  workspaceId: string;
  canvasId: string;
  initialNodes: EditorInitialNode[];
  initialEdges: EditorInitialEdge[];
  canEdit: boolean;
  canCreateTask: boolean;
  workspaceTasks: WorkspaceTaskOption[];
  defaultBoardId: string | null;
}) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasEditorInner({
  workspaceId,
  canvasId,
  initialNodes,
  initialEdges,
  canEdit,
  canCreateTask,
  workspaceTasks,
  defaultBoardId,
}: {
  workspaceId: string;
  canvasId: string;
  initialNodes: EditorInitialNode[];
  initialEdges: EditorInitialEdge[];
  canEdit: boolean;
  canCreateTask: boolean;
  workspaceTasks: WorkspaceTaskOption[];
  defaultBoardId: string | null;
}) {
  const router = useRouter();
  const nodeTypes: NodeTypes = useMemo(() => ({ shape: ShapeNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(
    initialNodes.map((n) => toRFNode(n, workspaceId)),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges.map(toRFEdge));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onConnect: OnConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `e_${cuidish()}`,
            data: { style: "solid" },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const addShape = useCallback(
    (shape: "RECTANGLE" | "DIAMOND" | "CIRCLE") => {
      // Drop new shapes near the current viewport center-ish. No useReactFlow
      // math because it's Good Enough for first-pass UX.
      const id = cuidish();
      const x = 120 + Math.random() * 180;
      const y = 120 + Math.random() * 140;
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: "shape",
          position: { x, y },
          data: {
            shape,
            label: null,
            colorHex: "#FFFFFF",
            width: shape === "CIRCLE" ? 120 : 160,
            height: shape === "CIRCLE" ? 120 : 80,
            linkedTasks: [],
            workspaceId,
          },
          width: shape === "CIRCLE" ? 120 : 160,
          height: shape === "CIRCLE" ? 120 : 80,
        },
      ]);
    },
    [setNodes, workspaceId],
  );

  const deleteSelected = useCallback(() => {
    setNodes((ns) => ns.filter((n) => !n.selected));
    setEdges((es) => {
      const removedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      return es.filter(
        (e) =>
          !e.selected &&
          !removedNodeIds.has(e.source) &&
          !removedNodeIds.has(e.target),
      );
    });
  }, [nodes, setNodes, setEdges]);

  const renameSelected = useCallback(() => {
    const target = nodes.find((n) => n.selected);
    if (!target) return;
    const next = window.prompt(
      "Etykieta węzła",
      target.data.label ?? "",
    );
    if (next === null) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === target.id
          ? { ...n, data: { ...n.data, label: next.trim() || null } }
          : n,
      ),
    );
  }, [nodes, setNodes]);

  const recolorSelected = useCallback(
    (hex: string) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.selected ? { ...n, data: { ...n.data, colorHex: hex } } : n,
        ),
      );
    },
    [setNodes],
  );

  const save = useCallback(() => {
    setSaveState("saving");
    setSaveError(null);
    startTransition(async () => {
      const res = await saveCanvasSnapshotAction({
        id: canvasId,
        nodes: nodes.map((n) => ({
          id: n.id,
          shape: n.data.shape,
          label: n.data.label ?? null,
          x: n.position.x,
          y: n.position.y,
          width: n.data.width,
          height: n.data.height,
          colorHex: n.data.colorHex,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          fromNodeId: e.source,
          toNodeId: e.target,
          label: typeof e.label === "string" ? e.label : null,
          style: ((e.data as { style?: "solid" | "dashed" } | undefined)?.style ?? "solid"),
        })),
      });
      if (res.ok) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1600);
      } else {
        setSaveState("error");
        setSaveError(res.error);
      }
    });
  }, [canvasId, nodes, edges]);

  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length;
  const selectedNodes = nodes.filter((n) => n.selected);
  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  // Mutate a single node's data client-side (used after link/unlink to
  // reflect chips without a page reload).
  const patchNodeData = useCallback(
    (nodeId: string, patch: (chips: NodeTaskChip[]) => NodeTaskChip[]) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  linkedTasks: patch(n.data.linkedTasks ?? []),
                },
              }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const [linkError, setLinkError] = useState<string | null>(null);

  const handleLinkTask = useCallback(
    async (taskId: string) => {
      if (!singleSelectedNode) return;
      const nodeId = singleSelectedNode.id;
      const task = workspaceTasks.find((t) => t.id === taskId);
      if (!task) return;
      setLinkError(null);
      const res = await linkTaskToNodeAction({ nodeId, taskId });
      if (!res.ok) {
        setLinkError(res.error);
        return;
      }
      patchNodeData(nodeId, (chips) =>
        chips.some((c) => c.taskId === taskId)
          ? chips
          : [...chips, { taskId: task.id, title: task.title }],
      );
    },
    [singleSelectedNode, workspaceTasks, patchNodeData],
  );

  const handleUnlinkTask = useCallback(
    async (taskId: string) => {
      if (!singleSelectedNode) return;
      const nodeId = singleSelectedNode.id;
      setLinkError(null);
      const res = await unlinkTaskFromNodeAction({ nodeId, taskId });
      if (!res.ok) {
        setLinkError(res.error);
        return;
      }
      patchNodeData(nodeId, (chips) => chips.filter((c) => c.taskId !== taskId));
    },
    [singleSelectedNode, patchNodeData],
  );

  const handleCreateAndLink = useCallback(async () => {
    if (!singleSelectedNode || !defaultBoardId) return;
    const nodeId = singleSelectedNode.id;
    const defaultTitle = singleSelectedNode.data.label ?? "";
    const title = window.prompt("Tytuł nowego zadania", defaultTitle);
    if (!title || title.trim().length === 0) return;
    setLinkError(null);
    const res = await createAndLinkTaskFromNodeAction({
      nodeId,
      boardId: defaultBoardId,
      title: title.trim(),
    });
    if (!res.ok) {
      setLinkError(res.error);
      return;
    }
    patchNodeData(nodeId, (chips) => [
      ...chips,
      { taskId: res.taskId, title: title.trim() },
    ]);
    // Pop the new task's detail modal so the user can fill in the rest.
    router.push(`/w/${workspaceId}/t/${res.taskId}`);
  }, [singleSelectedNode, defaultBoardId, patchNodeData, router, workspaceId]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={canEdit ? onConnect : undefined}
        nodeTypes={nodeTypes}
        onNodeDoubleClick={canEdit ? (_e, n) => {
          // Focus first, then rename — window.prompt blocks so this is OK.
          setNodes((ns) => ns.map((x) => ({ ...x, selected: x.id === n.id })));
          setTimeout(() => renameSelected(), 0);
        } : undefined}
        deleteKeyCode={canEdit ? ["Delete", "Backspace"] : null}
        minZoom={0.2}
        maxZoom={2}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls />
        <MiniMap pannable zoomable className="!bg-card" />
      </ReactFlow>

      {canEdit && (
        <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
            <ToolButton label="Prostokąt" onClick={() => addShape("RECTANGLE")}>
              <SquareIcon size={14} />
            </ToolButton>
            <ToolButton label="Romb" onClick={() => addShape("DIAMOND")}>
              <DiamondIcon size={14} />
            </ToolButton>
            <ToolButton label="Koło" onClick={() => addShape("CIRCLE")}>
              <CircleIcon size={14} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-1 px-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => recolorSelected(c)}
                  disabled={selectedCount === 0}
                  className="h-5 w-5 rounded-full border border-border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: c }}
                  aria-label={`Kolor ${c}`}
                  title={`Kolor ${c}`}
                />
              ))}
            </div>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <ToolButton label="Usuń" onClick={deleteSelected} disabled={selectedCount === 0}>
              <Trash2 size={14} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={save}
              disabled={saveState === "saving"}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-gradient px-3 font-sans text-[0.82rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[0.5px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-60"
            >
              <Save size={13} />
              {saveState === "saving"
                ? "Zapisuję…"
                : saveState === "saved"
                  ? "Zapisano"
                  : "Zapisz"}
            </button>
          </div>
          {saveState === "error" && saveError && (
            <span className="pointer-events-auto rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-destructive">
              {saveError}
            </span>
          )}
        </div>
      )}

      {/* Side panel — only when exactly one node is selected. */}
      {canEdit && singleSelectedNode && (
        <TaskLinksPanel
          nodeLabel={singleSelectedNode.data.label}
          linkedTasks={singleSelectedNode.data.linkedTasks ?? []}
          workspaceTasks={workspaceTasks}
          canCreateTask={canCreateTask}
          canCreateWithNoBoard={defaultBoardId !== null}
          onLink={handleLinkTask}
          onUnlink={handleUnlinkTask}
          onCreate={handleCreateAndLink}
          error={linkError}
        />
      )}
    </div>
  );
}

function TaskLinksPanel({
  nodeLabel,
  linkedTasks,
  workspaceTasks,
  canCreateTask,
  canCreateWithNoBoard,
  onLink,
  onUnlink,
  onCreate,
  error,
}: {
  nodeLabel: string | null;
  linkedTasks: NodeTaskChip[];
  workspaceTasks: WorkspaceTaskOption[];
  canCreateTask: boolean;
  canCreateWithNoBoard: boolean;
  onLink: (taskId: string) => void;
  onUnlink: (taskId: string) => void;
  onCreate: () => void;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const linkedIds = useMemo(() => new Set(linkedTasks.map((t) => t.taskId)), [linkedTasks]);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      workspaceTasks
        .filter((t) => !linkedIds.has(t.id))
        .filter((t) => !q || t.title.toLowerCase().includes(q))
        .slice(0, 20),
    [workspaceTasks, linkedIds, q],
  );

  return (
    <div className="pointer-events-auto absolute right-3 top-3 flex w-[300px] flex-col gap-2 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-primary">Zadania na węźle</span>
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
          {linkedTasks.length}
        </span>
      </div>

      <span className="truncate text-[0.8rem] text-muted-foreground">
        {nodeLabel ? `„${nodeLabel}”` : "bez etykiety"}
      </span>

      {linkedTasks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {linkedTasks.map((t) => (
            <li
              key={t.taskId}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
            >
              <span className="truncate flex-1 text-[0.82rem]" title={t.title}>
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => onUnlink(t.taskId)}
                aria-label="Odepnij"
                title="Odepnij"
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Link2 size={12} className="text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="szukaj zadania…"
            className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[0.8rem] outline-none focus:border-primary"
          />
        </div>
        {filtered.length > 0 && (
          <ul className="flex max-h-[180px] flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-background">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onLink(t.id)}
                  className="flex w-full items-center gap-1.5 truncate px-2 py-1 text-left text-[0.8rem] transition-colors hover:bg-accent"
                  title={t.title}
                >
                  <Link2 size={10} className="text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {q && filtered.length === 0 && (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            Brak dopasowań.
          </span>
        )}
      </div>

      {canCreateTask && (
        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreateWithNoBoard}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 font-sans text-[0.8rem] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title={canCreateWithNoBoard ? undefined : "Brak tablicy w tej przestrzeni"}
        >
          <Unlink2 size={12} /> Utwórz zadanie z węzła
        </button>
      )}

      {error && (
        <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

function ToolButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
