"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, LineChart, Circle } from "lucide-react";
import {
  assignTaskToMilestoneAction,
  deleteMilestoneAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { MilestoneDialog, type MilestoneMember } from "@/components/roadmap/milestone-dialog";
import {
  assignRows,
  colorFor,
  computeTimelineRange,
  formatDateRange,
  pctFor,
} from "@/components/roadmap/timeline-utils";

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

type Mode = "timeline" | "markers";

export function RoadmapView({
  workspaceId,
  boardId,
  members,
  milestones,
  canCreate,
  canUpdate,
  canDelete,
  initialMode = "timeline",
}: {
  workspaceId: string;
  boardId: string;
  members: MilestoneMember[];
  milestones: MilestoneItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
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

  const range = useMemo(() => computeTimelineRange(milestones, now), [milestones, now]);
  const rowMap = useMemo(() => assignRows(milestones), [milestones]);
  const rowCount = Math.max(1, ...[...rowMap.values()].map((n) => n + 1));
  const chartHeight = rowCount * ROW_HEIGHT + 2 * TRACK_PADDING_Y;

  const todayInRange = now >= range.rangeStart && now <= range.rangeStop;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
            {milestones.length} {milestones.length === 1 ? "milestone" : "milestones"}
          </span>
          {/* Mode toggle — pill group. Keeps the list view regardless. */}
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-sm">
            <ModeButton
              active={mode === "timeline"}
              onClick={() => setMode("timeline")}
              icon={<LineChart size={12} />}
              label="Oś czasu"
            />
            <ModeButton
              active={mode === "markers"}
              onClick={() => setMode("markers")}
              icon={<Circle size={12} />}
              label="Kropki"
            />
          </div>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-4 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus size={14} /> Nowy milestone
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur">
        {/* Time axis */}
        <div className="relative mb-3 h-5 border-b border-border">
          {range.ticks.map((t) => (
            <div
              key={t.ts}
              className="absolute -top-0.5 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pctFor(t.ts, range)}%` }}
            >
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                {t.label}
              </span>
            </div>
          ))}
        </div>

        {mode === "timeline" ? (
          <TimelineTrack
            range={range}
            milestones={milestones}
            rowMap={rowMap}
            chartHeight={chartHeight}
            todayInRange={todayInRange}
            now={now}
            canUpdate={canUpdate}
            onEdit={(m) => setDialog({ mode: "edit", milestone: m })}
          />
        ) : (
          <MarkersTrack
            range={range}
            milestones={milestones}
            todayInRange={todayInRange}
            now={now}
            canUpdate={canUpdate}
            onEdit={(m) => setDialog({ mode: "edit", milestone: m })}
          />
        )}
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
                      {formatDateRange(m.startAt, m.stopAt)} · {m.taskCount}{" "}
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

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "true" : "false"}
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:text-foreground data-[active=true]:hover:text-primary-foreground"
    >
      {icon} {label}
    </button>
  );
}

