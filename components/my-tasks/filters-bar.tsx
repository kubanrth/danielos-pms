"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

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

        <select
          value={sort}
          onChange={(e) => changeSort(e.target.value as SortMode)}
          className="h-9 rounded-lg border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
        >
          {Object.entries(SORT_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>

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
