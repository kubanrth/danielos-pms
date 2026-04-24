"use client";

import { startTransition } from "react";
import Link from "next/link";
import {
  Table2,
  KanbanSquare,
  GitBranch,
  BarChart3,
  Pencil,
  X,
} from "lucide-react";
import { deleteBoardViewAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";

export type ViewName = "table" | "kanban" | "roadmap" | "gantt" | "whiteboard";

interface ViewDescriptor {
  name: ViewName;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export interface CustomViewDescriptor {
  id: string;
  name: string;
  type: ViewName;
  path: string;
}

export const ALL_VIEWS: ViewName[] = ["table", "kanban", "roadmap", "gantt", "whiteboard"];

// Maps `ViewType` enum values (DB) to the lowercase ViewName used in URLs
// and in Workspace.enabledViews JSON. Kept here so callers only pass
// lowercase names.
export function viewTypeToName(type: string): ViewName | null {
  switch (type.toUpperCase()) {
    case "TABLE":
      return "table";
    case "KANBAN":
      return "kanban";
    case "ROADMAP":
      return "roadmap";
    case "GANTT":
      return "gantt";
    case "WHITEBOARD":
      return "whiteboard";
    default:
      return null;
  }
}

const DEFAULT_ICONS: Record<ViewName, React.ReactNode> = {
  table: <Table2 size={14} />,
  kanban: <KanbanSquare size={14} />,
  roadmap: <GitBranch size={14} />,
  gantt: <BarChart3 size={14} />,
  whiteboard: <Pencil size={14} />,
};
const DEFAULT_LABELS: Record<ViewName, string> = {
  table: "Tabela",
  kanban: "Kanban",
  roadmap: "Roadmapa",
  gantt: "Gantt",
  whiteboard: "Whiteboard",
};

// Single source of truth for the five default board-level views + any
// number of user-created custom views. Pills render left-to-right:
// defaults first (in fixed order), then customs (insertion order).
export function ViewSwitcher({
  workspaceId,
  boardId,
  active,
  activeViewId,
  size = "md",
  enabled,
  customViews,
  canManage,
}: {
  workspaceId: string;
  boardId: string;
  // Active default view (undefined when the user is on a custom view).
  active?: ViewName;
  // Active custom view id, used for highlight instead of `active`.
  activeViewId?: string;
  size?: "sm" | "md";
  enabled?: ViewName[];
  customViews?: CustomViewDescriptor[];
  // Controls whether the delete-X on custom pills renders.
  canManage?: boolean;
}) {
  const allViews: ViewDescriptor[] = [
    {
      name: "table",
      label: "Tabela",
      icon: DEFAULT_ICONS.table,
      path: `/w/${workspaceId}/b/${boardId}/table`,
    },
    {
      name: "kanban",
      label: "Kanban",
      icon: DEFAULT_ICONS.kanban,
      path: `/w/${workspaceId}/b/${boardId}/kanban`,
    },
    {
      name: "roadmap",
      label: "Roadmapa",
      icon: DEFAULT_ICONS.roadmap,
      path: `/w/${workspaceId}/b/${boardId}/roadmap`,
    },
    {
      name: "gantt",
      label: "Gantt",
      icon: DEFAULT_ICONS.gantt,
      path: `/w/${workspaceId}/b/${boardId}/gantt`,
    },
    {
      name: "whiteboard",
      label: "Whiteboard",
      icon: DEFAULT_ICONS.whiteboard,
      path: `/w/${workspaceId}/b/${boardId}/whiteboard`,
    },
  ];

  const views = enabled
    ? allViews.filter((v) => enabled.includes(v.name))
    : allViews;

  const heightClass =
    size === "sm" ? "h-7 px-2.5 text-[0.76rem]" : "h-8 px-3 text-[0.82rem]";
  const containerPad = size === "sm" ? "p-0.5 gap-0.5" : "p-1 gap-1";

  return (
    <div
      role="tablist"
      aria-label="Widoki tablicy"
      className={`inline-flex items-center rounded-lg border border-border bg-card shadow-sm ${containerPad}`}
    >
      {views.map((v) => {
        const isActive = !activeViewId && v.name === active;
        return (
          <Link
            key={v.name}
            href={v.path}
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? "true" : "false"}
            className={`inline-flex items-center gap-1.5 rounded-md font-sans font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground ${heightClass}`}
          >
            {v.icon}
            <span>{v.label}</span>
          </Link>
        );
      })}

      {(customViews?.length ?? 0) > 0 && (
        <span
          aria-hidden
          className="mx-1 h-4 w-px bg-border"
          role="separator"
        />
      )}

      {customViews?.map((c) => {
        const isActive = activeViewId === c.id;
        return (
          <div key={c.id} className="group relative">
            <Link
              href={c.path}
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? "true" : "false"}
              className={`inline-flex items-center gap-1.5 rounded-md font-sans font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary ${heightClass} ${canManage ? "pr-6" : ""}`}
            >
              {DEFAULT_ICONS[c.type]}
              <span className="max-w-[160px] truncate">{c.name}</span>
            </Link>
            {canManage && (
              <form
                action={(fd) => startTransition(() => deleteBoardViewAction(fd))}
                className="m-0 absolute right-1 top-1/2 -translate-y-1/2"
              >
                <input type="hidden" name="viewId" value={c.id} />
                <button
                  type="submit"
                  aria-label={`Usuń widok ${c.name}`}
                  className="grid h-4 w-4 place-items-center rounded-sm text-current opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-data-[active=true]:text-primary-foreground"
                >
                  <X size={10} />
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Label for custom views in the ViewSwitcher pill.
export function defaultViewLabel(name: ViewName): string {
  return DEFAULT_LABELS[name];
}

// Parse Workspace.enabledViews (Json) into typed ViewName[]. Falls back
// to all views when the field is missing / malformed.
export function parseEnabledViews(raw: unknown): ViewName[] {
  if (!Array.isArray(raw)) return ALL_VIEWS;
  const out: ViewName[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const name = viewTypeToName(entry);
    if (name && !out.includes(name)) out.push(name);
  }
  return out.length > 0 ? out : ALL_VIEWS;
}
