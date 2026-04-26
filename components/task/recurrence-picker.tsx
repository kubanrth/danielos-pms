"use client";

// F11-17 (#24): recurrence rule picker for task detail. Klient zażądał
// "zadanie wchodzi każdego dnia miesiąca". Rule shape:
//   - daily: every day
//   - weekly: every week on `day` (0..6, Sun..Sat)
//   - monthly: every month on `day` (1..31, clamped to month length)
//
// On change, pushes the rule via setTaskRecurrenceAction. Server cron
// `/api/cron/spawn-recurring` runs daily at 00:05 UTC and creates
// instances of templates that match today's rule.

import { startTransition, useState } from "react";
import { Repeat } from "lucide-react";
import { setTaskRecurrenceAction } from "@/app/(app)/w/[workspaceId]/t/recurrence-actions";

type Rule = { freq: "daily" | "weekly" | "monthly"; day?: number };

const WEEKDAYS = ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."];

export function RecurrencePicker({
  taskId,
  rule,
  disabled,
}: {
  taskId: string;
  rule: Rule | null;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<Rule | null>(rule);

  const persist = (next: Rule | null) => {
    setDraft(next);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("rule", next ? JSON.stringify(next) : "");
    startTransition(() => setTaskRecurrenceAction(fd));
  };

  const summary = draft
    ? draft.freq === "daily"
      ? "Codziennie"
      : draft.freq === "weekly"
        ? `Co tydzień, ${WEEKDAYS[draft.day ?? 1]}`
        : `Co miesiąc, ${draft.day ?? 1}. dnia`
    : "Brak";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow inline-flex items-center gap-1">
        <Repeat size={11} />
        Powtarzaj
      </span>
      <select
        value={draft?.freq ?? "none"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "none") return persist(null);
          if (v === "daily") return persist({ freq: "daily" });
          if (v === "weekly") return persist({ freq: "weekly", day: draft?.day ?? 1 });
          if (v === "monthly") return persist({ freq: "monthly", day: draft?.day ?? 1 });
        }}
        disabled={disabled}
        className="h-8 rounded-full border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] outline-none focus:border-primary disabled:cursor-not-allowed"
      >
        <option value="none">— nigdy —</option>
        <option value="daily">codziennie</option>
        <option value="weekly">co tydzień</option>
        <option value="monthly">co miesiąc</option>
      </select>

      {draft?.freq === "weekly" && (
        <select
          value={draft.day ?? 1}
          onChange={(e) => persist({ freq: "weekly", day: Number(e.target.value) })}
          disabled={disabled}
          className="h-8 rounded-full border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] outline-none focus:border-primary disabled:cursor-not-allowed"
        >
          {WEEKDAYS.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
      )}

      {draft?.freq === "monthly" && (
        <select
          value={draft.day ?? 1}
          onChange={(e) => persist({ freq: "monthly", day: Number(e.target.value) })}
          disabled={disabled}
          className="h-8 rounded-full border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] outline-none focus:border-primary disabled:cursor-not-allowed"
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}.
            </option>
          ))}
        </select>
      )}

      {draft && (
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
          {summary} · cron 00:05 UTC
        </span>
      )}
    </div>
  );
}
