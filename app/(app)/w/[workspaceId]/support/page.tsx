import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { SupportWorkspace } from "@/components/support/support-workspace";

// F11-20 (#23): support module — internal helpdesk for the workspace.
// Klient zażądał osobnej tabeli zgłoszeń, podobnej do Przypomnień.
// Każdy member może zgłosić; admini (task.update perm) mogą obsłużyć.

export default async function SupportPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [tickets, members] = await Promise.all([
    db.supportTicket.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <SupportWorkspace
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canManage={can(ctx.role, "task.update")}
      tickets={tickets.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt.toISOString(),
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
        reporter: {
          id: t.reporter.id,
          name: t.reporter.name,
          email: t.reporter.email,
        },
        assignee: t.assignee
          ? {
              id: t.assignee.id,
              name: t.assignee.name,
              email: t.assignee.email,
            }
          : null,
      }))}
      members={members.map((m) => m.user)}
    />
  );
}
