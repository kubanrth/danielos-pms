"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, List as ListIcon } from "lucide-react";

const STORAGE_KEY = "danielos.workspaces.layout";

export type WorkspacesLayout = "grid" | "list";

// Thin client wrapper that toggles between the two pre-rendered views
// supplied as children. Keeps all data-fetching on the server. User
// preference persists in localStorage across sessions.
export function WorkspacesLayoutToggle({
  grid,
  list,
}: {
  grid: ReactNode;
  list: ReactNode;
}) {
  // Initialize directly from localStorage so we don't need a post-mount
  // setState (the lint rule that fires on setState-in-effect is correct:
  // it causes an extra render and a visible flash).
  const [layout, setLayout] = useState<WorkspacesLayout>(() => {
    if (typeof window === "undefined") return "grid";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "list" || stored === "grid" ? stored : "grid";
    } catch {
      return "grid";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, layout);
    } catch {
      /* noop */
    }
  }, [layout]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          Widok
        </span>
        <div
          role="tablist"
          className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-sm"
        >
          <ToggleButton
            active={layout === "grid"}
            onClick={() => setLayout("grid")}
            label="Kafelki"
            icon={<LayoutGrid size={12} />}
          />
          <ToggleButton
            active={layout === "list"}
            onClick={() => setLayout("list")}
            label="Lista"
            icon={<ListIcon size={12} />}
          />
        </div>
      </div>
      {layout === "grid" ? grid : list}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-active={active ? "true" : "false"}
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:text-foreground"
    >
      {icon}
      {label}
    </button>
  );
}
