import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardLinks } from "@/components/board/board-links";

// Server wrapper for BoardLinks. Every board page drops this into the
// BoardHeader `extra` slot — keeps board pages slim and the query local.
export async function BoardLinksServer({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const ctx = await requireWorkspaceMembership(workspaceId);
  const links = await db.boardLink.findMany({
    where: { boardId },
    orderBy: { order: "asc" },
  });

  return (
    <BoardLinks
      workspaceId={workspaceId}
      boardId={boardId}
      canManage={can(ctx.role, "boardLink.manage")}
      links={links.map((l) => ({
        id: l.id,
        url: l.url,
        label: l.label,
        kind: l.kind,
      }))}
    />
  );
}
