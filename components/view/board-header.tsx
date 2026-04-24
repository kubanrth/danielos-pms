import type { ReactNode } from "react";
import { ViewSwitcher, type ViewName } from "@/components/view/view-switcher";

// Unified board header: title + optional description + ViewSwitcher + right-
// side actions slot. Typography and spacing are fixed so all 5 views look
// identical above the fold.
export function BoardHeader({
  workspaceId,
  boardId,
  board,
  active,
  enabledViews,
  actions,
  extra,
}: {
  workspaceId: string;
  boardId: string;
  board: { name: string; description?: string | null };
  active: ViewName;
  enabledViews?: ViewName[];
  // Right-aligned toolbar (BackgroundCustomizer, CreateTaskButton, etc.)
  actions?: ReactNode;
  // Optional sub-row under title/description (e.g. BoardLinks).
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em]">
          {board.name}
        </h2>
        {board.description && (
          <p className="text-[0.9rem] leading-[1.55] text-muted-foreground">
            {board.description}
          </p>
        )}
        {extra}
        <ViewSwitcher
          workspaceId={workspaceId}
          boardId={boardId}
          active={active}
          enabled={enabledViews}
        />
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
