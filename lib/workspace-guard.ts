import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertCan, type Action } from "@/lib/permissions";
import type { Role } from "@/lib/generated/prisma/enums";

export interface WorkspaceSession {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  workspaceId: string;
  role: Role;
}

// Require an authenticated session + workspace membership.
// Redirects to login if unauthenticated; calls notFound() if no membership
// (matches GitHub/Linear behavior — don't leak workspace existence).
export async function requireWorkspaceMembership(
  workspaceId: string,
): Promise<WorkspaceSession> {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  const membership = await db.workspaceMembership.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      workspace: { deletedAt: null },
    },
  });

  if (!membership) notFound();

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    isSuperAdmin: session.user.isSuperAdmin,
    workspaceId,
    role: membership.role,
  };
}

export async function requireWorkspaceAction(
  workspaceId: string,
  action: Action,
): Promise<WorkspaceSession> {
  const ctx = await requireWorkspaceMembership(workspaceId);
  assertCan(ctx.role, action);
  return ctx;
}
