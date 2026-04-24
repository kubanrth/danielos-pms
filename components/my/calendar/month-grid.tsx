"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CalendarEvent {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  boardName: string;
  statusColor: string | null;
  startAt: string | null;
  stopAt: string | null;
}

const PL_DAY_HEADERS = ["Pon", "Wt", "Śr", "Cz", "Pt", "Sob", "Niedz"];
const PL_MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

// Weekday index where Monday = 0, Sunday = 6.
function mondayFirstDow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// For an event with start & stop, return TRUE if given `day` falls in the
// inclusive range. Events with only stopAt (a deadline) render on stop day.
function eventSpansDay(ev: CalendarEvent, day: Date): boolean {
  const startRaw = ev.startAt ? new Date(ev.startAt) : null;
  const stopRaw = ev.stopAt ? new Date(ev.stopAt) : null;
  if (!startRaw && !stopRaw) return false;
  if (startRaw && stopRaw) {
    const start = new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate());
    const stop = new Date(stopRaw.getFullYear(), stopRaw.getMonth(), stopRaw.getDate());
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    return d.getTime() >= start.getTime() && d.getTime() <= stop.getTime();
  }
  const anchor = (stopRaw ?? startRaw)!;
  return sameDay(anchor, day);
}

export function CalendarMonthGrid({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const dowStart = mondayFirstDow(first);
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];

    // Prev month tail
    for (let i = dowStart - 1; i >= 0; i--) {
      cells.push({
        date: new Date(cursor.year, cursor.month, -i),
        inMonth: false,
      });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(cursor.year, cursor.month, d), inMonth: true });
    }
    // Pad to 6 weeks = 42 cells so grid height doesn't jump month-to-month.
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
    }
    return cells;
  }, [cursor]);

  const prev = () =>
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { year: c.year, month: c.month - 1 },
    );
  const next = () =>
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { year: c.year, month: c.month + 1 },
    );
  const jumpToday = () =>
    setCursor({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[1.4rem] font-semibold leading-tight tracking-[-0.02em]">
          {PL_MONTHS[cursor.month]}{" "}
          <span className="text-muted-foreground">{cursor.year}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prev}
            aria-label="Poprzedni miesiąc"
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={jumpToday}
            className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            dziś
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Następny miesiąc"
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border bg-card">
        {PL_DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`border-b border-border bg-muted/40 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground ${
              i >= 5 ? "text-primary/60" : ""
            }`}
          >
            {d}
          </div>
        ))}

        {grid.map((cell, i) => {
          const dayEvents = events.filter((e) => eventSpansDay(e, cell.date));
          const isToday = sameDay(cell.date, today);
          const isWeekend = mondayFirstDow(cell.date) >= 5;
          const showOverflow = dayEvents.length > 3;

          return (
            <div
              key={i}
              className={`relative flex min-h-[104px] flex-col gap-1 border-b border-r border-border p-2 transition-colors ${
                cell.inMonth ? "" : "bg-muted/20 text-muted-foreground/50"
              } ${isWeekend && cell.inMonth ? "bg-muted/5" : ""}`}
            >
              <div
                data-today={isToday ? "true" : "false"}
                className="font-mono text-[0.68rem] font-semibold data-[today=true]:text-primary"
              >
                {isToday ? (
                  <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-primary text-[0.66rem] text-primary-foreground">
                    {cell.date.getDate()}
                  </span>
                ) : (
                  cell.date.getDate()
                )}
              </div>
              {dayEvents.slice(0, 3).map((ev) => (
                <Link
                  key={ev.id}
                  href={`/w/${ev.workspaceId}/t/${ev.id}`}
                  title={`${ev.title} — ${ev.workspaceName} / ${ev.boardName}`}
                  className="truncate rounded-sm px-1.5 py-0.5 text-[0.68rem] font-medium transition-colors hover:brightness-95"
                  style={{
                    background: ev.statusColor
                      ? `${ev.statusColor}22`
                      : "var(--primary)/10",
                    color: ev.statusColor ?? "var(--primary)",
                  }}
                >
                  {ev.title}
                </Link>
              ))}
              {showOverflow && (
                <span className="px-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
                  +{dayEvents.length - 3} więcej
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
