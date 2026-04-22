"use client";

// Date+time picker used across Task modal + Milestone dialog. Replaces
// the native `<input type="datetime-local">` which renders differently
// on every OS. Uses react-day-picker for the calendar grid (plus
// keyboard nav, ARIA) and two `<select>` for hour/minute because the
// native number inputs look worse than selects on desktop + mobile.
//
// Emits a hidden `<input name={name}>` with an ISO string (or "" when
// cleared) so existing Server Actions receive the same shape they did
// before the swap.

import "react-day-picker/style.css";
import { useId, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { DayPicker } from "react-day-picker";
import { pl } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";

export interface DateTimePickerProps {
  name: string;
  defaultValue: string | null;
  disabled?: boolean;
  // Visible placeholder when no value is selected.
  placeholder?: string;
  // aria-label for the trigger button.
  label?: string;
}

function parseInitial(iso: string | null): { date: Date | null; hh: number; mm: number } {
  if (!iso) return { date: null, hh: 9, mm: 0 };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, hh: 9, mm: 0 };
  // Round minute down to nearest 5 so the select has a matching option.
  const mm = Math.floor(d.getMinutes() / 5) * 5;
  return { date: d, hh: d.getHours(), mm };
}

function formatDisplay(date: Date | null, hh: number, mm: number): string {
  if (!date) return "";
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function combineToIso(date: Date | null, hh: number, mm: number): string {
  if (!date) return "";
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export function DateTimePicker({
  name,
  defaultValue,
  disabled,
  placeholder = "Wybierz datę",
  label,
}: DateTimePickerProps) {
  const initial = parseInitial(defaultValue);
  const [date, setDate] = useState<Date | null>(initial.date);
  const [hh, setHh] = useState(initial.hh);
  const [mm, setMm] = useState(initial.mm);
  const [open, setOpen] = useState(false);
  const fieldId = useId();

  const iso = combineToIso(date, hh, mm);
  const display = formatDisplay(date, hh, mm);

  return (
    <div className="flex flex-col gap-1.5">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          disabled={disabled}
          aria-label={label ?? placeholder}
          id={fieldId}
          className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-[0.88rem] transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 data-[popup-open]:border-primary"
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon size={14} className="shrink-0 text-muted-foreground" />
            <span className={display ? "" : "text-muted-foreground"}>
              {display || placeholder}
            </span>
          </span>
          {date && !disabled && (
            <button
              type="button"
              aria-label="Wyczyść datę"
              title="Wyczyść"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDate(null);
              }}
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X size={12} />
            </button>
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6}>
            <Popover.Popup className="z-[70] rounded-lg border border-border bg-popover p-3 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.22)]">
              <DayPicker
                mode="single"
                locale={pl}
                weekStartsOn={1}
                selected={date ?? undefined}
                onSelect={(d) => {
                  if (d) setDate(d);
                }}
                showOutsideDays
                classNames={{
                  root: "rdp-root",
                  day: "rdp-day",
                  selected: "rdp-selected",
                  today: "rdp-today",
                  chevron: "rdp-chevron",
                }}
              />
              <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
                    Godzina
                  </span>
                  <div className="flex items-center gap-1">
                    <select
                      aria-label="Godzina"
                      value={hh}
                      onChange={(e) => setHh(Number(e.target.value))}
                      className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[0.82rem] outline-none focus:border-primary"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <span className="text-muted-foreground">:</span>
                    <select
                      aria-label="Minuta"
                      value={mm}
                      onChange={(e) => setMm(Number(e.target.value))}
                      className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[0.82rem] outline-none focus:border-primary"
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                        <option key={m} value={m}>
                          {m.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      // "Today" = local today at the current hh/mm.
                      const d = new Date();
                      d.setHours(0, 0, 0, 0);
                      setDate(d);
                    }}
                    className="h-8 rounded-md border border-border bg-background px-3 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Dziś
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-8 rounded-md bg-brand-gradient px-3 font-sans text-[0.78rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90"
                  >
                    Gotowe
                  </button>
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <input type="hidden" name={name} value={iso} />
      {/* Minimal scoped styling for react-day-picker v9 — the lib ships
          with sensible defaults that we overlay lightly to match our
          brand palette + border-radius tokens. */}
      <style>{`
        .rdp-root { --rdp-accent-color: var(--primary); --rdp-accent-background-color: color-mix(in oklch, var(--primary) 14%, transparent); font-family: inherit; }
        .rdp-day { border-radius: 8px; }
        .rdp-selected { background: var(--primary); color: var(--primary-foreground); font-weight: 600; }
        .rdp-today:not(.rdp-selected) { color: var(--primary); font-weight: 600; }
        .rdp-chevron { fill: var(--foreground); }
      `}</style>
    </div>
  );
}
