"use client";

// Date+time picker — F11 (klient #17): native HTML5 datetime-local input.
// Wcześniejsza wersja używała base-ui Popover + react-day-picker, ale
// klient zgłosił że nie da się ustawić daty (popover się nie otwierał
// w niektórych browser-ach / edge case'ach). Switch na natywne — proste,
// szybkie, bez bibliotek, działa wszędzie.
//
// Emits a hidden `<input name={name}>` z ISO string (lub "" gdy puste)
// żeby Server Actions dostały tę samą formę co przedtem.

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";

export interface DateTimePickerProps {
  name: string;
  defaultValue: string | null;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}

// ISO → "YYYY-MM-DDTHH:mm" (local) for datetime-local input value.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Local "YYYY-MM-DDTHH:mm" → ISO. JS interprets the input as local time,
// toISOString() emits UTC — round-trip works because our action stores
// Date objects (timezone-independent millisecond stamps).
function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function formatDisplay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DateTimePicker({
  name,
  defaultValue,
  disabled,
  placeholder = "Wybierz datę",
  label,
}: DateTimePickerProps) {
  // Local state mirrors the datetime-local input. Emit ISO via hidden
  // input on each change so the parent <form> sees fresh value when
  // user clicks "Zapisz".
  const [local, setLocal] = useState<string>(() => isoToLocalInput(defaultValue));
  const iso = localInputToIso(local);
  const display = formatDisplay(iso);
  const empty = !iso;

  // Resync if defaultValue changes externally (e.g. parent re-fetches
  // task and passes new ISO). External-state sync is exactly the
  // useEffect contract — Compiler's heuristic doesn't distinguish.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(isoToLocalInput(defaultValue));
  }, [defaultValue]);

  return (
    <div className="relative flex items-center">
      <CalendarIcon
        size={14}
        className="pointer-events-none absolute left-3 text-muted-foreground"
        aria-hidden
      />
      <input
        type="datetime-local"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        disabled={disabled}
        aria-label={label ?? placeholder}
        // Show display label as a layered span when empty, else show
        // native value. Native picker UI handles the calendar widget.
        className={`h-10 w-full rounded-md border border-border bg-background pl-9 pr-10 text-[0.88rem] transition-colors hover:border-primary/60 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
          empty ? "text-transparent" : "text-foreground"
        }`}
      />
      {/* When empty we paint the placeholder over the (transparent) input
          text so users see "Brak daty końca" instead of dd/mm/yyyy. */}
      {empty && !disabled && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-9 text-[0.88rem] text-muted-foreground"
        >
          {placeholder}
        </span>
      )}
      {/* Read-only formatted display when value is set — covers the
          native dd/mm/yyyy with our pl-PL formatting. Click pass-through
          via pointer-events-none so the user can still open the picker. */}
      {!empty && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-9 right-10 truncate text-[0.88rem] text-foreground"
        >
          {display}
        </span>
      )}
      {!empty && !disabled && (
        <button
          type="button"
          onClick={() => setLocal("")}
          aria-label="Wyczyść datę"
          title="Wyczyść"
          className="absolute right-2 grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={12} />
        </button>
      )}
      <input type="hidden" name={name} value={iso} />
    </div>
  );
}
