"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { taskPl } from "@/lib/pluralize";

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
}

export interface BoardTableColumn {
  id: string;
  name: string;
  colorHex: string;
}

const col = createColumnHelper<BoardTableTask>();

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BoardTable({
  workspaceId,
  boardId,
  statusColumns,
  tasks,
  canEdit,
}: {
  workspaceId: string;
  boardId: string;
  statusColumns: BoardTableColumn[];
  tasks: BoardTableTask[];
  canEdit: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  useWorkspaceRealtime(workspaceId);

  const columns = useMemo(
    () => [
      col.accessor("statusColumnId", {
        header: "Status",
        cell: (info) => (
          <StatusCell
            taskId={info.row.original.id}
            statusColumns={statusColumns}
            value={info.getValue()}
            disabled={!canEdit}
          />
        ),
        sortingFn: (a, b) => {
          const ao = statusColumns.findIndex((c) => c.id === a.original.statusColumnId);
          const bo = statusColumns.findIndex((c) => c.id === b.original.statusColumnId);
          return (ao === -1 ? 999 : ao) - (bo === -1 ? 999 : bo);
        },
      }),
      col.accessor("title", {
        header: "Tytuł",
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
        cell: (info) => (
          <DateCell
            taskId={info.row.original.id}
            field="stopAt"
            value={info.getValue()}
            disabled={!canEdit}
          />
        ),
      }),
    ],
    [statusColumns, canEdit, workspaceId],
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,10,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full text-[0.88rem]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/40">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="sticky top-0 h-10 px-4 text-left font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                      style={{ width: columnWidth(header.column.id) }}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === "asc" && <ArrowUp size={10} />}
                          {sortDir === "desc" && <ArrowDown size={10} />}
                          {sortDir === false && (
                            <ArrowUpDown size={10} className="opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  <p className="font-display text-[0.95rem] font-semibold">Brak zadań.</p>
                  <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                    użyj „Nowe zadanie" powyżej
                  </p>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-b-0 transition-colors hover:bg-accent/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
        <span>{tasks.length} {taskPl(tasks.length)}</span>
        <span>workspace /{workspaceId.slice(-6)} · board /{boardId.slice(-6)}</span>
      </div>
    </div>
  );
}

function columnWidth(id: string): string | undefined {
  switch (id) {
    case "statusColumnId":
      return "160px";
    case "assignees":
      return "130px";
    case "tags":
      return "200px";
    case "startAt":
    case "stopAt":
      return "180px";
    default:
      return undefined;
  }
}

function StatusCell({
  taskId,
  statusColumns,
  value,
  disabled,
}: {
  taskId: string;
  statusColumns: BoardTableColumn[];
  value: string | null;
  disabled: boolean;
}) {
  const current = statusColumns.find((c) => c.id === value);
  if (disabled) {
    return current ? <StatusPill column={current} /> : <MutedDash />;
  }
  return (
    <form action={patchTaskAction} className="m-0">
      <input type="hidden" name="id" value={taskId} />
      <select
        name="statusColumnId"
        defaultValue={value ?? ""}
        onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
        className="w-full appearance-none rounded-full px-3 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        style={{
          color: current ? current.colorHex : "var(--muted-foreground)",
          background: current ? `${current.colorHex}22` : "transparent",
        }}
      >
        <option value="">— brak —</option>
        {statusColumns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}

function StatusPill({ column }: { column: BoardTableColumn }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
      style={{ color: column.colorHex, background: `${column.colorHex}22` }}
    >
      {column.name}
    </span>
  );
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
