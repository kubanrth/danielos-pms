"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";

// URL-synced workspace filter for the personal calendar. Mirrors the MS
// Outlook calendar filter UX: one dropdown with "All" on top + the list
// of workspaces the user is a member of.
export function CalendarWorkspaceFilter({
  workspaces,
  selected,
}: {
  workspaces: { id: string; name: string }[];
  selected: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (val: string) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (val === "all") next.delete("workspace");
    else next.set("workspace", val);
    router.replace(next.toString() ? `?${next.toString()}` : "?");
    setOpen(false);
  };

  const activeLabel =
    selected === "all"
      ? "Wszystkie przestrzenie"
      : workspaces.find((w) => w.id === selected)?.name ?? "Przestrzeń";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <Layers size={12} className="text-muted-foreground" />
        <span className="max-w-[180px] truncate">{activeLabel}</span>
        <ChevronDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-[320px] w-[260px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)]"
        >
          <Option
            active={selected === "all"}
            label="Wszystkie przestrzenie"
            onClick={() => pick("all")}
            emphasis
          />
          {workspaces.length > 0 && (
            <li
              aria-hidden
              className="my-1 border-t border-border"
              role="separator"
            />
          )}
          {workspaces.map((w) => (
            <Option
              key={w.id}
              active={selected === w.id}
              label={w.name}
              onClick={() => pick(w.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Option({
  active,
  label,
  onClick,
  emphasis,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={active}
        onClick={onClick}
        data-active={active ? "true" : "false"}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[0.72rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-foreground ${
          emphasis ? "font-semibold" : ""
        }`}
      >
        <span className="flex-1 truncate normal-case tracking-normal">{label}</span>
        {active && <Check size={12} className="text-primary" />}
      </button>
    </li>
  );
}
