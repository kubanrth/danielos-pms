"use client";

// F12-K40: per-task time tracking — UI dla 3 stanów (idle / running /
// completed). Klient: 'do każdego zadania muszę dodać start/stop'.
//
// - Idle:      pokaz akumulowany czas + przycisk 'Rozpocznij'
// - Running:   live ticker (1s interval) + 'Zatrzymaj' + 'Zakończ'
// - Completed: pokaz finalny czas, brak przycisków, badge "Zakończono"

import { startTransition, useEffect, useState } from "react";
import { CheckCircle2, Pause, Play, Timer } from "lucide-react";
import {
  completeTaskTimerAction,
  pauseTaskTimerAction,
  startTaskTimerAction,
} from "@/app/(app)/w/[workspaceId]/t/timer-actions";

export interface TaskTimerProps {
  taskId: string;
  // Tyle sekund nazbierało się z poprzednich sesji.
  accumulatedSeconds: number;
  // ISO string — jeśli set, timer chodzi od tego momentu.
  startedAt: string | null;
  // ISO string — jeśli set, task zakończony.
  completedAt: string | null;
  canEdit: boolean;
}

export function TaskTimer({
  taskId,
  accumulatedSeconds,
  startedAt,
  completedAt,
  canEdit,
}: TaskTimerProps) {
  // Live elapsed (running). Re-render co 1s przez state hook'a.
  const [now, setNow] = useState(() => Date.now());

  const isRunning = !!startedAt && !completedAt;
  const isCompleted = !!completedAt;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsedNow = startedAt
    ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
    : 0;
  const totalSeconds = accumulatedSeconds + (isRunning ? elapsedNow : 0);

  const handleSubmit = (
    action: typeof startTaskTimerAction,
  ) => {
    return (fd: FormData) => startTransition(() => action(fd));
  };

  return (
    <section className="flex flex-col gap-3">
      <span className="eyebrow inline-flex items-center gap-1.5">
        <Timer size={11} />
        Czas pracy
      </span>
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
        data-running={isRunning ? "true" : "false"}
        data-completed={isCompleted ? "true" : "false"}
      >
        <div className="flex flex-col gap-0.5">
          <span
            className={`font-mono text-[1.6rem] font-semibold tabular-nums leading-none tracking-[-0.02em] ${
              isCompleted
                ? "text-muted-foreground"
                : isRunning
                  ? "text-primary"
                  : "text-foreground"
            }`}
          >
            {formatDuration(totalSeconds)}
          </span>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            {isCompleted
              ? `Zakończono ${formatRelative(completedAt!)}`
              : isRunning
                ? "Trwa…"
                : accumulatedSeconds > 0
                  ? "Zatrzymano"
                  : "Nie rozpoczęto"}
          </span>
        </div>

        {canEdit && !isCompleted && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!isRunning && (
              <form
                action={handleSubmit(startTaskTimerAction)}
                className="m-0"
              >
                <input type="hidden" name="id" value={taskId} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
                >
                  <Play size={13} fill="currentColor" />
                  Rozpocznij zadanie
                </button>
              </form>
            )}
            {isRunning && (
              <>
                <form
                  action={handleSubmit(pauseTaskTimerAction)}
                  className="m-0"
                >
                  <input type="hidden" name="id" value={taskId} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-4 font-sans text-[0.86rem] font-semibold text-foreground transition-colors hover:border-primary/60"
                  >
                    <Pause size={13} />
                    Zatrzymaj
                  </button>
                </form>
                <form
                  action={handleSubmit(completeTaskTimerAction)}
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        "Zakończyć zadanie? Zegar zostanie zablokowany.",
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className="m-0"
                >
                  <input type="hidden" name="id" value={taskId} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 font-sans text-[0.86rem] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                  >
                    <CheckCircle2 size={13} />
                    Zakończ zadanie
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {isCompleted && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={12} />
            Zakończone
          </span>
        )}
      </div>
    </section>
  );
}

// HH:MM:SS jeśli >= 1h, inaczej MM:SS.
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.round((Date.now() - then) / 1000);
  if (diff < 60) return "przed chwilą";
  if (diff < 60 * 60) return `${Math.round(diff / 60)} min temu`;
  if (diff < 60 * 60 * 24) return `${Math.round(diff / 3600)} godz. temu`;
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
