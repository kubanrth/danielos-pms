"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role, ViewType } from "@/lib/generated/prisma/enums";
import {
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  slugify,
  updateWorkspaceSchema,
} from "@/lib/schemas/workspace";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

type FieldErrors = { name?: string; description?: string; confirmName?: string };

export type WorkspaceFormState =
  | { ok: true; workspaceId: string; slug: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

// Ensure unique slug by appending `-2`, `-3`, ... until available.
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "workspace";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await db.workspace.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function createWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "description") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const slug = await uniqueSlug(slugify(parsed.data.name));

  const workspace = await db.workspace.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      slug,
      ownerId: session.user.id,
      memberships: {
        create: { userId: session.user.id, role: Role.ADMIN },
      },
      // Seed one default board with 4 columns + 3 views.
      boards: {
        create: {
          name: "Pierwsza tablica",
          description: "Domyślna tablica utworzona razem z przestrzenią.",
          creatorId: session.user.id,
          statusColumns: {
            create: [
              { name: "Do zrobienia", colorHex: "#64748B", order: 0 },
              { name: "W trakcie", colorHex: "#F59E0B", order: 1 },
              { name: "Testy", colorHex: "#3B82F6", order: 2 },
              { name: "Done", colorHex: "#10B981", order: 3 },
            ],
          },
          views: {
            create: [
              { type: ViewType.TABLE },
              { type: ViewType.KANBAN },
              { type: ViewType.ROADMAP },
            ],
          },
        },
      },
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    objectType: "Workspace",
    objectId: workspace.id,
    actorId: session.user.id,
    action: "workspace.created",
    diff: { name: workspace.name, slug: workspace.slug },
  });

  revalidatePath("/workspaces");
  redirect(`/w/${workspace.id}`);
}

export async function updateWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const parsed = updateWorkspaceSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "description") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.id, "workspace.updateSettings");

  const workspace = await db.workspace.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    objectType: "Workspace",
    objectId: workspace.id,
    actorId: ctx.userId,
    action: "workspace.updated",
    diff: { name: workspace.name },
  });

  revalidatePath(`/w/${workspace.id}/settings`);
  revalidatePath("/workspaces");
  return { ok: true, workspaceId: workspace.id, slug: workspace.slug };
}

export async function deleteWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const parsed = deleteWorkspaceSchema.safeParse({
    id: formData.get("id"),
    confirmName: formData.get("confirmName"),
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "confirmName") fe.confirmName = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.id, "workspace.delete");

  const workspace = await db.workspace.findUnique({ where: { id: parsed.data.id } });
  if (!workspace) return { ok: false, error: "Workspace nie istnieje." };

  if (parsed.data.confirmName.trim() !== workspace.name) {
    return {
      ok: false,
      fieldErrors: { confirmName: "Wpisz dokładną nazwę workspace'u aby potwierdzić." },
    };
  }

  await db.workspace.update({
    where: { id: workspace.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    workspaceId: workspace.id,
    objectType: "Workspace",
    objectId: workspace.id,
    actorId: ctx.userId,
    action: "workspace.deleted",
    diff: { name: workspace.name },
  });

  revalidatePath("/workspaces");
  redirect("/workspaces");
}
