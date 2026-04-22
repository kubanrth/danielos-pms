"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";

// Admin actions don't write to AuditLog — that table FKs to Workspace and
// these operations are cross-workspace. A dedicated AdminAuditLog is on
// the F7b list; for now, the UI surface is small and the super-admin is
// trusted. Destructive ops log to console so server tails have a record.

function logAdmin(adminEmail: string, action: string, target: string): void {
  console.log(`[admin] ${adminEmail} ${action} ${target}`);
}

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

  logAdmin(admin.email, user.isBanned ? "unbanned" : "banned", user.email);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
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

  logAdmin(admin.email, "deleted user", user.email);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
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

  // Hard delete — Prisma cascades handle memberships, boards, tasks,
  // comments, attachments, audit entries scoped to this workspaceId.
  await db.workspace.delete({ where: { id } });

  logAdmin(admin.email, "force-deleted workspace", `${ws.name} (${ws.slug})`);

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
}

export async function restoreWorkspaceAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const ws = await db.workspace.findUnique({
    where: { id },
    select: { deletedAt: true, name: true },
  });
  if (!ws || !ws.deletedAt) return;

  await db.workspace.update({
    where: { id },
    data: { deletedAt: null },
  });

  logAdmin(admin.email, "restored workspace", ws.name);

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
}
