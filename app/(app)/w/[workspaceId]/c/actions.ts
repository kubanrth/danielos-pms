"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import {
  createCanvasSchema,
  deleteCanvasSchema,
  renameCanvasSchema,
  saveCanvasSnapshotSchema,
  type SaveCanvasSnapshotInput,
} from "@/lib/schemas/canvas";

type CreateCanvasFieldErrors = { name?: string };

export type CreateCanvasState =
  | { ok: true; canvasId: string }
  | { ok: false; error?: string; fieldErrors?: CreateCanvasFieldErrors }
  | null;

export async function createCanvasAction(
  _prev: CreateCanvasState,
  formData: FormData,
): Promise<CreateCanvasState> {
  const parsed = createCanvasSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const fe: CreateCanvasFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "name") fe.name = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "canvas.create");

  const canvas = await db.processCanvas.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      creatorId: ctx.userId,
      name: parsed.data.name,
    },
  });

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: canvas.id,
    actorId: ctx.userId,
    action: "canvas.created",
    diff: { name: canvas.name },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/canvases`);
  return { ok: true, canvasId: canvas.id };
}

export async function renameCanvasAction(formData: FormData) {
  const parsed = renameCanvasSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const existing = await db.processCanvas.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceAction(existing.workspaceId, "canvas.edit");

  await db.processCanvas.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "ProcessCanvas",
    objectId: existing.id,
    actorId: ctx.userId,
    action: "canvas.renamed",
    diff: { name: parsed.data.name },
  });

  revalidatePath(`/w/${existing.workspaceId}/canvases`);
  revalidatePath(`/w/${existing.workspaceId}/c/${existing.id}`);
}

export async function deleteCanvasAction(formData: FormData) {
  const parsed = deleteCanvasSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const existing = await db.processCanvas.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceAction(existing.workspaceId, "canvas.delete");

  await db.processCanvas.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "ProcessCanvas",
    objectId: existing.id,
    actorId: ctx.userId,
    action: "canvas.deleted",
    diff: { name: existing.name },
  });

  revalidatePath(`/w/${existing.workspaceId}/canvases`);
  redirect(`/w/${existing.workspaceId}/canvases`);
}

export type SaveSnapshotResult =
  | { ok: true; nodeCount: number; edgeCount: number }
  | { ok: false; error: string };

// Full-canvas snapshot save. Diff against existing rows so node identities
// survive between saves — critical for ProcessNodeTaskLink (onDelete:
// Cascade would nuke the links if we did a naive delete-all-and-recreate).
// Edges are cheap to rewrite so we still do delete-all for them.
export async function saveCanvasSnapshotAction(
  input: SaveCanvasSnapshotInput,
): Promise<SaveSnapshotResult> {
  const parsed = saveCanvasSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid snapshot" };
  }

  const canvas = await db.processCanvas.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, workspaceId: true, deletedAt: true },
  });
  if (!canvas || canvas.deletedAt) return { ok: false, error: "Kanwa nie istnieje." };

  const ctx = await requireWorkspaceAction(canvas.workspaceId, "canvas.edit");

  // Validate edge endpoints point at nodes in the snapshot.
  const snapshotNodeIds = new Set(parsed.data.nodes.map((n) => n.id));
  for (const e of parsed.data.edges) {
    if (!snapshotNodeIds.has(e.fromNodeId) || !snapshotNodeIds.has(e.toNodeId)) {
      return { ok: false, error: "Krawędź wskazuje na nieistniejący węzeł." };
    }
  }

  const existingNodes = await db.processNode.findMany({
    where: { canvasId: canvas.id },
    select: { id: true },
  });
  const existingNodeIds = new Set(existingNodes.map((n) => n.id));

  const toCreate = parsed.data.nodes.filter((n) => !existingNodeIds.has(n.id));
  const toUpdate = parsed.data.nodes.filter((n) => existingNodeIds.has(n.id));
  const toDelete = [...existingNodeIds].filter((id) => !snapshotNodeIds.has(id));

  await db.$transaction([
    // Edges first — cascades on node delete would hit them anyway.
    db.processEdge.deleteMany({ where: { canvasId: canvas.id } }),
    // Prune nodes the client no longer has (cascades their task links).
    ...(toDelete.length > 0
      ? [db.processNode.deleteMany({ where: { canvasId: canvas.id, id: { in: toDelete } } })]
      : []),
    // Insert brand-new nodes.
    ...(toCreate.length > 0
      ? [
          db.processNode.createMany({
            data: toCreate.map((n) => ({
              id: n.id,
              canvasId: canvas.id,
              shape: n.shape,
              label: n.label ?? null,
              iconName: n.iconName ?? null,
              x: n.x,
              y: n.y,
              width: n.width,
              height: n.height,
              colorHex: n.colorHex,
            })),
          }),
        ]
      : []),
    // Update existing nodes in place — preserves ProcessNodeTaskLink.
    ...toUpdate.map((n) =>
      db.processNode.update({
        where: { id: n.id },
        data: {
          shape: n.shape,
          label: n.label ?? null,
          iconName: n.iconName ?? null,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          colorHex: n.colorHex,
        },
      }),
    ),
    // Recreate all edges — no downstream FKs so delete-then-insert is fine.
    ...(parsed.data.edges.length > 0
      ? [
          db.processEdge.createMany({
            data: parsed.data.edges.map((e) => ({
              id: e.id,
              canvasId: canvas.id,
              fromNodeId: e.fromNodeId,
              toNodeId: e.toNodeId,
              label: e.label ?? null,
              style: e.style,
              endStyle: e.endStyle,
            })),
          }),
        ]
      : []),
    // F10-W: strokes (pen-tool drawings). Same delete-and-recreate
    // approach as edges — no FKs hanging off them.
    db.processStroke.deleteMany({ where: { canvasId: canvas.id } }),
    ...(parsed.data.strokes && parsed.data.strokes.length > 0
      ? [
          db.processStroke.createMany({
            data: parsed.data.strokes.map((s) => ({
              id: s.id,
              canvasId: canvas.id,
              colorHex: s.colorHex,
              size: s.size,
              points: s.points,
            })),
          }),
        ]
      : []),
    db.processCanvas.update({
      where: { id: canvas.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: canvas.id,
    actorId: ctx.userId,
    action: "canvas.saved",
    diff: {
      nodeCount: parsed.data.nodes.length,
      edgeCount: parsed.data.edges.length,
      strokeCount: parsed.data.strokes?.length ?? 0,
      created: toCreate.length,
      updated: toUpdate.length,
      deleted: toDelete.length,
    },
  });

  // Revalidate rarely — the editor already has the fresh state client-side
  // and server snapshots are read only on page-load.
  revalidatePath(`/w/${canvas.workspaceId}/c/${canvas.id}`);
  return { ok: true, nodeCount: parsed.data.nodes.length, edgeCount: parsed.data.edges.length };
}

// Used by the smoke test + future read-only viewers.
export async function getCanvasSnapshotAction(id: string) {
  const canvas = await db.processCanvas.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, deletedAt: true },
  });
  if (!canvas || canvas.deletedAt) return null;
  await requireWorkspaceMembership(canvas.workspaceId);
  const [nodes, edges] = await Promise.all([
    db.processNode.findMany({ where: { canvasId: id } }),
    db.processEdge.findMany({ where: { canvasId: id } }),
  ]);
  return { nodes, edges };
}
