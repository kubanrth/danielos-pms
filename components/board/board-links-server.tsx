import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { LinkFolders, type LinkFolderData } from "@/components/board/link-folders";

// Server wrapper that fetches every link folder on the board + its
// columns/rows/cells, then renders the LinkFolders client component.
// Every board page drops this into the BoardHeader `extra` slot.
export async function BoardLinksServer({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const ctx = await requireWorkspaceMembership(workspaceId);
  const folders = await db.linkFolder.findMany({
    where: { boardId },
    orderBy: { order: "asc" },
    include: {
      columns: { orderBy: { order: "asc" } },
      rows: {
        orderBy: { order: "asc" },
        include: { cells: true },
      },
    },
  });

  const data: LinkFolderData[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    columns: f.columns.map((c) => ({ id: c.id, name: c.name })),
    rows: f.rows.map((r) => ({
      id: r.id,
      cells: Object.fromEntries(
        r.cells.map((cell) => [cell.columnId, cell.valueText ?? ""]),
      ),
    })),
  }));

  return (
    <LinkFolders
      workspaceId={workspaceId}
      boardId={boardId}
      folders={data}
      canManage={can(ctx.role, "boardLink.manage")}
    />
  );
}
