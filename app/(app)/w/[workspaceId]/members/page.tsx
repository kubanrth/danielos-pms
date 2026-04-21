import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { InviteForm } from "@/components/members/invite-form";
import { MemberRow } from "@/components/members/member-row";
import { PendingInviteRow } from "@/components/members/pending-invite-row";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true, ownerId: true, name: true },
  });
  if (!workspace) notFound();

  const [memberships, invitations] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    db.invitation.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const canManage = can(ctx.role, "workspace.changeRole");
  const canRemove = can(ctx.role, "workspace.removeMember");
  const canInvite = can(ctx.role, "workspace.inviteMember");

  const origin =
    process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3100";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Członkowie</span>
        <h2 className="font-display text-[1.8rem] leading-[1.1] tracking-[-0.02em]">
          Kto pracuje w tej przestrzeni
        </h2>
        <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
          Admini mogą zapraszać nowych członków, zmieniać role i usuwać z
          przestrzeni. Viewer widzi wszystko, ale niczego nie edytuje.
        </p>
      </div>

      {canInvite && <InviteForm workspaceId={workspace.id} />}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-[1.2rem] leading-[1.15] tracking-[-0.02em]">
            Członkowie ({memberships.length})
          </h3>
        </div>
        <div className="flex flex-col border-t border-border">
          {memberships.map((m) => (
            <MemberRow
              key={m.id}
              workspaceId={workspace.id}
              membershipId={m.id}
              name={m.user.name}
              email={m.user.email}
              avatarUrl={m.user.avatarUrl}
              role={m.role}
              isSelf={m.userId === ctx.userId}
              isOwner={m.userId === workspace.ownerId}
              canManage={canManage}
              canRemove={canRemove}
            />
          ))}
        </div>
      </section>

      {invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-[1.2rem] leading-[1.15] tracking-[-0.02em]">
              Oczekujące zaproszenia ({invitations.length})
            </h3>
          </div>
          <div className="flex flex-col border-t border-border">
            {invitations.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                workspaceId={workspace.id}
                invitationId={inv.id}
                email={inv.email}
                role={inv.role}
                inviteUrl={`${origin}/invites/${inv.token}`}
                expiresAt={inv.expiresAt}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
