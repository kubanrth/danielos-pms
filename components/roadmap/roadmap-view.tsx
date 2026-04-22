"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  assignTaskToMilestoneAction,
  deleteMilestoneAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { MilestoneDialog, type MilestoneMember } from "@/components/roadmap/milestone-dialog";

export interface MilestoneItem {
  id: string;
  title: string;
  startAt: string;
  stopAt: string;
  assignee: MilestoneMember | null;
  taskCount: number;
  tasks: { id: string; title: string }[];
}

const ROW_HEIGHT = 36;
const TRACK_PADDING_Y = 18;
const DAY_MS = 24 * 60 * 60 * 1000;

// Pastel accent palette — each milestone gets a stable color derived from
// its id so re-orderings don't reshuffle hues across renders.
const PALETTE = [
  "#7B68EE",
  "#FF02F0",
  "#14B8A6",
  "#F59E0B",
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#8B5CF6",
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Greedy row assignment: sort by start, slot each milestone into the first
// track that has no overlap. Produces a Gantt-like stacking.
function assignRows(items: MilestoneItem[]): Map<string, number> {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const rowEnds: number[] = [];
  const rows = new Map<string, number>();
  for (const m of sorted) {
    const start = new Date(m.startAt).getTime();
    const stop = new Date(m.stopAt).getTime();
    let placed = false;
    for (let i = 0; i < rowEnds.length; i++) {
      if (rowEnds[i] <= start) {
        rowEnds[i] = stop;
        rows.set(m.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.set(m.id, rowEnds.length);
      rowEnds.push(stop);
    }
  }
  return rows;
}

export function RoadmapView({
  workspaceId,
  boardId,
  members,
  milestones,
  canCreate,
  canUpdate,
  canDelete,
}: {
  workspaceId: string;
  boardId: string;
  members: MilestoneMember[];
  milestones: MilestoneItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [dialog, setDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; milestone: MilestoneItem }
    | null
  >(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Stable "now" captured once at mount; avoids Date.now() during render,
  // which triggers react-hooks/purity. The "today" marker doesn't need to
  // tick live — a refresh is fine.
  const [now] = useState(() => Date.now());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Time range — widen by 10% padding so bars don't kiss the edges.
  const { rangeStart, rangeStop, ticks } = useMemo(() => {
    if (milestones.length === 0) {
      return {
        rangeStart: now - 7 * DAY_MS,
        rangeStop: now + 90 * DAY_MS,
        ticks: [],
      };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const m of milestones) {
      min = Math.min(min, new Date(m.startAt).getTime());
      max = Math.max(max, new Date(m.stopAt).getTime());
    }
    const span = max - min || DAY_MS;
    const pad = span * 0.08;
    const start = min - pad;
    const stop = max + pad;
    // Month ticks
    const t: { ts: number; label: string }[] = [];
    const d = new Date(start);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    while (d.getTime() <= stop) {
      t.push({
        ts: d.getTime(),
        label: d.toLocaleDateString("pl-PL", { month: "short", year: "2-digit" }),
      });
      d.setMonth(d.getMonth() + 1);
    }
    return { rangeStart: start, rangeStop: stop, ticks: t };
  }, [milestones, now]);

  const rowMap = useMemo(() => assignRows(milestones), [milestones]);
  const rowCount = Math.max(1, ...[...rowMap.values()].map((n) => n + 1));
  const chartHeight = rowCount * ROW_HEIGHT + 2 * TRACK_PADDING_Y;

  const pctFor = (ts: number) =>
    ((ts - rangeStart) / (rangeStop - rangeStart)) * 100;

  const todayInRange = now >= rangeStart && now <= rangeStop;

  return (
    <div className="flex flex-col gap-6">
      {canCreate && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
            {milestones.length} {milestones.length === 1 ? "milestone" : "milestones"}
          </span>
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-4 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus size={14} /> Nowy milestone
          </button>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur">
        {/* Time axis */}
        <div className="relative mb-3 h-5 border-b border-border">
          {ticks.map((t) => (
            <div
              key={t.ts}
              className="absolute -top-0.5 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pctFor(t.ts)}%` }}
            >
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                {t.label}
              </span>
            </div>
          ))}
        </div>

        {/* Bars track */}
        <div
          className="relative w-full"
          style={{ height: chartHeight, paddingTop: TRACK_PADDING_Y, paddingBottom: TRACK_PADDING_Y }}
        >
          {/* Vertical month gridlines */}
          {ticks.map((t) => (
            <div
              key={t.ts}
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/60"
              style={{ left: `${pctFor(t.ts)}%` }}
              aria-hidden
            />
          ))}

          {/* Today marker */}
          {todayInRange && (
            <>
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-primary/60"
                style={{ left: `${pctFor(now)}%` }}
                aria-hidden
              />
              <span
                className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-full bg-primary px-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground"
                style={{ left: `${pctFor(now)}%` }}
              >
                Dziś
              </span>
            </>
          )}

          {milestones.map((m) => {
            const row = rowMap.get(m.id) ?? 0;
            const start = new Date(m.startAt).getTime();
            const stop = new Date(m.stopAt).getTime();
            const left = pctFor(start);
            const width = Math.max(pctFor(stop) - left, 0.8);
            const color = colorFor(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => canUpdate && setDialog({ mode: "edit", milestone: m })}
                disabled={!canUpdate}
                className="group absolute flex items-center gap-2 rounded-md px-2 py-1 text-left text-[0.78rem] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-[transform,opacity] duration-200 hover:-translate-y-[1px] disabled:cursor-default"
                style={{
                  top: TRACK_PADDING_Y + row * ROW_HEIGHT,
                  left: `${left}%`,
                  width: `${width}%`,
                  height: ROW_HEIGHT - 8,
                  background: `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 70%, white))`,
                }}
                title={`${m.title} · ${formatRange(m.startAt, m.stopAt)}`}
              >
                <span className="truncate">{m.title}</span>
                <span className="shrink-0 rounded-full bg-white/25 px-1.5 font-mono text-[0.58rem] font-bold">
                  {m.taskCount}
                </span>
              </button>
            );
          })}

          {milestones.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-display text-[0.92rem] text-muted-foreground">
                Brak milestones. Dodaj pierwszy, żeby narysować oś czasu.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Per-milestone card list with expandable tasks */}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => {
            const isOpen = expanded.has(m.id);
            const color = colorFor(m.id);
            return (
              <li
                key={m.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-6 w-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={isOpen ? "Zwiń" : "Rozwiń"}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display text-[0.98rem] font-semibold tracking-[-0.01em]">
                      {m.title}
                    </span>
                    <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatRange(m.startAt, m.stopAt)} · {m.taskCount}{" "}
                      {m.taskCount === 1 ? "zadanie" : "zadań"}
                    </span>
                  </div>
                  {m.assignee && (
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.58rem] font-bold text-white"
                      title={m.assignee.name ?? m.assignee.email}
                    >
                      {(m.assignee.name ?? m.assignee.email).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: "edit", milestone: m })}
                      aria-label="Edytuj"
                      title="Edytuj"
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {canDelete && (
                    <form action={deleteMilestoneAction} className="m-0">
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        aria-label="Usuń"
                        title="Usuń"
                        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3">
                    {m.tasks.length === 0 ? (
                      <p className="text-[0.86rem] text-muted-foreground">
                        Brak zadań w tym milestone.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {m.tasks.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[0.88rem] transition-colors hover:bg-accent/60"
                          >
                            <Link
                              href={`/w/${workspaceId}/t/${t.id}`}
                              className="min-w-0 flex-1 truncate focus-visible:outline-none"
                            >
                              {t.title}
                            </Link>
                            <form action={assignTaskToMilestoneAction} className="m-0">
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="milestoneId" value="" />
                              <button
                                type="submit"
                                className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-destructive"
                                title="Odczep zadanie"
                              >
                                Odczep
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <MilestoneDialog
          workspaceId={workspaceId}
          boardId={boardId}
          members={members}
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.milestone : null}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function formatRange(startIso: string, stopIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
    });
  return `${fmt(startIso)} → ${fmt(stopIso)}`;
}
