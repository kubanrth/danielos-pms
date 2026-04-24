"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  addEdge,
  getNodesBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type EdgeChange,
} from "@xyflow/react";
import {
  Circle as CircleIcon,
  Diamond as DiamondIcon,
  Download,
  Frame as FrameIcon,
  LayoutTemplate,
  Link2,
  Minus as MinusIcon,
  MoveRight as ArrowIcon,
  Save,
  Square as SquareIcon,
  StickyNote,
  Trash2,
  Unlink2,
  X,
} from "lucide-react";
import { toPng } from "html-to-image";
import { saveCanvasSnapshotAction } from "@/app/(app)/w/[workspaceId]/c/actions";
import {
  createAndLinkTaskFromNodeAction,
  linkTaskToNodeAction,
  unlinkTaskFromNodeAction,
} from "@/app/(app)/w/[workspaceId]/c/node-task-actions";
import {
  ShapeNode,
  type NodeTaskChip,
  type ShapeKind,
  type ShapeNodeData,
} from "@/components/canvas/shape-node";
import { useRouter } from "next/navigation";
import {
  createCanvasYDoc,
  readCanvasSnapshot,
  seedCanvasDoc,
  setEdgeValue,
  setNodeValue,
  LOCAL_ORIGIN,
  SEED_ORIGIN,
  type CanvasEdgeEnd,
  type CanvasYRefs,
} from "@/lib/yjs/canvas-doc";
import { createCanvasRealtimeProvider } from "@/lib/yjs/canvas-realtime-provider";
import { applyCanvasTemplate, TEMPLATES, type TemplateKey } from "@/components/canvas/templates";

export interface EditorInitialNode {
  id: string;
  shape: ShapeKind;
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
  endStyle?: CanvasEdgeEnd;
}

type RFEdgeData = { style: "solid" | "dashed"; endStyle: CanvasEdgeEnd };
type RFNode = Node<ShapeNodeData>;
type RFEdge = Edge<RFEdgeData>;

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

// Default size per shape. Sticky notes are small & square; frames are big
// containers (effectively canvas regions).
const SHAPE_DEFAULTS: Record<ShapeKind, { width: number; height: number; color: string }> = {
  RECTANGLE: { width: 160, height: 80, color: "#FFFFFF" },
  DIAMOND: { width: 160, height: 80, color: "#FFFFFF" },
  CIRCLE: { width: 120, height: 120, color: "#FFFFFF" },
  STICKY: { width: 150, height: 150, color: "#FEF3C7" },
  FRAME: { width: 520, height: 320, color: "#F1F5F9" },
};

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

// Map our internal end-style token to React Flow's MarkerType + custom
// SVG markers for variants React Flow doesn't ship natively (diamond,
// circle). React Flow's default markers only cover `Arrow` and
// `ArrowClosed`, so we register a <defs> block below via SVG.
function markerForEnd(end: CanvasEdgeEnd): Edge["markerEnd"] {
  if (end === "arrow") return { type: MarkerType.ArrowClosed, width: 16, height: 16 };
  if (end === "diamond") return "url(#canvas-marker-diamond)";
  if (end === "circle") return "url(#canvas-marker-circle)";
  return undefined; // "none"
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
    // FRAME sits behind other nodes so it acts as a backdrop you can drop
    // shapes over. React Flow honours negative `zIndex` on a per-node basis.
    zIndex: n.shape === "FRAME" ? -10 : 0,
  };
}

