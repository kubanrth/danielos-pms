import type { ReactNode } from "react";

// Shared outer shell for every sidebar-driven page that isn't a board
// view (Inbox, My Tasks, TO DO, Calendar, Workspaces, Wiki, Workspace
// overview). Guarantees identical viewport width + padding so content
// doesn't shift when the user jumps between them.
//
// Board-view pages use `<BoardShell>` instead, which is wider
// (max-w-[1400px]) to fit Kanban + Gantt.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 px-8 py-12 md:px-14 md:py-16">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}
