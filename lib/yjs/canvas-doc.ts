// Yjs data model for a whiteboard canvas.
//
// Two root Y.Maps: one for nodes, one for edges. Each entry is itself a
// Y.Map so field-level changes (e.g. `x` drag) can merge independently —
// if two peers edit the same node, Yjs CRDT resolves field-by-field.
//
// Local UI (React Flow) reads derived plain objects on every Yjs
// update; writes happen via mutator helpers below so we don't scatter
// Y.Map.set() calls across the editor.

import * as Y from "yjs";

export const SHAPES = ["RECTANGLE", "DIAMOND", "CIRCLE"] as const;
export type CanvasShape = (typeof SHAPES)[number];

export interface CanvasNodeValue {
  id: string;
  shape: CanvasShape;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
}

export interface CanvasEdgeValue {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string | null;
  style: "solid" | "dashed";
}

export type InitialNode = CanvasNodeValue;
export type InitialEdge = CanvasEdgeValue;

export interface CanvasYRefs {
  ydoc: Y.Doc;
  nodes: Y.Map<Y.Map<unknown>>;
  edges: Y.Map<Y.Map<unknown>>;
}

export const LOCAL_ORIGIN = Symbol("canvas:local");
export const REMOTE_ORIGIN = Symbol("canvas:remote");
export const SEED_ORIGIN = Symbol("canvas:seed");

export function createCanvasYDoc(): CanvasYRefs {
  const ydoc = new Y.Doc();
  const nodes = ydoc.getMap<Y.Map<unknown>>("nodes");
  const edges = ydoc.getMap<Y.Map<unknown>>("edges");
  return { ydoc, nodes, edges };
}

// Bulk-seed on open. Uses SEED_ORIGIN so the editor can skip any
// spurious "new doc just mutated" observer call on mount.
export function seedCanvasDoc(
  refs: CanvasYRefs,
  initialNodes: InitialNode[],
  initialEdges: InitialEdge[],
): void {
  refs.ydoc.transact(() => {
    for (const n of initialNodes) setNodeValue(refs.nodes, n);
    for (const e of initialEdges) setEdgeValue(refs.edges, e);
  }, SEED_ORIGIN);
}

function toNodeYMap(node: CanvasNodeValue): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("shape", node.shape);
  m.set("label", node.label);
  m.set("x", node.x);
  m.set("y", node.y);
  m.set("width", node.width);
  m.set("height", node.height);
  m.set("colorHex", node.colorHex);
  return m;
}

function toEdgeYMap(edge: CanvasEdgeValue): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("fromNodeId", edge.fromNodeId);
  m.set("toNodeId", edge.toNodeId);
  m.set("label", edge.label);
  m.set("style", edge.style);
  return m;
}

export function setNodeValue(
  nodesMap: Y.Map<Y.Map<unknown>>,
  node: CanvasNodeValue,
): void {
  const existing = nodesMap.get(node.id);
  if (existing) {
    // Field-level writes so other peers touching unrelated fields merge
    // cleanly (Yjs is per-key on a Y.Map).
    if (existing.get("shape") !== node.shape) existing.set("shape", node.shape);
    if (existing.get("label") !== node.label) existing.set("label", node.label);
    if (existing.get("x") !== node.x) existing.set("x", node.x);
    if (existing.get("y") !== node.y) existing.set("y", node.y);
    if (existing.get("width") !== node.width) existing.set("width", node.width);
    if (existing.get("height") !== node.height) existing.set("height", node.height);
    if (existing.get("colorHex") !== node.colorHex) existing.set("colorHex", node.colorHex);
  } else {
    nodesMap.set(node.id, toNodeYMap(node));
  }
}

export function setEdgeValue(
  edgesMap: Y.Map<Y.Map<unknown>>,
  edge: CanvasEdgeValue,
): void {
  const existing = edgesMap.get(edge.id);
  if (existing) {
    if (existing.get("fromNodeId") !== edge.fromNodeId) existing.set("fromNodeId", edge.fromNodeId);
    if (existing.get("toNodeId") !== edge.toNodeId) existing.set("toNodeId", edge.toNodeId);
    if (existing.get("label") !== edge.label) existing.set("label", edge.label);
    if (existing.get("style") !== edge.style) existing.set("style", edge.style);
  } else {
    edgesMap.set(edge.id, toEdgeYMap(edge));
  }
}

// Read-back: returns a deterministic plain-object snapshot. Used by the
// observer to re-derive React Flow state and by save actions to write
// ProcessNode/ProcessEdge rows.
export function readCanvasSnapshot(refs: CanvasYRefs): {
  nodes: CanvasNodeValue[];
  edges: CanvasEdgeValue[];
} {
  const nodes: CanvasNodeValue[] = [];
  refs.nodes.forEach((value, id) => {
    const shape = value.get("shape");
    if (shape !== "RECTANGLE" && shape !== "DIAMOND" && shape !== "CIRCLE") return;
    nodes.push({
      id,
      shape,
      label: asNullString(value.get("label")),
      x: asNumber(value.get("x"), 0),
      y: asNumber(value.get("y"), 0),
      width: asNumber(value.get("width"), 160),
      height: asNumber(value.get("height"), 80),
      colorHex: asString(value.get("colorHex"), "#FFFFFF"),
    });
  });
  const edges: CanvasEdgeValue[] = [];
  refs.edges.forEach((value, id) => {
    const from = value.get("fromNodeId");
    const to = value.get("toNodeId");
    if (typeof from !== "string" || typeof to !== "string") return;
    const style = value.get("style");
    edges.push({
      id,
      fromNodeId: from,
      toNodeId: to,
      label: asNullString(value.get("label")),
      style: style === "dashed" ? "dashed" : "solid",
    });
  });
  return { nodes, edges };
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function asNullString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

// Byte-level update helpers — used by the Realtime provider to move
// state between peers.
export function encodeUpdate(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

export function applyRemoteUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update, REMOTE_ORIGIN);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
