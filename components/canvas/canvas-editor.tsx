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
  Save,
  Square as SquareIcon,
  Trash2,
} from "lucide-react";
import { saveCanvasSnapshotAction } from "@/app/(app)/w/[workspaceId]/c/actions";
import { ShapeNode, type ShapeNodeData } from "@/components/canvas/shape-node";

export interface EditorInitialNode {
  id: string;
  shape: "RECTANGLE" | "DIAMOND" | "CIRCLE";
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
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

function toRFNode(n: EditorInitialNode): RFNode {
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
  canvasId: string;
  initialNodes: EditorInitialNode[];
  initialEdges: EditorInitialEdge[];
  canEdit: boolean;
}) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasEditorInner({
  canvasId,
  initialNodes,
  initialEdges,
  canEdit,
}: {
  canvasId: string;
  initialNodes: EditorInitialNode[];
  initialEdges: EditorInitialEdge[];
  canEdit: boolean;
}) {
  const nodeTypes: NodeTypes = useMemo(() => ({ shape: ShapeNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(
    initialNodes.map(toRFNode),
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
          },
          width: shape === "CIRCLE" ? 120 : 160,
          height: shape === "CIRCLE" ? 120 : 80,
        },
      ]);
    },
    [setNodes],
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
