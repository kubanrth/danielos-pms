import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface SuperAdminSession {
  userId: string;
  email: string;
}

// Gate for every admin route + server action. Redirects unauthenticated
// callers to login, and regular members back to /workspaces (don't leak
// the admin namespace's existence to non-admins).
export async function requireSuperAdmin(): Promise<SuperAdminSession> {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  // Re-read from DB — the session flag is cached in the JWT, but a demoted
  // super admin should be kicked immediately, not at next token rotation.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isSuperAdmin: true, isBanned: true, deletedAt: true },
  });
  if (!user || user.isBanned || user.deletedAt) redirect("/secure-access-portal");
  if (!user.isSuperAdmin) redirect("/workspaces");

  return { userId: user.id, email: user.email };
}