function toRFEdge(e: EditorInitialEdge): RFEdge {
  const endStyle: CanvasEdgeEnd = e.endStyle ?? "arrow";
  return {
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.label ?? undefined,
    style: e.style === "dashed" ? { strokeDasharray: "6 4" } : undefined,
    markerEnd: markerForEnd(endStyle),
    data: { style: e.style, endStyle },
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
  const reactFlow = useReactFlow();
  const nodeTypes: NodeTypes = useMemo(() => ({ shape: ShapeNode }), []);
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, rfOnNodesChange] = useNodesState<RFNode>(
    initialNodes.map((n) => toRFNode(n, workspaceId)),
  );
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState<RFEdge>(
    initialEdges.map(toRFEdge),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isConnected, setIsConnected] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  // Y.Doc is the shared source of truth between concurrent editors; the
  // React Flow hooks above are an interactive view on top.
  const yRefsRef = useRef<CanvasYRefs | null>(null);
  if (yRefsRef.current === null) {
    const refs = createCanvasYDoc();
    seedCanvasDoc(
      refs,
      initialNodes,
      initialEdges.map((e) => ({
        id: e.id,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        label: e.label,
        style: e.style,
        endStyle: e.endStyle ?? "arrow",
      })),
    );
    yRefsRef.current = refs;
  }
  const yRefs = yRefsRef.current;

  useEffect(() => {
    const refs = yRefs;
    const handler = (_events: unknown, transaction: { origin?: unknown }) => {
      if (transaction.origin === LOCAL_ORIGIN) return;
      if (transaction.origin === SEED_ORIGIN) return;
      const snapshot = readCanvasSnapshot(refs);

      setNodes((prev) => {
        const prevLinks = new Map(prev.map((n) => [n.id, n.data.linkedTasks ?? []]));
        return snapshot.nodes.map((n) => ({
          id: n.id,
          type: "shape",
          position: { x: n.x, y: n.y },
          data: {
            shape: n.shape,
            label: n.label,
            colorHex: n.colorHex,
            width: n.width,
            height: n.height,
            linkedTasks: prevLinks.get(n.id) ?? [],
            workspaceId,
          },
          width: n.width,
          height: n.height,
          zIndex: n.shape === "FRAME" ? -10 : 0,
        }));
      });
      setEdges(() =>
        snapshot.edges.map((e) => ({
          id: e.id,
          source: e.fromNodeId,
          target: e.toNodeId,
          label: e.label ?? undefined,
          style: e.style === "dashed" ? { strokeDasharray: "6 4" } : undefined,
          markerEnd: markerForEnd(e.endStyle),
          data: { style: e.style, endStyle: e.endStyle },
        })),
      );
    };
    refs.nodes.observeDeep(handler);
    refs.edges.observeDeep(handler);

    const provider = createCanvasRealtimeProvider(refs, canvasId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConnected(true);
    return () => {
      refs.nodes.unobserveDeep(handler);
      refs.edges.unobserveDeep(handler);
      provider.disconnect();
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, workspaceId]);

  const commitNodeToY = useCallback(
    (node: RFNode) => {
      yRefs.ydoc.transact(() => {
        setNodeValue(yRefs.nodes, {
          id: node.id,
          shape: node.data.shape,
          label: node.data.label ?? null,
          x: node.position.x,
          y: node.position.y,
          width: node.data.width,
          height: node.data.height,
          colorHex: node.data.colorHex,
        });
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const commitEdgeToY = useCallback(
    (edge: RFEdge) => {
      const d = edge.data;
      yRefs.ydoc.transact(() => {
        setEdgeValue(yRefs.edges, {
          id: edge.id,
          fromNodeId: edge.source,
          toNodeId: edge.target,
          label: typeof edge.label === "string" ? edge.label : null,
          style: d?.style ?? "solid",
          endStyle: d?.endStyle ?? "arrow",
        });
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const deleteNodeFromY = useCallback(
    (nodeId: string) => {
      yRefs.ydoc.transact(() => {
        yRefs.nodes.delete(nodeId);
        yRefs.edges.forEach((value, id) => {
          const from = value.get("fromNodeId");
          const to = value.get("toNodeId");
          if (from === nodeId || to === nodeId) yRefs.edges.delete(id);
        });
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const deleteEdgeFromY = useCallback(
    (edgeId: string) => {
      yRefs.ydoc.transact(() => {
        yRefs.edges.delete(edgeId);
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const id = `e_${cuidish()}`;
      const newEdge: RFEdge = {
        ...params,
        id,
        source: params.source ?? "",
        target: params.target ?? "",
        data: { style: "solid", endStyle: "arrow" },
        markerEnd: markerForEnd("arrow"),
      };
      setEdges((eds) => addEdge(newEdge, eds));
      if (params.source && params.target) commitEdgeToY(newEdge);
    },
    [setEdges, commitEdgeToY],
  );

  const addShape = useCallback(
    (shape: ShapeKind) => {
      const defaults = SHAPE_DEFAULTS[shape];
      const id = cuidish();
      const x = 120 + Math.random() * 180;
      const y = 120 + Math.random() * 140;
      const rfNode: RFNode = {
        id,
        type: "shape",
        position: { x, y },
        data: {
          shape,
          label: shape === "FRAME" ? "Sekcja" : null,
          colorHex: defaults.color,
          width: defaults.width,
          height: defaults.height,
          linkedTasks: [],
          workspaceId,
        },
        width: defaults.width,
        height: defaults.height,
        zIndex: shape === "FRAME" ? -10 : 0,
      };
      setNodes((ns) => [...ns, rfNode]);
      commitNodeToY(rfNode);
    },
    [setNodes, workspaceId, commitNodeToY],
  );

  const deleteSelected = useCallback(() => {
    const removedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    const removedEdgeIds = new Set(
      edges
        .filter((e) => e.selected || removedNodeIds.has(e.source) || removedNodeIds.has(e.target))
        .map((e) => e.id),
    );
    setNodes((ns) => ns.filter((n) => !removedNodeIds.has(n.id)));
    setEdges((es) => es.filter((e) => !removedEdgeIds.has(e.id)));
    for (const id of removedNodeIds) deleteNodeFromY(id);
    for (const id of removedEdgeIds) deleteEdgeFromY(id);
  }, [nodes, edges, setNodes, setEdges, deleteNodeFromY, deleteEdgeFromY]);

  const renameSelected = useCallback(() => {
    const target = nodes.find((n) => n.selected);
    if (!target) return;
    const next = window.prompt("Etykieta węzła", target.data.label ?? "");
    if (next === null) return;
    const nextLabel = next.trim() || null;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === target.id ? { ...n, data: { ...n.data, label: nextLabel } } : n,
      ),
    );
    commitNodeToY({ ...target, data: { ...target.data, label: nextLabel } });
  }, [nodes, setNodes, commitNodeToY]);

  const recolorSelected = useCallback(
    (hex: string) => {
      const touched: RFNode[] = [];
      setNodes((ns) =>
        ns.map((n) => {
          if (!n.selected) return n;
          const next = { ...n, data: { ...n.data, colorHex: hex } };
          touched.push(next);
          return next;
        }),
      );
      for (const n of touched) commitNodeToY(n);
    },
    [setNodes, commitNodeToY],
  );

  // Change the end marker of all selected edges in one commit.
  const setEdgeEndStyle = useCallback(
    (endStyle: CanvasEdgeEnd) => {
      const touched: RFEdge[] = [];
      setEdges((es) =>
        es.map((e) => {
          if (!e.selected) return e;
          const next: RFEdge = {
            ...e,
            data: {
              style: e.data?.style ?? "solid",
              endStyle,
            },
            markerEnd: markerForEnd(endStyle),
          };
          touched.push(next);
          return next;
        }),
      );
      for (const e of touched) commitEdgeToY(e);
    },
    [setEdges, commitEdgeToY],
  );

  const onNodesChange: OnNodesChange<RFNode> = useCallback(
    (changes: NodeChange<RFNode>[]) => {
      rfOnNodesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          deleteNodeFromY(change.id);
        } else if (change.type === "position" && change.dragging === false && change.position) {
          const existing = nodes.find((n) => n.id === change.id);
          if (existing) {
            commitNodeToY({ ...existing, position: change.position });
          }
        }
      }
    },
    [rfOnNodesChange, nodes, commitNodeToY, deleteNodeFromY],
  );

  const onEdgesChange: OnEdgesChange<RFEdge> = useCallback(
    (changes: EdgeChange<RFEdge>[]) => {
      rfOnEdgesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          deleteEdgeFromY(change.id);
        }
      }
    },
    [rfOnEdgesChange, deleteEdgeFromY],
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
          style: e.data?.style ?? "solid",
          endStyle: e.data?.endStyle ?? "arrow",
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

  // Apply a template: batches a set of pre-arranged nodes + edges onto
  // the canvas, offset from current bounds so we don't overlap existing
  // content. Single transaction = one undo step + one broadcast.
  const applyTemplate = useCallback(
    (key: TemplateKey) => {
      const offset = nodes.length > 0 ? getNodesBounds(nodes) : null;
      const dx = offset ? offset.x + offset.width + 80 : 120;
      const dy = offset ? offset.y : 120;

      const newRfNodes: RFNode[] = [];
      const newRfEdges: RFEdge[] = [];
      applyCanvasTemplate(key, (n, e) => {
        for (const spec of n) {
          const id = cuidish();
          const node: RFNode = {
            id,
            type: "shape",
            position: { x: dx + spec.x, y: dy + spec.y },
            data: {
              shape: spec.shape,
              label: spec.label,
              colorHex: spec.colorHex,
              width: spec.width,
              height: spec.height,
              linkedTasks: [],
              workspaceId,
            },
            width: spec.width,
            height: spec.height,
            zIndex: spec.shape === "FRAME" ? -10 : 0,
          };
          newRfNodes.push(node);
          spec.__assignedId = id;
        }
        for (const spec of e) {
          const from = n[spec.fromIdx].__assignedId;
          const to = n[spec.toIdx].__assignedId;
          if (!from || !to) continue;
          const id = `e_${cuidish()}`;
          newRfEdges.push({
            id,
            source: from,
            target: to,
            label: spec.label,
            markerEnd: markerForEnd(spec.endStyle),
            data: { style: spec.style, endStyle: spec.endStyle },
          });
        }
      });

      setNodes((ns) => [...ns, ...newRfNodes]);
      setEdges((es) => [...es, ...newRfEdges]);
      yRefs.ydoc.transact(() => {
        for (const n of newRfNodes) {
          setNodeValue(yRefs.nodes, {
            id: n.id,
            shape: n.data.shape,
            label: n.data.label ?? null,
            x: n.position.x,
            y: n.position.y,
            width: n.data.width,
            height: n.data.height,
            colorHex: n.data.colorHex,
          });
        }
        for (const e of newRfEdges) {
          setEdgeValue(yRefs.edges, {
            id: e.id,
            fromNodeId: e.source,
            toNodeId: e.target,
            label: typeof e.label === "string" ? e.label : null,
            style: e.data?.style ?? "solid",
            endStyle: e.data?.endStyle ?? "arrow",
          });
        }
      }, LOCAL_ORIGIN);

      // Fit new content into view.
      setTimeout(() => reactFlow.fitView({ padding: 0.2, duration: 400 }), 50);
    },
    [nodes, setNodes, setEdges, yRefs, workspaceId, reactFlow],
  );

  // Render the current viewport as PNG and trigger download. We grab the
  // `.react-flow__viewport` element because it contains nodes + edges in
  // their transformed coordinate space — html-to-image captures exactly
  // what the user sees.
  const exportPng = useCallback(async () => {
    const root = flowWrapperRef.current;
    if (!root) return;
    const pane = root.querySelector<HTMLElement>(".react-flow__viewport");
    if (!pane) return;
    const bounds = getNodesBounds(nodes);
    const pad = 64;
    try {
      const dataUrl = await toPng(pane, {
        backgroundColor: "#ffffff",
        width: Math.max(bounds.width + pad * 2, 800),
        height: Math.max(bounds.height + pad * 2, 600),
        pixelRatio: 2,
        style: {
          transform: `translate(${-bounds.x + pad}px, ${-bounds.y + pad}px)`,
          width: `${bounds.width + pad * 2}px`,
          height: `${bounds.height + pad * 2}px`,
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `whiteboard-${canvasId.slice(-8)}.png`;
      a.click();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Export nie powiódł się.");
      setSaveState("error");
    }
  }, [nodes, canvasId]);

  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length;
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdges = edges.filter((e) => e.selected);
  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const hasEdgeSelection = selectedEdges.length > 0;

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
    router.push(`/w/${workspaceId}/t/${res.taskId}`);
  }, [singleSelectedNode, defaultBoardId, patchNodeData, router, workspaceId]);

  return (
    <div className="relative h-full w-full" ref={flowWrapperRef}>
      {/* Custom markers for connector endings React Flow doesn't ship. */}
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <marker
            id="canvas-marker-diamond"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="10"
            markerHeight="10"
            orient="auto-start-reverse"
          >
            <path d="M0 5 L5 0 L10 5 L5 10 Z" fill="currentColor" />
          </marker>
          <marker
            id="canvas-marker-circle"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </marker>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={canEdit ? onConnect : undefined}
        nodeTypes={nodeTypes}
        onNodeDoubleClick={canEdit ? (_e, n) => {
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
            <ToolButton label="Sticky note" onClick={() => addShape("STICKY")}>
              <StickyNote size={14} />
            </ToolButton>
            <ToolButton label="Ramka" onClick={() => addShape("FRAME")}>
              <FrameIcon size={14} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-1 px-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => recolorSelected(c)}
                  disabled={selectedNodes.length === 0}
                  className="h-5 w-5 rounded-full border border-border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: c }}
                  aria-label={`Kolor ${c}`}
                  title={`Kolor ${c}`}
                />
              ))}
            </div>

            {hasEdgeSelection && (
              <>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolButton
                  label="Końcówka: strzałka"
                  onClick={() => setEdgeEndStyle("arrow")}
                >
                  <ArrowIcon size={14} />
                </ToolButton>
                <ToolButton
                  label="Końcówka: brak"
                  onClick={() => setEdgeEndStyle("none")}
                >
                  <MinusIcon size={14} />
                </ToolButton>
                <ToolButton
                  label="Końcówka: romb"
                  onClick={() => setEdgeEndStyle("diamond")}
                >
                  <DiamondIcon size={12} />
                </ToolButton>
                <ToolButton
                  label="Końcówka: koło"
                  onClick={() => setEdgeEndStyle("circle")}
                >
                  <CircleIcon size={12} />
                </ToolButton>
              </>
            )}

            <span className="mx-1 h-5 w-px bg-border" aria-hidden />

            <TemplatesDropdown
              open={templateOpen}
              setOpen={setTemplateOpen}
              onPick={(k) => {
                applyTemplate(k);
                setTemplateOpen(false);
              }}
            />

            <ToolButton label="Eksport PNG" onClick={exportPng}>
              <Download size={14} />
            </ToolButton>

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

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-2 py-1 shadow-sm backdrop-blur">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            isConnected ? "bg-primary" : "bg-muted-foreground/50"
          }`}
          aria-hidden
        />
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          {isConnected ? "live" : "offline"}
        </span>
      </div>

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

function TemplatesDropdown({
  open,
  setOpen,
  onPick,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onPick: (k: TemplateKey) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Szablony"
        title="Szablony"
        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <LayoutTemplate size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-44 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-[0_8px_20px_-8px_rgba(10,10,40,0.25)]">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onPick(t.key)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[0.82rem] transition-colors hover:bg-accent"
            >
              <span className="text-primary" aria-hidden>
                {t.glyph}
              </span>
              <span className="flex-1 truncate">{t.label}</span>
            </button>
          ))}
        </div>
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
