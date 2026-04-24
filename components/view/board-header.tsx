import type { ReactNode } from "react";
import {
  ViewSwitcher,
  type CustomViewDescriptor,
  type ViewName,
} from "@/components/view/view-switcher";

// Unified board header: title + optional description + ViewSwitcher + right-
// side actions slot. Typography and spacing are fixed so all 5 views look
// identical above the fold.
export function BoardHeader({
  workspaceId,
  boardId,
  board,
  active,
  activeViewId,
  enabledViews,
  customViews,
  canManageViews,
  createViewButton,
  actions,
  extra,
}: {
  workspaceId: string;
  boardId: string;
  board: { name: string; description?: string | null };
  active?: ViewName;
  activeViewId?: string;
  enabledViews?: ViewName[];
  customViews?: CustomViewDescriptor[];
  canManageViews?: boolean;
  createViewButton?: ReactNode;
  actions?: ReactNode;
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
        <div className="flex flex-wrap items-center">
          <ViewSwitcher
            workspaceId={workspaceId}
            boardId={boardId}
            active={active}
            activeViewId={activeViewId}
            enabled={enabledViews}
            customViews={customViews}
            canManage={canManageViews}
          />
          {createViewButton}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
