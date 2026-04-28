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
import { PortalDropdown } from "@/components/ui/portal-dropdown";

type Rule = { freq: "daily" | "weekly" | "monthly"; day?: number };

const WEEKDAYS = ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."];

type Freq = "none" | "daily" | "weekly" | "monthly";

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

  // F12-K30: PortalDropdown zamiast natywnego <select>. Trzy oddzielne
  // dropdowny: freq → opcjonalnie weekday/monthday. Sentinel string'i
  // dla numeric day'a, żeby działało z generycznym typem PortalDropdown.
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="eyebrow inline-flex items-center gap-1.5">
        <Repeat size={11} />
        Powtarzaj
      </span>
      <PortalDropdown<Freq>
        ariaLabel="Częstotliwość powtarzania"
        disabled={disabled}
        width={200}
        value={draft?.freq ?? "none"}
        onChange={(v) => {
          if (v === "none") return persist(null);
          if (v === "daily") return persist({ freq: "daily" });
          if (v === "weekly")
            return persist({ freq: "weekly", day: draft?.day ?? 1 });
          if (v === "monthly")
            return persist({ freq: "monthly", day: draft?.day ?? 1 });
        }}
        options={[
          { value: "none", label: "— nigdy —" },
          { value: "daily", label: "Codziennie" },
          { value: "weekly", label: "Co tydzień" },
          { value: "monthly", label: "Co miesiąc" },
        ]}
      />

      {draft?.freq === "weekly" && (
        <PortalDropdown<string>
          ariaLabel="Dzień tygodnia"
          disabled={disabled}
          width={180}
          value={String(draft.day ?? 1)}
          onChange={(v) => persist({ freq: "weekly", day: Number(v) })}
          options={WEEKDAYS.map((d, i) => ({
            value: String(i),
            label: d,
          }))}
        />
      )}

      {draft?.freq === "monthly" && (
        <PortalDropdown<string>
          ariaLabel="Dzień miesiąca"
          disabled={disabled}
          width={140}
          value={String(draft.day ?? 1)}
          onChange={(v) => persist({ freq: "monthly", day: Number(v) })}
          options={Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({
            value: String(d),
            label: `${d}. dnia`,
          }))}
        />
      )}

      {draft && (
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
          {summary} · cron 00:05 UTC
        </span>
      )}
    </div>
  );
}
