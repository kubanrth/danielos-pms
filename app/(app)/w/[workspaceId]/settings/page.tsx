import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import {
  DeleteWorkspaceForm,
  UpdateWorkspaceForm,
} from "@/components/workspaces/workspace-settings-forms";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  if (!can(ctx.role, "workspace.updateSettings")) notFound();

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) notFound();

  const canDelete = can(ctx.role, "workspace.delete");

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-12">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Ustawienia ogólne</span>
          <h2 className="font-display text-[1.6rem] leading-[1.15] tracking-[-0.02em]">
            Podstawowe informacje
          </h2>
          <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
            Zmiany są widoczne dla wszystkich członków przestrzeni.
          </p>
        </div>
        <UpdateWorkspaceForm
          workspaceId={workspace.id}
          initialName={workspace.name}
          initialDescription={workspace.description}
        />
      </section>

      {canDelete && (
        <section className="flex flex-col gap-5 border-t border-border pt-10">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow text-destructive">Strefa niebezpieczna</span>
            <h2 className="font-display text-[1.3rem] leading-[1.15] tracking-[-0.02em]">
              Usuń przestrzeń roboczą
            </h2>
          </div>
          <DeleteWorkspaceForm
            workspaceId={workspace.id}
            workspaceName={workspace.name}
          />
        </section>
      )}
    </div>
  );
}
