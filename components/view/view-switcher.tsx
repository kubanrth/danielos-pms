"use client";

import Link from "next/link";
import { Table2, KanbanSquare, GitBranch, BarChart3 } from "lucide-react";

export type ViewName = "table" | "kanban" | "roadmap" | "gantt";

interface ViewDescriptor {
  name: ViewName;
  label: string;
  icon: React.ReactNode;
  path: string;
}

// Single source of truth for the four board-level views. Pills render
// left-to-right in this order on every page. Whiteboard is NOT here —
// it's a workspace-level resource, linked from the workspace overview.
export function ViewSwitcher({
  workspaceId,
  boardId,
  active,
}: {
  workspaceId: string;
  boardId: string;
  active: ViewName;
}) {
  const views: ViewDescriptor[] = [
    {
      name: "table",
      label: "Tabela",
      icon: <Table2 size={14} />,
      path: `/w/${workspaceId}/b/${boardId}/table`,
    },
    {
      name: "kanban",
      label: "Kanban",
      icon: <KanbanSquare size={14} />,
      path: `/w/${workspaceId}/b/${boardId}/kanban`,
    },
    {
      name: "roadmap",
      label: "Roadmapa",
      icon: <GitBranch size={14} />,
      path: `/w/${workspaceId}/b/${boardId}/roadmap`,
    },
    {
      name: "gantt",
      label: "Gantt",
      icon: <BarChart3 size={14} />,
      path: `/w/${workspaceId}/b/${boardId}/gantt`,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Widoki tablicy"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm"
    >
      {views.map((v) => {
        const isActive = v.name === active;
        return (
          <Link
            key={v.name}
            href={v.path}
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? "true" : "false"}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-sans text-[0.82rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground"
          >
            {v.icon}
            <span>{v.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
