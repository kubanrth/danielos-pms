"use client";

import { startTransition, useState } from "react";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import {
  createWorkspaceEventAction,
  deleteWorkspaceEventAction,
} from "@/app/(app)/w/[workspaceId]/calendar/actions";
import {
  CalendarMonthGrid,
  type CalendarEvent,
} from "@/components/my/calendar/month-grid";

export interface WorkspaceCalendarTask {
  id: string;
  title: string;
  startAt: string | null;
  stopAt: string | null;
  statusName: string | null;
  statusColor: string | null;
  boardName: string;
}

export interface WorkspaceCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  creatorName: string;
}

const PALETTE = [
  "#7B68EE", "#10B981", "#F59E0B", "#EF4444",
  "#3B82F6", "#EC4899", "#14B8A6", "#64748B",
];

export function WorkspaceCalendar({
  workspaceId,
  tasks,
  events,
}: {
  workspaceId: string;
  tasks: WorkspaceCalendarTask[];
  events: WorkspaceCalendarEvent[];
}) {
  const [showEventForm, setShowEventForm] = useState(false);

  // Merge tasks + events into a single CalendarEvent list for MonthGrid.
  // Events use their `color` as statusColor so the existing renderer
  // colors them correctly. Tasks keep their status color.
  const merged: CalendarEvent[] = [
    ...tasks.map((t) => ({
      id: `task:${t.id}`,
      title: t.title,
      workspaceId,
      workspaceName: t.boardName,
      boardName: t.boardName,
      statusColor: t.statusColor,
      startAt: t.startAt,
      stopAt: t.stopAt,
    })),
    ...events.map((e) => ({
      id: `event:${e.id}`,
      title: `📅 ${e.title}`,
      workspaceId,
      workspaceName: "Wydarzenie",
      boardName: e.creatorName,
      statusColor: e.color,
      startAt: e.startAt,
      stopAt: e.endAt,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEventForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-3 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
        >
          <Plus size={13} /> {showEventForm ? "Zwiń" : "Nowe wydarzenie"}
        </button>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {tasks.length} zadań · {events.length} wydarzeń
        </span>
      </div>

      {showEventForm && (
        <NewEventForm
          workspaceId={workspaceId}
          onDone={() => setShowEventForm(false)}
        />
      )}

      <CalendarMonthGrid events={merged} />

      {events.length > 0 && (
        <EventsList events={events} />
      )}
    </div>
  );
}

function NewEventForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [color, setColor] = useState(PALETTE[0]);
  const [allDay, setAllDay] = useState(false);
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createWorkspaceEventAction(fd);
          onDone();
        })
      }
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="color" value={color} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Tytuł</span>
          <input
            name="title"
            required
            autoFocus
            maxLength={200}
            placeholder="np. Spotkanie z klientem"
            className="h-9 rounded-md border border-border bg-background px-2 text-[0.88rem] outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Start</span>
          <input
            name="startAt"
            type="datetime-local"
            required
            className="h-9 rounded-md border border-border bg-background px-2 font-mono text-[0.78rem] outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Koniec</span>
          <input
            name="endAt"
            type="datetime-local"
            required
            className="h-9 rounded-md border border-border bg-background px-2 font-mono text-[0.78rem] outline-none focus:border-primary"
          />
        </div>
        <label className="flex items-center gap-1.5 self-end pb-1 text-[0.78rem] text-muted-foreground">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
          cały dzień
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Opis (opcjonalny)</span>
        <textarea
          name="description"
          rows={2}
          maxLength={2000}
          className="resize-none rounded-md border border-border bg-background p-2 text-[0.86rem] outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="eyebrow mr-2">Kolor:</span>
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Kolor ${c}`}
            className="h-5 w-5 rounded-full ring-1 ring-foreground/10 transition-transform hover:scale-110"
            style={{
              background: c,
              outline: color === c ? "2px solid var(--foreground)" : "none",
              outlineOffset: color === c ? 2 : 0,
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
        >
          Utwórz wydarzenie
        </button>
      </div>
    </form>
  );
}

function EventsList({ events }: { events: WorkspaceCalendarEvent[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-primary">Nadchodzące wydarzenia</h2>
      <ul className="flex flex-col gap-1.5">
        {events.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </ul>
    </section>
  );
}

function EventRow({ event }: { event: WorkspaceCalendarEvent }) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white"
        style={{ background: event.color }}
        aria-hidden
      >
        <CalendarIcon size={14} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-[0.92rem] font-semibold leading-tight tracking-[-0.01em]">
          {event.title}
        </span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          {event.allDay
            ? `${start.toLocaleDateString("pl-PL")} (cały dzień)`
            : `${start.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })} → ${end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`}
          {" · "}
          {event.creatorName}
        </span>
      </div>
      <form
        action={(fd) =>
          startTransition(async () => {
            if (!confirm(`Usunąć "${event.title}"?`)) return;
            await deleteWorkspaceEventAction(fd);
          })
        }
        className="m-0"
      >
        <input type="hidden" name="id" value={event.id} />
        <button
          type="submit"
          aria-label="Usuń"
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={13} />
        </button>
      </form>
    </li>
  );
}
