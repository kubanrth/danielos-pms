// F12-K8: per-board access gate. Runs once for every /b/[boardId]/*
// route (table, kanban, roadmap, gantt, whiteboard, custom views).
// requireBoardAccess() does:
//   - workspace membership check (404 if missing — same UX as before)
//   - workspace ADMIN bypass
//   - PUBLIC board → allow any workspace member
//   - PRIVATE board → require BoardMembership row, else 404
//
// Child pages still call their own data queries (this layout only
// gatekeeps; doesn't fetch anything UI-relevant).

import { requireBoardAccess } from "@/lib/workspace-guard";

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  await requireBoardAccess(workspaceId, boardId);
  return children;
}
