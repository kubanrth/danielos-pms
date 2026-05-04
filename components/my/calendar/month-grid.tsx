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
  // F12-K31: kalendarz workspace'u miesza taski + custom WorkspaceEvent.
  // Klik tasku → nav do /t/<id> (Link). Klik eventu → callback (parent
  // otwiera dialog ze szczegółami). Default = "task" żeby /my/calendar
  // nie musiał ustawiać niczego.
  kind?: "task" | "event";
  // Raw entity id bez prefixu (poprzednie kody używały prefiksu
  // "task:<id>" / "event:<id>" w polu `id`, co rozwalało route'y bo
  // /t/task:<id> nie istnieje). To pole dostaje czysty id encji.
  entityId?: string;
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

export function CalendarMonthGrid({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  // F12-K31: parent może obsłużyć klik w event-kind (dialog ze
  // szczegółami WorkspaceEvent'u). Task-kind dalej linkuje przez <Link>.
  onEventClick?: (entityId: string) => void;
}) {
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
            className={`border-b border-border bg-muted/40 px-1.5 py-1.5 text-center font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground md:px-3 md:py-2 md:text-left md:text-[0.62rem] md:tracking-[0.16em] ${
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
          // F12-K47: mobile = max 2 visible events, reszta jako +N badge.
          const showOverflow = dayEvents.length > 2;

          return (
            <div
              key={i}
              className={`relative flex min-h-[72px] flex-col gap-0.5 border-b border-r border-border p-1 transition-colors md:min-h-[104px] md:gap-1 md:p-2 ${
                cell.inMonth ? "" : "bg-muted/20 text-muted-foreground/50"
              } ${isWeekend && cell.inMonth ? "bg-muted/5" : ""}`}
            >
              <div
                data-today={isToday ? "true" : "false"}
                className="font-mono text-[0.62rem] font-semibold data-[today=true]:text-primary md:text-[0.68rem]"
              >
                {isToday ? (
                  <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-primary text-[0.6rem] text-primary-foreground md:text-[0.66rem]">
                    {cell.date.getDate()}
                  </span>
                ) : (
                  cell.date.getDate()
                )}
              </div>
              {/* F12-K47: na mobile pokazujemy max 2 eventy (wcześniej 3) +
                  +N indicator — cells robi się czytelniejsze przy 50px szer. */}
              {dayEvents.slice(0, 2).map((ev) => {
                const isEvent = ev.kind === "event";
                // Fallback do `ev.id` (legacy callsites) gdyby nie ustawiono
                // entityId — usuwamy prefix "task:" / "event:" defensywnie.
                const rawId = ev.entityId ?? ev.id.replace(/^(task|event):/, "");
                const className =
                  "truncate rounded-sm px-1 py-0.5 text-left text-[0.55rem] font-medium transition-colors hover:brightness-95 md:px-1.5 md:text-[0.68rem]";
                const style = {
                  background: ev.statusColor
                    ? `${ev.statusColor}22`
                    : "var(--primary)/10",
                  color: ev.statusColor ?? "var(--primary)",
                };
                if (isEvent) {
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onEventClick?.(rawId)}
                      title={`${ev.title} — ${ev.workspaceName} / ${ev.boardName}`}
                      className={className}
                      style={style}
                    >
                      {ev.title}
                    </button>
                  );
                }
                return (
                  <Link
                    key={ev.id}
                    href={`/w/${ev.workspaceId}/t/${rawId}`}
                    title={`${ev.title} — ${ev.workspaceName} / ${ev.boardName}`}
                    className={className}
                    style={style}
                  >
                    {ev.title}
                  </Link>
                );
              })}
              {showOverflow && (
                <span className="px-1 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground md:text-[0.6rem]">
                  +{dayEvents.length - 2}
                  <span className="hidden md:inline"> więcej</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
