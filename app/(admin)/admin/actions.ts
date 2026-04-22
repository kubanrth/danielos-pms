"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { writeAdminAudit } from "@/lib/admin-audit";

// ── Users ─────────────────────────────────────────────────────────
export async function toggleUserBanAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Safety: never let an admin ban themselves out of the panel.
  if (id === admin.userId) return;

  const user = await db.user.findUnique({
    where: { id },
    select: { isBanned: true, email: true },
  });
  if (!user) return;

  await db.user.update({
    where: { id },
    data: { isBanned: !user.isBanned },
  });

  // Banning kills open sessions so the user's tabs get bounced at the
  // next auth callback. Unbanning leaves current sessions alone.
  if (!user.isBanned) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: user.isBanned ? "user.unbanned" : "user.banned",
    targetType: "User",
    targetId: id,
    targetLabel: user.email,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}

export async function softDeleteUserAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (id === admin.userId) return; // no self-delete

  const user = await db.user.findUnique({
    where: { id },
    select: { deletedAt: true, email: true },
  });
  if (!user || user.deletedAt) return;

  // Mask the email so a fresh signup can reclaim the address. We do NOT
  // hard-delete because FKs (audit entries, authored comments/tasks)
  // reference the user.
  const masked = `deleted-${id}@danielos.local`;
  await db.$transaction([
    db.user.update({
      where: { id },
      data: { deletedAt: new Date(), email: masked, isBanned: true },
    }),
    db.session.deleteMany({ where: { userId: id } }),
  ]);

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "user.deleted",
    targetType: "User",
    targetId: id,
    targetLabel: user.email,
    diff: { maskedTo: masked },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}

// ── Workspaces ────────────────────────────────────────────────────
export async function forceDeleteWorkspaceAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const ws = await db.workspace.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  });
  if (!ws) return;

  // Write audit BEFORE the delete — AdminAuditLog doesn't FK to
  // Workspace so it would survive anyway, but ordering the audit
  // first means the trail never misses an action even on a rare
  // mid-delete crash.
  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "workspace.forceDeleted",
    targetType: "Workspace",
    targetId: id,
    targetLabel: `${ws.name} (/${ws.slug})`,
  });

  // Hard delete — Prisma cascades handle memberships, boards, tasks,
  // comments, attachments, audit entries scoped to this workspaceId.
  await db.workspace.delete({ where: { id } });

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}

export async function restoreWorkspaceAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const ws = await db.workspace.findUnique({
    where: { id },
    select: { deletedAt: true, name: true, slug: true },
  });
  if (!ws || !ws.deletedAt) return;

  await db.workspace.update({
    where: { id },
    data: { deletedAt: null },
  });

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "workspace.restored",
    targetType: "Workspace",
    targetId: id,
    targetLabel: `${ws.name} (/${ws.slug})`,
  });

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}
