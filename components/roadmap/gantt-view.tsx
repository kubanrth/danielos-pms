"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  assignRows,
  computeTimelineRange,
  formatDateRange,
  pctFor,
} from "@/components/roadmap/timeline-utils";
import { taskPl } from "@/lib/pluralize";

export interface GanttTaskItem {
  id: string;
  title: string;
  startAt: string | null;
  stopAt: string | null;
  statusColor: string;
  statusName: string | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export interface GanttUnscheduledItem {
  id: string;
  title: string;
}

const ROW_HEIGHT = 34;
const TRACK_PADDING_Y = 18;

export function GanttView({
  workspaceId,
  scheduled,
  unscheduled,
}: {
  workspaceId: string;
  scheduled: GanttTaskItem[];
  unscheduled: GanttUnscheduledItem[];
}) {
  const [now] = useState(() => Date.now());

  const timelineItems = useMemo(
    () =>
      scheduled
        .filter(
          (t): t is GanttTaskItem & { startAt: string; stopAt: string } =>
            !!t.startAt && !!t.stopAt,
        )
        .map((t) => ({ id: t.id, startAt: t.startAt, stopAt: t.stopAt })),
    [scheduled],
  );
  const range = useMemo(
    () => computeTimelineRange(timelineItems, now),
    [timelineItems, now],
  );
  const rowMap = useMemo(() => assignRows(timelineItems), [timelineItems]);
  const rowCount = Math.max(1, ...[...rowMap.values()].map((n) => n + 1));
  const chartHeight = rowCount * ROW_HEIGHT + 2 * TRACK_PADDING_Y;
  const todayInRange = now >= range.rangeStart && now <= range.rangeStop;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          {timelineItems.length} {taskPl(timelineItems.length)} z datami
        </span>
      </div>

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

        <div
          className="relative w-full"
          style={{
            height: chartHeight,
            paddingTop: TRACK_PADDING_Y,
            paddingBottom: TRACK_PADDING_Y,
          }}
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

          {scheduled
            .filter(
              (t): t is GanttTaskItem & { startAt: string; stopAt: string } =>
                !!t.startAt && !!t.stopAt,
            )
            .map((t) => {
              const row = rowMap.get(t.id) ?? 0;
              const start = new Date(t.startAt).getTime();
              const stop = new Date(t.stopAt).getTime();
              const left = pctFor(start, range);
              const width = Math.max(pctFor(stop, range) - left, 0.8);
              const initials = t.assignee
                ? (t.assignee.name ?? t.assignee.email).slice(0, 2).toUpperCase()
                : null;
              return (
                <Link
                  key={t.id}
                  href={`/w/${workspaceId}/t/${t.id}`}
                  className="group absolute flex items-center gap-2 rounded-md px-2 py-1 text-[0.76rem] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  style={{
                    top: TRACK_PADDING_Y + row * ROW_HEIGHT,
                    left: `${left}%`,
                    width: `${width}%`,
                    height: ROW_HEIGHT - 8,
                    background: `color-mix(in oklch, ${t.statusColor} 35%, var(--background))`,
                    borderLeft: `3px solid ${t.statusColor}`,
                    color: "var(--foreground)",
                  }}
                  title={`${t.title} · ${formatDateRange(t.startAt, t.stopAt)}${t.statusName ? ` · ${t.statusName}` : ""}`}
                >
                  <span className="truncate">{t.title}</span>
                  {initials && (
                    <span
                      className="ml-auto grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.54rem] font-bold text-white"
                      aria-label={t.assignee?.name ?? t.assignee?.email}
                    >
                      {t.assignee?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.assignee.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </span>
                  )}
                </Link>
              );
            })}

          {timelineItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-display text-[0.92rem] text-muted-foreground">
                Brak zadań z datami. Ustaw Start + Koniec w modal&apos;u zadania.
              </p>
            </div>
          )}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <h3 className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            Bez dat ({unscheduled.length})
          </h3>
          <p className="mb-3 text-[0.82rem] text-muted-foreground">
            Te zadania nie są widoczne na Gantcie. Otwórz modal zadania i ustaw Start + Koniec.
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {unscheduled.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/w/${workspaceId}/t/${t.id}`}
                  className="block truncate rounded-md border border-border bg-background px-3 py-1.5 text-[0.84rem] transition-colors hover:border-primary/60 hover:text-primary"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
