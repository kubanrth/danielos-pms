"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  useAssignHotkey,
  type AssignMember,
} from "@/components/task/assign-hotkey";

export interface TaskListRow {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  boardName: string;
  status: { name: string; colorHex: string } | null;
  tags: { id: string; name: string; colorHex: string }[];
  stopAt: string | null;
  assigneeIds: string[];
}

export interface TaskListSection {
  key: string;
  label: string;
  accent: "destructive" | "primary" | "muted" | "none";
  rows: TaskListRow[];
}

// F9-13 extension: wraps the My Tasks render in a hotkey-aware client
// component so hovering a row + pressing M opens the assign menu.
// Buckets / flat list mode handled by the `sections` structure.
export function HotkeyTaskList({
  members,
  sections,
  emptyState,
}: {
  members: AssignMember[];
  sections: TaskListSection[];
  emptyState: ReactNode;
}) {
  // The hook doesn't actually need a workspaceId to function — it's
  // passed through unchanged but toggleAssigneeAction infers workspace
  // from the task. Empty string is fine; the action does the lookup.
  const assign = useAssignHotkey({ members, workspaceId: "" });

  const anyRows = sections.some((s) => s.rows.length > 0);

  return (
    <>
      {anyRows ? (
        sections.map((section) =>
          section.rows.length === 0 ? null : (
            <Section
              key={section.key}
              label={section.label}
              accent={section.accent}
              rows={section.rows}
              rowProps={assign.rowProps}
            />
          ),
        )
      ) : (
        emptyState
      )}
      {assign.menu}
    </>
  );
}

function Section({
  label,
  accent,
  rows,
  rowProps,
}: {
  label: string;
  accent: TaskListSection["accent"];
  rows: TaskListRow[];
  rowProps: ReturnType<typeof useAssignHotkey>["rowProps"];
}) {
  const accentClass =
    accent === "destructive"
      ? "text-destructive"
      : accent === "primary"
        ? "text-primary"
        : "text-muted-foreground";

  const header =
    accent === "none" ? null : (
      <div className="flex items-baseline gap-3">
        <h2 className={`eyebrow ${accentClass}`}>{label}</h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {rows.length}
        </span>
      </div>
    );

  const list = (
    <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-border last:border-b-0">
          <TaskRow row={row} {...rowProps(row.id, row.assigneeIds)} />
        </li>
      ))}
    </ul>
  );

  if (!header) return <>{list}</>;
  return (
    <section className="flex flex-col gap-3">
      {header}
      {list}
    </section>
  );
}

function TaskRow({
  row,
  onMouseEnter,
  onMouseLeave,
}: {
  row: TaskListRow;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <Link
      href={`/w/${row.workspaceId}/t/${row.id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {row.status && (
            <span
              className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] font-semibold"
              style={{
                color: row.status.colorHex,
                background: `${row.status.colorHex}22`,
              }}
            >
              {row.status.name}
            </span>
          )}
          {row.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
              style={{ background: `${tag.colorHex}1A`, color: tag.colorHex }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tag.colorHex }} />
              {tag.name}
            </span>
          ))}
        </div>
        <span className="truncate font-display text-[0.98rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
          {row.title}
        </span>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {row.workspaceName} · /{row.boardName}
        </span>
      </div>
      {row.stopAt && (
        <span className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
          {new Date(row.stopAt).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "short",
          })}
        </span>
      )}
    </Link>
  );
}
