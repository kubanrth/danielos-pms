import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import type { SidebarWorkspace } from "@/components/layout/sidebar";
import { parseEnabledViews } from "@/lib/board-views";
import { ReminderPopups } from "@/components/reminders/reminder-popups";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  // Read fresh User to ensure sidebar avatar/name reflect recent profile changes
  // (JWT session is cached; DB is source of truth).
  const [user, memberships, unreadNotifs, dueReminders] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true, isSuperAdmin: true },
    }),
    db.workspaceMembership.findMany({
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
      // Note: we include workspace.enabledViews by virtue of `include:
      // workspace` above (full row).
      orderBy: { joinedAt: "asc" },
    }),
    db.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
    // Active reminder popups — due + not dismissed. Capped so a runaway
    // creator can't DoS the recipient's top-right corner.
    db.personalReminder.findMany({
      where: {
        recipientId: session.user.id,
        dueAt: { lte: new Date() },
        dismissedAt: null,
      },
      orderBy: { dueAt: "asc" },
      take: 5,
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);
  if (!user) redirect("/secure-access-portal");

  const workspaces: SidebarWorkspace[] = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
    boards: m.workspace.boards,
    // Map lowercase ViewName → uppercase ViewType expected by sidebar.
    enabledViews: parseEnabledViews(m.workspace.enabledViews).map((v) =>
      v.toUpperCase(),
    ) as SidebarWorkspace["enabledViews"],
  }));

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          isSuperAdmin: user.isSuperAdmin,
        }}
        workspaces={workspaces}
        unreadNotificationCount={unreadNotifs}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>

      <ReminderPopups
        initial={dueReminders.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          creatorName: r.creator.name ?? r.creator.email,
          isSelfAuthored: r.creator.id === session.user.id,
        }))}
      />
    </div>
  );
}
