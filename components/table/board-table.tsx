"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnOrderState,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Plus, Search, X } from "lucide-react";
import {
  createTableColumnAction,
  saveTableColumnPrefsAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import {
  bulkDeleteTasksAction,
  bulkUpdateStatusAction,
  createTaskAction,
} from "@/app/(app)/w/[workspaceId]/t/actions";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { taskPl } from "@/lib/pluralize";
import { ColumnSettings, type ColumnDef } from "@/components/table/column-settings";
import { FieldCell } from "@/components/table/field-cells";
import { TableHeaderCell } from "@/components/table/header-cell";
import { FieldOptionsEditor, FieldTypePicker } from "@/components/table/field-config";
import { StatusPicker } from "@/components/table/status-picker";
import { parseFieldOptions, type FieldOptions, type FieldType } from "@/lib/table-fields";
import {
  TableFiltersToolbar,
  type ToolbarColumnRef,
} from "@/components/table/table-filters-toolbar";
import {
  compareValues,
  matchesFilter,
  type TableFilter,
  type TableSort,
} from "@/lib/table-filters";
import { saveTableFiltersAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import {
  useAssignHotkey,
  type AssignMember,
} from "@/components/task/assign-hotkey";

export interface BoardTableTask {
  id: string;
  title: string;
  statusColumnId: string | null;
  startAt: string | null;
  stopAt: string | null;
  assignees: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }[];
  tags: { id: string; name: string; colorHex: string }[];
  // F9-07: user-defined column values, keyed by custom column id.
  customValues: Record<string, string>;
}

export interface BoardTableColumn {
  id: string;
  name: string;
  colorHex: string;
}

export interface CustomTableColumn {
  id: string;
  name: string;
  type: FieldType;
  // F10-A: type-specific config (select options, number format, etc.)
  // Plain JSON object — parseFieldOptions tolerates anything.
  options: unknown;
}

const col = createColumnHelper<BoardTableTask>();

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Canonical column ids used by both the table and the settings popover.
// Kept here so there's one source of truth — re-order these to change the
// factory-default layout for brand-new boards.
const DEFAULT_COLUMN_ORDER: string[] = [
  "statusColumnId",
  "title",
  "assignees",
  "tags",
  "startAt",
  "stopAt",
];

// F11-6 (#12): klient zażądał możliwości ukrywania defaultowych kolumn
// (Status, Tytuł). Wcześniej `required: true` zablokowało eye-toggle.
// Teraz wszystkie kolumny mogą być ukryte; tworzą się automatycznie
// jak board jest świeży.
const COLUMN_DEFS: ColumnDef[] = [
  { id: "statusColumnId", label: "Status" },
  { id: "title", label: "Tytuł" },
  { id: "assignees", label: "Osoby" },
  { id: "tags", label: "Tagi" },
  { id: "startAt", label: "Start" },
  { id: "stopAt", label: "Koniec" },
];

export function BoardTable({
  workspaceId,
  boardId,
  statusColumns,
  tasks,
  canEdit,
  canManagePrefs,
  initialColumnOrder,
  initialHiddenColumns,
  initialFilters,
  initialSort,
  initialGroupBy,
  initialWidths,
  customColumns,
  members,
}: {
  workspaceId: string;
  boardId: string;
  statusColumns: BoardTableColumn[];
  tasks: BoardTableTask[];
  canEdit: boolean;
  canManagePrefs: boolean;
  initialColumnOrder?: string[];
  initialHiddenColumns?: string[];
  // F10-B: persisted filter / sort / group state from BoardView.configJson.
  initialFilters?: TableFilter[];
  initialSort?: TableSort | null;
  initialGroupBy?: string | null;
  // F10-X: persisted per-column pixel widths.
  initialWidths?: Record<string, number>;
  customColumns: CustomTableColumn[];
  // F9-13: needed for the `M` assign hotkey.
  members: AssignMember[];
}) {
  const assign = useAssignHotkey({ members, workspaceId });
  const [sorting, setSorting] = useState<SortingState>([]);
  const customIds = useMemo(
    () => customColumns.map((c) => `custom:${c.id}`),
    [customColumns],
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    const knownIds = new Set([...DEFAULT_COLUMN_ORDER, ...customIds]);
    // Server-persisted order wins for known ids; unknown / legacy ids
    // stripped. Missing built-ins and brand-new custom columns appended
    // at the tail.
    if (initialColumnOrder && initialColumnOrder.length > 0) {
      const retained = initialColumnOrder.filter((id) => knownIds.has(id));
      const retainedSet = new Set(retained);
      return [
        ...retained,
        ...DEFAULT_COLUMN_ORDER.filter((id) => !retainedSet.has(id)),
        ...customIds.filter((id) => !retainedSet.has(id)),
      ];
    }
    return [...DEFAULT_COLUMN_ORDER, ...customIds];
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const vis: VisibilityState = {};
    for (const id of DEFAULT_COLUMN_ORDER) {
      vis[id] = !(initialHiddenColumns ?? []).includes(id);
    }
    for (const id of customIds) {
      vis[id] = !(initialHiddenColumns ?? []).includes(id);
    }
    return vis;
  });
  useWorkspaceRealtime(workspaceId);

  // F10-X T2.2: multi-select row state. TanStack handles toggles via
  // checkbox onChange; shift-click range selection is implemented
  // manually because TanStack doesn't ship that out of the box.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const lastClickedRowRef = useRef<string | null>(null);
  const extendSelection = (toId: string) => {
    if (!lastClickedRowRef.current) return;
    const fromId = lastClickedRowRef.current;
    const ids = filteredSorted.map((t) => t.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [a, b] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    setRowSelection((prev) => {
      const next = { ...prev };
      for (let i = a; i <= b; i++) next[ids[i]] = true;
      return next;
    });
  };

  // F10-X: persisted per-column widths. TanStack tracks live drag state;
  // we persist to the server when the user releases the drag handle.
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    () => initialWidths ?? {},
  );
  // Skip the first-render no-op write — initial state already matches
  // what's on the server, no point round-tripping.
  const sizingDirty = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!canManagePrefs) return;
    if (!sizingDirty.current) {
      sizingDirty.current = true;
      return;
    }
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("boardId", boardId);
      fd.set("config", JSON.stringify({ widths: columnSizing }));
      startTransition(() => {
        saveTableColumnPrefsAction(fd);
      });
    }, 250);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [columnSizing, workspaceId, boardId, canManagePrefs]);

  // F10-B: filter / sort / group state. Persisted on BoardView.configJson
  // by the toolbar's onChange — we apply them client-side over `tasks`
  // so realtime patches keep working.
  const [filters, setFilters] = useState<TableFilter[]>(initialFilters ?? []);
  const [tableSort, setTableSort] = useState<TableSort | null>(initialSort ?? null);
  const [groupBy, setGroupBy] = useState<string | null>(initialGroupBy ?? null);

  // F10-X T2.3: in-table search. Cmd+F (Ctrl+F) opens an input that
  // narrows rows by substring across title + every custom cell.
  // Server-side filters (F10-B) still apply on top — the search is
  // a UI-only refinement, never persisted.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // F10-X T2.1: keyboard navigation. We track the active cell as
  // [rowIdx, colIdx] indices over the visible row + column lists. Arrow
  // keys move the active cell, Enter focuses the first focusable element
  // inside (input/select/button) so the user can immediately type.
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        // Focus on next tick — input must mount first.
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Reusable persist for filter/sort/groupBy — used by the toolbar AND
  // by header-cell context menu actions. Keeps the server in sync when
  // user sorts/filters from the per-column menu instead of the toolbar.
  const persistFilters = (next: {
    filters: TableFilter[];
    sort: TableSort | null;
    groupBy: string | null;
  }) => {
    if (!canManagePrefs) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set(
      "payload",
      JSON.stringify({ filters: next.filters, sort: next.sort, groupBy: next.groupBy }),
    );
    startTransition(() => saveTableFiltersAction(fd));
  };

  // Same for the prefs (order/hidden/widths). Used when the menu hides
  // a column without going through ColumnSettings.
  const persistPrefs = (patch: {
    columnOrder?: string[];
    hidden?: string[];
    widths?: Record<string, number>;
  }) => {
    if (!canManagePrefs) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("config", JSON.stringify(patch));
    startTransition(() => saveTableColumnPrefsAction(fd));
  };

  // Pipeline: filter → sort. Grouping happens at render time so each
  // group keeps the same sort.
  const filteredSorted = useMemo(() => {
    const valueOf = (t: BoardTableTask, columnId: string): string => {
      if (columnId === "title") return t.title;
      if (columnId === "statusColumnId") return t.statusColumnId ?? "";
      if (columnId === "startAt") return t.startAt ?? "";
      if (columnId === "stopAt") return t.stopAt ?? "";
      return t.customValues[columnId] ?? "";
    };
    let rows = tasks;
    if (filters.length > 0) {
      rows = rows.filter((t) => filters.every((f) => matchesFilter(f, valueOf(t, f.columnId))));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        for (const v of Object.values(t.customValues)) {
          if (v && v.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    if (tableSort) {
      const dirMul = tableSort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort(
        (a, b) =>
          dirMul *
          compareValues(valueOf(a, tableSort.columnId), valueOf(b, tableSort.columnId), tableSort.kind),
      );
    }
    return rows;
  }, [tasks, filters, tableSort, searchQuery]);

  const columns = useMemo(
    () => [
      col.accessor("statusColumnId", {
        header: "Status",
        size: 160,
        minSize: 80,
        cell: (info) => {
          const value = info.getValue();
          const current = value ? statusColumns.find((c) => c.id === value) ?? null : null;
          return (
            <StatusPicker
              taskId={info.row.original.id}
              workspaceId={workspaceId}
              boardId={boardId}
              current={current}
              options={statusColumns}
              canEdit={canEdit}
              canManageBoard={canManagePrefs}
            />
          );
        },
        sortingFn: (a, b) => {
          const ao = statusColumns.findIndex((c) => c.id === a.original.statusColumnId);
          const bo = statusColumns.findIndex((c) => c.id === b.original.statusColumnId);
          return (ao === -1 ? 999 : ao) - (bo === -1 ? 999 : bo);
        },
      }),
      col.accessor("title", {
        header: "Tytuł",
        size: 280,
        minSize: 120,
        cell: (info) => (
          <Link
            href={`/w/${workspaceId}/t/${info.row.original.id}`}
            className="block truncate font-display text-[0.96rem] font-semibold tracking-[-0.01em] transition-colors hover:text-primary"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      col.accessor("assignees", {
        header: "Osoby",
        size: 130,
        minSize: 60,
        enableSorting: false,
        cell: (info) => {
          const assignees = info.getValue();
          if (assignees.length === 0) {
            return <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>;
          }
          return (
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 4).map((a) => (
                <span
                  key={a.id}
                  title={a.name ?? a.email}
                  className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-background bg-brand-gradient font-display text-[0.6rem] font-bold text-white"
                >
                  {a.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (a.name ?? a.email).slice(0, 2).toUpperCase()
                  )}
                </span>
              ))}
              {assignees.length > 4 && (
                <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-muted font-mono text-[0.58rem] text-muted-foreground">
                  +{assignees.length - 4}
                </span>
              )}
            </div>
          );
        },
      }),
      col.accessor("tags", {
        header: "Tagi",
        size: 200,
        minSize: 80,
        enableSorting: false,
        cell: (info) => {
          const tags = info.getValue();
          if (tags.length === 0) {
            return <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                  style={{ background: `${t.colorHex}1A`, color: t.colorHex }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.colorHex }} />
                  {t.name}
                </span>
              ))}
            </div>
          );
        },
      }),
      col.accessor("startAt", {
        header: "Start",
        size: 180,
        minSize: 110,
        cell: (info) => (
          <DateCell
            taskId={info.row.original.id}
            field="startAt"
            value={info.getValue()}
            disabled={!canEdit}
          />
        ),
      }),
      col.accessor("stopAt", {
        header: "Koniec",
        size: 180,
        minSize: 110,
        cell: (info) => (
          <DateCell
            taskId={info.row.original.id}
            field="stopAt"
            value={info.getValue()}
            disabled={!canEdit}
          />
        ),
      }),
      // F9-07 / F10-A: one TanStack column per user-defined custom
      // column. `id` uses a `custom:` prefix so column-order + visibility
      // state stays distinct from the built-in ids. Cell rendering is
      // dispatched by FieldType (TEXT, NUMBER, SINGLE_SELECT, …).
      ...customColumns.map((c) =>
        col.display({
          id: `custom:${c.id}`,
          header: c.name,
          size: defaultSizeForType(c.type),
          minSize: 80,
          cell: ({ row }) => (
            <FieldCell
              taskId={row.original.id}
              columnId={c.id}
              type={c.type}
              raw={row.original.customValues[c.id] ?? ""}
              options={parseFieldOptions(c.options) as FieldOptions}
              disabled={!canEdit}
            />
          ),
        }),
      ),
    ],
    [statusColumns, canEdit, workspaceId, boardId, canManagePrefs, customColumns],
  );

  const table = useReactTable({
    data: filteredSorted,
    columns,
    state: { sorting, columnOrder, columnVisibility, columnSizing, rowSelection },
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enableRowSelection: canEdit,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedTaskIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  const hiddenIds = Object.entries(columnVisibility)
    .filter(([, visible]) => !visible)
    .map(([id]) => id);

  // Merge built-in + user-defined columns into one list for the settings
  // popover. Custom column ids get a `custom:` prefix so TanStack state
  // stays distinct.
  const settingsColumns: ColumnDef[] = [
    ...COLUMN_DEFS,
    ...customColumns.map((c) => ({
      id: `custom:${c.id}`,
      label: c.name,
      custom: true,
      fieldType: c.type,
      fieldOptions: parseFieldOptions(c.options),
    })),
  ];

  // F10-B: every filterable / sortable / groupable column reduced to the
  // shape the toolbar needs (kind + label + options for the value picker).
  // Built-ins use BUILTIN_* kinds so the operators table gives them a
  // sensible default set.
  const toolbarColumns: ToolbarColumnRef[] = [
    { id: "title", label: "Tytuł", kind: "BUILTIN_TITLE" },
    {
      id: "statusColumnId",
      label: "Status",
      kind: "BUILTIN_STATUS",
      statusOptions: statusColumns.map((s) => ({ id: s.id, label: s.name, color: s.colorHex })),
    },
    { id: "startAt", label: "Start", kind: "BUILTIN_DATE" },
    { id: "stopAt", label: "Koniec", kind: "BUILTIN_DATE" },
    ...customColumns.map((c) => ({
      id: c.id,
      label: c.name,
      kind: c.type,
      fieldOptions: parseFieldOptions(c.options),
    })),
  ];

  // Group rows by the active groupBy column. Returns ordered buckets so
  // the rendering side can iterate without re-sorting.
  const groupedRows: { key: string; label: string; color?: string; rows: typeof filteredSorted }[] = (() => {
    if (!groupBy) return [{ key: "_all", label: "", rows: filteredSorted }];

    const buckets = new Map<string, typeof filteredSorted>();
    for (const t of filteredSorted) {
      const raw =
        groupBy === "statusColumnId"
          ? t.statusColumnId ?? ""
          : groupBy === "title"
            ? t.title
            : groupBy === "startAt"
              ? t.startAt ?? ""
              : groupBy === "stopAt"
                ? t.stopAt ?? ""
                : t.customValues[groupBy] ?? "";
      const k = raw || "_empty";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(t);
    }

    const labelFor = (k: string): { label: string; color?: string } => {
      if (k === "_empty") return { label: "— brak —" };
      if (groupBy === "statusColumnId") {
        const s = statusColumns.find((x) => x.id === k);
        return { label: s?.name ?? "—", color: s?.colorHex };
      }
      const customCol = customColumns.find((c) => c.id === groupBy);
      if (customCol?.type === "SINGLE_SELECT") {
        const opts = parseFieldOptions(customCol.options).selectOptions ?? [];
        const opt = opts.find((o) => o.value === k);
        return { label: opt?.value ?? k, color: opt?.color };
      }
      if (customCol?.type === "CHECKBOX") {
        return { label: k === "true" || k === "1" ? "Zaznaczone" : "Niezaznaczone" };
      }
      if (customCol?.type === "RATING") {
        return { label: `${k} ★` };
      }
      return { label: k };
    };

    return Array.from(buckets.entries()).map(([key, rows]) => {
      const { label, color } = labelFor(key);
      return { key, label, color, rows };
    });
  })();

  return (
    <div className="flex flex-col gap-3">
      {searchOpen && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-popover px-3 py-1.5 shadow-[0_4px_12px_-4px_rgba(10,10,40,0.15)]">
          <Search size={14} className="text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                setSearchOpen(false);
              }
            }}
            placeholder="Szukaj w tabeli… (Esc aby zamknąć)"
            className="flex-1 bg-transparent text-[0.9rem] outline-none placeholder:text-muted-foreground/60"
          />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            {filteredSorted.length} {taskPl(filteredSorted.length)}
          </span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSearchOpen(false);
            }}
            aria-label="Zamknij wyszukiwarkę"
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <TableFiltersToolbar
          workspaceId={workspaceId}
          boardId={boardId}
          columns={toolbarColumns}
          filters={filters}
          sort={tableSort}
          groupBy={groupBy}
          canEdit={canManagePrefs}
          onChange={(next) => {
            setFilters(next.filters);
            setTableSort(next.sort);
            setGroupBy(next.groupBy);
          }}
        />
        {canManagePrefs && (
          <ColumnSettings
            workspaceId={workspaceId}
            boardId={boardId}
            columns={settingsColumns}
            columnOrder={columnOrder}
            hidden={hiddenIds}
            onLocalChange={(next) => {
              setColumnOrder(next.order);
              const allIds = [
                ...DEFAULT_COLUMN_ORDER,
                ...customColumns.map((c) => `custom:${c.id}`),
              ];
              const vis: VisibilityState = {};
              for (const id of allIds) {
                vis[id] = !next.hidden.includes(id);
              }
              setColumnVisibility(vis);
            }}
          />
        )}
      </div>

    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,10,40,0.04)]">
      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          className="w-full text-[0.88rem]"
          onKeyDown={(e) => {
            if (!activeCell) return;
            // Only intercept arrow keys / Enter when a CELL (td) is the
            // active focus target — otherwise inputs inside cells own
            // their keystrokes.
            const target = e.target as HTMLElement;
            const onCellTd = target.tagName === "TD" || target.dataset.cell === "1";
            if (!onCellTd) return;
            const visibleRows = filteredSorted;
            const colIds = table.getVisibleLeafColumns().map((c) => c.id);
            const moveTo = (r: number, c: number) => {
              const clampedR = Math.max(0, Math.min(visibleRows.length - 1, r));
              const clampedC = Math.max(0, Math.min(colIds.length - 1, c));
              setActiveCell({ row: clampedR, col: clampedC });
              const sel = `td[data-cell="1"][data-row="${clampedR}"][data-col="${clampedC}"]`;
              const next = tableRef.current?.querySelector<HTMLTableCellElement>(sel);
              next?.focus();
            };
            if (e.key === "ArrowDown") {
              e.preventDefault();
              moveTo(activeCell.row + 1, activeCell.col);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              moveTo(activeCell.row - 1, activeCell.col);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              moveTo(activeCell.row, activeCell.col - 1);
            } else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
              e.preventDefault();
              const nextCol = activeCell.col + 1;
              if (nextCol >= colIds.length) {
                moveTo(activeCell.row + 1, 0);
              } else {
                moveTo(activeCell.row, nextCol);
              }
            } else if (e.key === "Tab" && e.shiftKey) {
              e.preventDefault();
              const prevCol = activeCell.col - 1;
              if (prevCol < 0) {
                moveTo(activeCell.row - 1, colIds.length - 1);
              } else {
                moveTo(activeCell.row, prevCol);
              }
            } else if (e.key === "Enter" || e.key === "F2") {
              // Focus first interactive element inside the cell (input,
              // textarea, button, select) so the user can start typing
              // immediately. Escape inside the cell will return focus
              // to the td (browser default).
              e.preventDefault();
              const editable = target.querySelector<HTMLElement>(
                'input, textarea, select, button:not([aria-label="Konfiguruj kolumnę"])',
              );
              editable?.focus();
            }
          }}
        >
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/40">
                {canEdit && (
                  <th className="sticky left-0 top-0 z-30 h-10 w-10 bg-muted/95 px-2 shadow-[1px_0_0_0_var(--border)] backdrop-blur-sm">
                    <input
                      type="checkbox"
                      aria-label="Zaznacz wszystkie wiersze"
                      checked={
                        table.getRowModel().rows.length > 0 &&
                        table.getRowModel().rows.every((r) => rowSelection[r.id])
                      }
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          const next: RowSelectionState = {};
                          for (const r of table.getRowModel().rows) next[r.id] = true;
                          setRowSelection(next);
                        } else {
                          setRowSelection({});
                        }
                      }}
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--primary)]"
                    />
                  </th>
                )}
                {hg.headers.map((header, hIdx) => {
                  const canResize = header.column.getCanResize();
                  const isResizing = header.column.getIsResizing();
                  const colId = header.column.id;
                  const isCustom = colId.startsWith("custom:");
                  const customCol = isCustom
                    ? customColumns.find((c) => `custom:${c.id}` === colId)
                    : null;
                  const headerLabel =
                    typeof header.column.columnDef.header === "string"
                      ? header.column.columnDef.header
                      : colId;
                  const sortDir =
                    tableSort?.columnId ===
                    (isCustom ? colId.replace(/^custom:/, "") : colId)
                      ? tableSort.dir
                      : false;
                  // F10-X T2.4: freeze the first visible data column.
                  // When checkbox column is rendered the status cell
                  // sticks at left-[40px] so both stay visible during
                  // horizontal scroll.
                  const isFrozen = hIdx === 0;
                  const frozenLeft = canEdit ? "40px" : "0px";
                  return (
                    <th
                      key={header.id}
                      className={`group/th relative sticky top-0 h-10 px-4 text-left font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${
                        isFrozen
                          ? "z-20 bg-muted/95 shadow-[1px_0_0_0_var(--border)] backdrop-blur-sm"
                          : ""
                      }`}
                      style={{
                        width: header.getSize(),
                        ...(isFrozen ? { left: frozenLeft } : {}),
                      }}
                    >
                      <TableHeaderCell
                        columnId={colId}
                        label={headerLabel}
                        fieldType={customCol?.type}
                        canManagePrefs={canManagePrefs}
                        isSorted={sortDir as false | "asc" | "desc"}
                        onSort={(dir) => {
                          if (dir === null) {
                            setTableSort(null);
                            persistFilters({ filters, sort: null, groupBy });
                          } else {
                            const targetId = isCustom
                              ? colId.replace(/^custom:/, "")
                              : colId;
                            const kind: TableSort["kind"] = customCol
                              ? customCol.type
                              : colId === "title"
                                ? "BUILTIN_TITLE"
                                : colId === "statusColumnId"
                                  ? "BUILTIN_STATUS"
                                  : "BUILTIN_DATE";
                            const next: TableSort = { columnId: targetId, kind, dir };
                            setTableSort(next);
                            persistFilters({ filters, sort: next, groupBy });
                          }
                        }}
                        onFilter={() => {
                          // Add an empty filter for this column so the
                          // toolbar chip pops up ready for value input.
                          const targetId = isCustom
                            ? colId.replace(/^custom:/, "")
                            : colId;
                          const kind: TableFilter["kind"] = customCol
                            ? customCol.type
                            : colId === "title"
                              ? "BUILTIN_TITLE"
                              : colId === "statusColumnId"
                                ? "BUILTIN_STATUS"
                                : "BUILTIN_DATE";
                          const newFilter: TableFilter = {
                            columnId: targetId,
                            kind,
                            op:
                              kind === "BUILTIN_STATUS" || kind === "SINGLE_SELECT"
                                ? "equals"
                                : kind === "NUMBER" || kind === "RATING"
                                  ? "equals"
                                  : kind === "CHECKBOX"
                                    ? "isChecked"
                                    : "contains",
                            value: "",
                          };
                          const nextFilters = [...filters, newFilter];
                          setFilters(nextFilters);
                          persistFilters({ filters: nextFilters, sort: tableSort, groupBy });
                        }}
                        onHide={() => {
                          const next = { ...columnVisibility, [colId]: false };
                          setColumnVisibility(next);
                          const hidden = Object.entries(next)
                            .filter(([, v]) => !v)
                            .map(([id]) => id);
                          persistPrefs({ hidden, columnOrder });
                        }}
                      />
                      {canResize && canManagePrefs && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Zmień szerokość kolumny"
                          className={`absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none touch-none transition-colors ${
                            isResizing ? "bg-primary" : "bg-transparent hover:bg-primary/40"
                          }`}
                        />
                      )}
                    </th>
                  );
                })}
                {canManagePrefs && (
                  <th className="sticky top-0 h-10 w-12 px-2 text-left font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <AddColumnButton workspaceId={workspaceId} boardId={boardId} />
                  </th>
                )}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (canManagePrefs ? 1 : 0)}
                  className="py-12 text-center text-muted-foreground"
                >
                  <p className="font-display text-[0.95rem] font-semibold">Brak zadań.</p>
                  <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                    {filters.length > 0 ? "filtry nic nie zwróciły" : "użyj „Nowe zadanie” powyżej"}
                  </p>
                </td>
              </tr>
            ) : (
              // F10-B: when grouped, the row model is partitioned by
              // bucket — each bucket gets a colored header row, then the
              // matching subset of TanStack rows underneath.
              groupedRows.map((bucket) => {
                const bucketRows = table
                  .getRowModel()
                  .rows.filter((r) => bucket.rows.some((t) => t.id === r.original.id));
                if (bucketRows.length === 0) return null;
                return (
                  <GroupBucket
                    key={bucket.key}
                    label={bucket.label}
                    color={bucket.color}
                    columnCount={columns.length + (canManagePrefs ? 1 : 0)}
                    showHeader={Boolean(groupBy)}
                  >
                    {bucketRows.map((row) => {
                      const isSelected = !!rowSelection[row.id];
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-border last:border-b-0 transition-colors ${
                            isSelected ? "bg-primary/5" : "hover:bg-accent/40"
                          }`}
                          {...assign.rowProps(
                            row.original.id,
                            row.original.assignees.map((a) => a.id),
                          )}
                        >
                          {canEdit && (
                            <td
                              className="sticky left-0 z-10 w-10 bg-card px-2 align-middle shadow-[1px_0_0_0_var(--border)]"
                              style={{
                                background: isSelected ? "rgba(var(--primary-rgb,0,0,0),0.05)" : undefined,
                              }}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Zaznacz wiersz ${row.original.title}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  // Shift-click extends the range from the
                                  // last clicked row.
                                  const ev = e.nativeEvent as MouseEvent;
                                  if (ev.shiftKey && lastClickedRowRef.current) {
                                    extendSelection(row.original.id);
                                  } else {
                                    setRowSelection((prev) => ({
                                      ...prev,
                                      [row.original.id]: !prev[row.original.id],
                                    }));
                                  }
                                  lastClickedRowRef.current = row.original.id;
                                }}
                                className="h-3.5 w-3.5 cursor-pointer accent-[var(--primary)]"
                              />
                            </td>
                          )}
                          {row.getVisibleCells().map((cell, cIdx) => {
                            const isFrozen = cIdx === 0;
                            const visibleRowIdx = filteredSorted.findIndex(
                              (t) => t.id === row.original.id,
                            );
                            const isActive =
                              activeCell?.row === visibleRowIdx && activeCell?.col === cIdx;
                            return (
                              <td
                                key={cell.id}
                                data-cell="1"
                                data-row={visibleRowIdx}
                                data-col={cIdx}
                                tabIndex={0}
                                onFocus={() => setActiveCell({ row: visibleRowIdx, col: cIdx })}
                                className={`px-4 py-2.5 align-middle outline-none ${
                                  isFrozen
                                    ? "sticky z-10 bg-card shadow-[1px_0_0_0_var(--border)]"
                                    : ""
                                } ${isActive ? "ring-2 ring-inset ring-primary/60" : ""}`}
                                style={{
                                  width: cell.column.getSize(),
                                  ...(isFrozen ? { left: canEdit ? "40px" : "0px" } : {}),
                                }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                          {canManagePrefs && <td className="w-12" />}
                        </tr>
                      );
                    })}
                  </GroupBucket>
                );
              })
            )}
            {canEdit && (
              <AddRowInline
                workspaceId={workspaceId}
                boardId={boardId}
                columnCount={columns.length + (canManagePrefs ? 1 : 0)}
              />
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
        <span>{tasks.length} {taskPl(tasks.length)}</span>
        <span>
          hint · najedź na zadanie i wciśnij <kbd className="rounded-sm border border-border bg-muted px-1 py-0.5 text-[0.58rem]">M</kbd> aby przypisać osobę
        </span>
      </div>
    </div>
    {assign.menu}
    {selectedTaskIds.length > 0 && (
      <BulkActionsBar
        workspaceId={workspaceId}
        selectedIds={selectedTaskIds}
        statusColumns={statusColumns}
        onClear={() => setRowSelection({})}
      />
    )}
    </div>
  );
}

// F10-X T2.2: floating action bar shown when ≥ 1 row is selected.
// Sits at the bottom of the viewport. Modes: change status / delete /
// clear. Server actions revalidate so deleted/moved rows disappear
// without a full reload.
function BulkActionsBar({
  workspaceId,
  selectedIds,
  statusColumns,
  onClear,
}: {
  workspaceId: string;
  selectedIds: string[];
  statusColumns: BoardTableColumn[];
  onClear: () => void;
}) {
  const [statusMenu, setStatusMenu] = useState(false);
  const submitDelete = () => {
    if (!confirm(`Usunąć ${selectedIds.length} zadań? Tego nie da się cofnąć z UI.`)) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("ids", selectedIds.join(","));
    startTransition(async () => {
      await bulkDeleteTasksAction(fd);
      onClear();
    });
  };
  const setStatus = (statusColumnId: string) => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("ids", selectedIds.join(","));
    fd.set("statusColumnId", statusColumnId);
    startTransition(async () => {
      await bulkUpdateStatusAction(fd);
      setStatusMenu(false);
      onClear();
    });
  };
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-popover px-4 py-2 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
        Zaznaczone: <strong className="text-foreground">{selectedIds.length}</strong>
      </span>
      <span className="h-4 w-px bg-border" />
      <div className="relative">
        <button
          type="button"
          onClick={() => setStatusMenu((m) => !m)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.78rem] font-medium text-foreground transition-colors hover:bg-accent"
        >
          Zmień status
        </button>
        {statusMenu && (
          <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 rounded-lg border border-border bg-popover p-1 shadow-md">
            <button
              type="button"
              onClick={() => setStatus("")}
              className="block w-full whitespace-nowrap rounded-md px-2 py-1 text-left text-[0.78rem] text-muted-foreground transition-colors hover:bg-accent"
            >
              — brak —
            </button>
            {statusColumns.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className="block w-full whitespace-nowrap rounded-md px-2 py-1 text-left text-[0.78rem] transition-colors hover:bg-accent"
                style={{ color: s.colorHex }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={submitDelete}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.78rem] font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Usuń
      </button>
      <span className="h-4 w-px bg-border" />
      <button
        type="button"
        onClick={onClear}
        aria-label="Wyczyść zaznaczenie"
        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// F10-X: starting widths per FieldType for newly-added custom columns.
// User overrides via drag persist on top of this default.
function defaultSizeForType(type: FieldType): number {
  switch (type) {
    case "CHECKBOX":
      return 90;
    case "RATING":
      return 130;
    case "NUMBER":
    case "AUTO_NUMBER":
      return 130;
    case "DATE":
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME":
      return 180;
    case "PHONE":
      return 160;
    case "URL":
    case "EMAIL":
      return 220;
    case "LONG_TEXT":
      return 300;
    case "MULTI_SELECT":
      return 220;
    case "SINGLE_SELECT":
      return 160;
    case "USER":
      return 160;
    case "ATTACHMENT":
      return 200;
    default:
      return 200;
  }
}

function DateCell({
  taskId,
  field,
  value,
  disabled,
}: {
  taskId: string;
  field: "startAt" | "stopAt";
  value: string | null;
  disabled: boolean;
}) {
  if (disabled) {
    return value ? (
      <span className="font-mono text-[0.8rem]">
        {new Date(value).toLocaleString("pl-PL", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </span>
    ) : (
      <MutedDash />
    );
  }
  return (
    <form action={patchTaskAction} className="m-0">
      <input type="hidden" name="id" value={taskId} />
      <input
        name={field}
        type="datetime-local"
        defaultValue={toLocalInput(value)}
        onBlur={(e) => {
          const initial = toLocalInput(value);
          if (e.currentTarget.value === initial) return;
          (e.currentTarget.form as HTMLFormElement).requestSubmit();
        }}
        className="w-full bg-transparent font-mono text-[0.8rem] outline-none focus-visible:text-foreground"
      />
    </form>
  );
}

function MutedDash() {
  return <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>;
}

// F10-B: collapsible group header + row container. When `showHeader`
// is false (no groupBy active) we render only the children — keeps the
// non-grouped path 1:1 with the previous behaviour.
function GroupBucket({
  label,
  color,
  columnCount,
  showHeader,
  children,
}: {
  label: string;
  color?: string;
  columnCount: number;
  showHeader: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (!showHeader) return <>{children}</>;
  const accent = color ?? "var(--muted-foreground)";
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={columnCount} className="px-4 py-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-2"
          >
            <span
              className="grid h-5 w-5 place-items-center rounded-sm text-[0.7rem] text-muted-foreground transition-transform"
              style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
            >
              ▾
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
              style={{ color: accent, background: `${accent}1F` }}
            >
              {label || "—"}
            </span>
          </button>
        </td>
      </tr>
      {open && children}
    </>
  );
}

// F10-X: small "+" trigger at the end of the header row. Opens a tiny
// inline input — Enter creates a TEXT column with that name. Power
// users can still configure the type via the column gear afterwards;
// this is the "add fast" path that matches Airtable's "+ Add field".
// Single canonical "add column" path (mirrors Airtable's "+ Add field"):
// click + → popover with name input + type picker + per-type options.
// The popover renders via portal at viewport-fixed coords so internal
// scroll never scrolls the underlying overflow-x-auto table.
function AddColumnButton({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    placement: "below" | "above";
  } | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("TEXT");
  const [options, setOptions] = useState<FieldOptions>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const closeReset = () => {
    setName("");
    setType("TEXT");
    setOptions({});
    setOpen(false);
    setCoords(null);
  };

  // Position popover relative to viewport. If there's not enough room
  // below the trigger, flip above. Always clamp maxHeight so the footer
  // (Anuluj / Dodaj) never falls off-screen.
  const computeCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const POP_WIDTH = 320;
    const GAP = 6;
    const PAGE_PAD = 16;
    const spaceBelow = window.innerHeight - rect.bottom - GAP - PAGE_PAD;
    const spaceAbove = rect.top - GAP - PAGE_PAD;
    const wantBelow = spaceBelow >= 300 || spaceBelow >= spaceAbove;
    const placement: "below" | "above" = wantBelow ? "below" : "above";
    const maxHeight = Math.max(220, wantBelow ? spaceBelow : spaceAbove);
    const top = wantBelow ? rect.bottom + GAP : Math.max(PAGE_PAD, rect.top - GAP - maxHeight);
    const left = Math.max(8, Math.min(window.innerWidth - POP_WIDTH - 8, rect.right - POP_WIDTH));
    return { top, left, maxHeight, placement };
  };

  const openWithCoords = () => {
    const c = computeCoords();
    if (!c) return;
    setCoords(c);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        closeReset();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeReset();
    };
    // Recompute on resize/scroll so popover stays anchored as the user
    // resizes the window or scrolls the page underneath it.
    const onReflow = () => {
      const c = computeCoords();
      if (c) setCoords(c);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("name", trimmed);
    fd.set("type", type);
    fd.set("options", JSON.stringify(options ?? {}));
    startTransition(async () => {
      await createTableColumnAction(fd);
      closeReset();
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeReset() : openWithCoords())}
        aria-label="Dodaj kolumnę"
        title="Dodaj kolumnę"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 320,
              maxHeight: coords.maxHeight,
            }}
            className="z-[60] flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <div className="shrink-0 border-b border-border px-3 py-2">
              <p className="eyebrow">Nowa kolumna</p>
            </div>
            {/* min-h-0 is the magic that lets flex-1 + overflow-y-auto
                actually clip the middle section. Without it the parent
                stretches to fit content and the footer falls off-screen. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    e.preventDefault();
                    submit();
                  }
                }}
                maxLength={80}
                placeholder="Nazwa pola…"
                className="mb-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[0.86rem] outline-none focus:border-primary/60"
              />
              <p className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                Typ
              </p>
              <FieldTypePicker value={type} onChange={setType} />
              <div className="mt-3 space-y-2">
                <FieldOptionsEditor type={type} value={options} onChange={setOptions} />
              </div>
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border bg-popover px-3 py-2">
              <button
                type="button"
                onClick={closeReset}
                className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim()}
                className="inline-flex h-7 items-center rounded-md bg-primary px-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Dodaj kolumnę
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// F10-X: ghost "+ Nowy wiersz" row pinned at the end of tbody. Click
// to expand into an inline title input; Enter creates the task. Saved
// to the first status column with default rowOrder, same path as the
// "Nowe zadanie" toolbar button — just less clicks to reach it.
function AddRowInline({
  workspaceId,
  boardId,
  columnCount,
}: {
  workspaceId: string;
  boardId: string;
  columnCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("title", trimmed);
    startTransition(async () => {
      await createTaskAction(null, fd);
      setTitle("");
      // Stay in edit mode so the user can keep firing rows without
      // clicking again — Airtable does the same thing.
    });
  };
  return (
    <tr className="border-t border-dashed border-border/70 hover:bg-accent/20">
      <td colSpan={columnCount} className="px-4 py-2">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                setTitle("");
                setEditing(false);
              }
            }}
            maxLength={200}
            placeholder="Tytuł zadania…"
            className="w-full bg-transparent text-[0.92rem] outline-none placeholder:text-muted-foreground/50"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus size={11} /> Nowy wiersz
          </button>
        )}
      </td>
    </tr>
  );
}

