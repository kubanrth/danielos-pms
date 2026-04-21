import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import type { SidebarWorkspace } from "@/components/layout/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  // Fetch all workspaces the user belongs to, plus their boards (for sidebar accordion).
  const memberships = await db.workspaceMembership.findMany({
    where: { userId: session.user.id, workspace: { deletedAt: null } },
    include: {
      workspace: {
        include: {
          boards: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const workspaces: SidebarWorkspace[] = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
    boards: m.workspace.boards,
  }));

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        user={{
          id: session.user.id,
          email: session.user.email ?? "",
          name: session.user.name ?? null,
          avatarUrl: session.user.image ?? null,
          isSuperAdmin: session.user.isSuperAdmin,
        }}
        workspaces={workspaces}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
