"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  History,
  Search,
  X,
} from "lucide-react";

export interface BoardOption {
  id: string;
  name: string;
  workspaceName: string;
}

export type SortMode =
  | "updatedDesc"
  | "updatedAsc"
  | "dueAsc"
  | "dueDesc"
  | "createdAsc"
  | "createdDesc";

const SORT_LABELS: Record<SortMode, string> = {
  updatedDesc: "Ostatnio zmienione",
  updatedAsc: "Najdawniej zmienione",
  dueAsc: "Najbliższy termin",
  dueDesc: "Najdalszy termin",
  createdAsc: "Najstarsze",
  createdDesc: "Najnowsze",
};

const SORT_ICONS: Record<SortMode, typeof Clock> = {
  updatedDesc: Clock,
  updatedAsc: History,
  dueAsc: ArrowUp,
  dueDesc: ArrowDown,
  createdAsc: History,
  createdDesc: Clock,
};

// URL-synced filter bar. Each interaction writes shallow to the search
// params so reloads and shareable links preserve state.
export function FiltersBar({
  boards,
  initialSearch,
  initialBoardIds,
  initialSort,
}: {
  boards: BoardOption[];
  initialSearch: string;
  initialBoardIds: string[];
  initialSort: SortMode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(
    () => new Set(initialBoardIds),
  );
  const [sort, setSort] = useState<SortMode>(initialSort);

  const pushParams = useCallback(
    (mutator: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      mutator(next);
      router.replace(next.toString().length > 0 ? `?${next.toString()}` : "?");
    },
    [params, router],
  );

  // Debounced search — avoid a router push on every keystroke.
  useEffect(() => {
    if (search === initialSearch) return;
    const id = setTimeout(() => {
      pushParams((p) => {
        if (search.trim()) p.set("search", search.trim());
        else p.delete("search");
      });
    }, 240);
    return () => clearTimeout(id);
  }, [search, initialSearch, pushParams]);

  const toggleBoard = (id: string) => {
    setSelectedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      pushParams((p) => {
        if (next.size === 0) p.delete("boardIds");
        else p.set("boardIds", Array.from(next).join(","));
      });
      return next;
    });
  };

  const changeSort = (s: SortMode) => {
    setSort(s);
    pushParams((p) => {
      if (s === "updatedDesc") p.delete("sort");
      else p.set("sort", s);
    });
  };

  const clearAll = () => {
    setSearch("");
    setSelectedBoards(new Set());
    setSort("updatedDesc");
    router.replace("?");
  };

  const activeCount = useMemo(() => {
    let n = 0;
    if (search.trim()) n += 1;
    if (selectedBoards.size > 0) n += 1;
    if (sort !== "updatedDesc") n += 1;
    return n;
  }, [search, selectedBoards.size, sort]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder="Szukaj po tytule…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-[0.9rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </div>

        <SortDropdown current={sort} onPick={(next) => changeSort(next)} />

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
          >
            <X size={12} /> wyczyść ({activeCount})
          </button>
        )}
      </div>

      {boards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            Tablica:
          </span>
          {boards.map((b) => {
            const on = selectedBoards.has(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBoard(b.id)}
                data-on={on ? "true" : "false"}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-3 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors data-[on=true]:border-primary data-[on=true]:bg-primary/10 data-[on=true]:text-foreground hover:border-primary/40"
              >
                <span className="truncate max-w-[140px]">{b.name}</span>
                <span className="text-muted-foreground/60 normal-case tracking-normal">
                  · {b.workspaceName}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Custom sort dropdown — replaces the native <select> so the look matches
// the rest of the app (rounded pill button + animated chevron + menu
// with per-option icon and checkmark on the active item).
function SortDropdown({
  current,
  onPick,
}: {
  current: SortMode;
  onPick: (v: SortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const CurrentIcon = SORT_ICONS[current];

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <CurrentIcon size={12} className="text-muted-foreground" />
        <span>{SORT_LABELS[current]}</span>
        <ChevronDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[220px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)]"
        >
          {(Object.entries(SORT_LABELS) as [SortMode, string][]).map(([k, label]) => {
            const Icon = SORT_ICONS[k];
            const active = k === current;
            return (
              <li key={k}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onPick(k);
                    setOpen(false);
                  }}
                  data-active={active ? "true" : "false"}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[0.72rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
                >
                  <Icon
                    size={12}
                    className={active ? "text-primary" : "text-muted-foreground"}
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {active && <Check size={12} className="text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