function TimelineTrack({
  range,
  milestones,
  rowMap,
  chartHeight,
  todayInRange,
  now,
  canUpdate,
  onEdit,
}: {
  range: ReturnType<typeof computeTimelineRange>;
  milestones: MilestoneItem[];
  rowMap: Map<string, number>;
  chartHeight: number;
  todayInRange: boolean;
  now: number;
  canUpdate: boolean;
  onEdit: (m: MilestoneItem) => void;
}) {
  return (
    <div
      className="relative w-full"
      style={{ height: chartHeight, paddingTop: TRACK_PADDING_Y, paddingBottom: TRACK_PADDING_Y }}
    >
      {range.ticks.map((t) => (
        <div
          key={t.ts}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/60"
          style={{ left: `${pctFor(t.ts, range)}%` }}
          aria-hidden
        />
      ))}

      {todayInRange && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-primary/60"
            style={{ left: `${pctFor(now, range)}%` }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-full bg-primary px-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground"
            style={{ left: `${pctFor(now, range)}%` }}
          >
            Dziś
          </span>
        </>
      )}

      {milestones.map((m) => {
        const row = rowMap.get(m.id) ?? 0;
        const start = new Date(m.startAt).getTime();
        const stop = new Date(m.stopAt).getTime();
        const left = pctFor(start, range);
        const width = Math.max(pctFor(stop, range) - left, 0.8);
        const color = colorFor(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => canUpdate && onEdit(m)}
            disabled={!canUpdate}
            className="group absolute flex items-center gap-2 rounded-md px-2 py-1 text-left text-[0.78rem] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-[transform,opacity] duration-200 hover:-translate-y-[1px] disabled:cursor-default"
            style={{
              top: TRACK_PADDING_Y + row * ROW_HEIGHT,
              left: `${left}%`,
              width: `${width}%`,
              height: ROW_HEIGHT - 8,
              background: `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 70%, white))`,
            }}
            title={`${m.title} · ${formatDateRange(m.startAt, m.stopAt)}`}
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
  );
}

// Markers: each milestone is a circle at the midpoint of its date range,
// sitting on the axis. Underneath: title + small pill with task count.
// Circles never overlap horizontally perfectly (same start+stop would
// collapse) — if two share a midpoint, we nudge them left/right using
// the same greedy row algorithm collapsed to two rows (upper/lower).
function MarkersTrack({
  range,
  milestones,
  todayInRange,
  now,
  canUpdate,
  onEdit,
}: {
  range: ReturnType<typeof computeTimelineRange>;
  milestones: MilestoneItem[];
  todayInRange: boolean;
  now: number;
  canUpdate: boolean;
  onEdit: (m: MilestoneItem) => void;
}) {
  const MARKER_HEIGHT = 120;
  // Pack markers into up-to-2 rows to avoid dot-on-dot collisions.
  const rows = useMemo(() => {
    const m2 = [...milestones]
      .map((m) => ({
        id: m.id,
        mid: (new Date(m.startAt).getTime() + new Date(m.stopAt).getTime()) / 2,
      }))
      .sort((a, b) => a.mid - b.mid);
    const MIN_GAP = (range.rangeStop - range.rangeStart) * 0.04; // 4% of axis
    const lastMidPerRow: number[] = [];
    const out = new Map<string, number>();
    for (const m of m2) {
      let placed = false;
      for (let i = 0; i < lastMidPerRow.length; i++) {
        if (m.mid - lastMidPerRow[i] >= MIN_GAP) {
          lastMidPerRow[i] = m.mid;
          out.set(m.id, i);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // cap at 2 rows; overflow collapses into row 1 (visually overlaps
        // slightly, still clickable)
        const row = Math.min(lastMidPerRow.length, 1);
        out.set(m.id, row);
        if (lastMidPerRow.length < 2) lastMidPerRow.push(m.mid);
        else lastMidPerRow[1] = m.mid;
      }
    }
    return out;
  }, [milestones, range]);

  return (
    <div
      className="relative w-full"
      style={{ height: MARKER_HEIGHT, paddingTop: 20 }}
    >
      {/* Month gridlines — same as timeline */}
      {range.ticks.map((t) => (
        <div
          key={t.ts}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/60"
          style={{ left: `${pctFor(t.ts, range)}%` }}
          aria-hidden
        />
      ))}

      {/* Horizontal baseline */}
      <div className="pointer-events-none absolute left-0 right-0 top-[40px] h-px bg-border" aria-hidden />

      {todayInRange && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-primary/60"
            style={{ left: `${pctFor(now, range)}%` }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-full bg-primary px-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground"
            style={{ left: `${pctFor(now, range)}%` }}
          >
            Dziś
          </span>
        </>
      )}

      {milestones.map((m) => {
        const mid = (new Date(m.startAt).getTime() + new Date(m.stopAt).getTime()) / 2;
        const left = pctFor(mid, range);
        const color = colorFor(m.id);
        const row = rows.get(m.id) ?? 0; // 0 = above line, 1 = below
        const circleTop = row === 0 ? 20 : 50;
        const labelTop = row === 0 ? 64 : 94;
        const title = m.title.length > 18 ? m.title.slice(0, 17) + "…" : m.title;
        return (
          <div
            key={m.id}
            className="absolute -translate-x-1/2"
            style={{ left: `${left}%`, top: 0, width: 120 }}
          >
            <button
              type="button"
              onClick={() => canUpdate && onEdit(m)}
              disabled={!canUpdate}
              aria-label={`${m.title}, ${formatDateRange(m.startAt, m.stopAt)}`}
              title={`${m.title} · ${formatDateRange(m.startAt, m.stopAt)} · ${m.taskCount} ${m.taskCount === 1 ? "zadanie" : "zadań"}`}
              className="absolute left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full text-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default"
              style={{
                top: circleTop,
                background: `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 70%, white))`,
              }}
            >
              <span className="font-mono text-[0.64rem] font-bold">{m.taskCount}</span>
            </button>
            <div
              className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 text-center"
              style={{ top: labelTop, width: 120 }}
            >
              <span className="truncate font-display text-[0.74rem] font-semibold tracking-[-0.01em]">
                {title}
              </span>
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-muted-foreground">
                {formatDateRange(m.startAt, m.stopAt)}
              </span>
            </div>
          </div>
        );
      })}

      {milestones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-display text-[0.92rem] text-muted-foreground">
            Brak milestones. Dodaj pierwszy, żeby zobaczyć kropki.
          </p>
        </div>
      )}
    </div>
  );
}

