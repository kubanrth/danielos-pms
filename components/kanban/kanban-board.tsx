"use client";

import { startTransition, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import {
  useAssignHotkey,
  type AssignMember,
} from "@/components/task/assign-hotkey";

export interface KanbanTask {
  id: string;
  title: string;
  statusColumnId: string | null;
  rowOrder: number;
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

export interface KanbanStatusColumn {
  id: string;
  name: string;
  colorHex: string;
}

// Synthetic "No status" column id used locally; tasks without a status
// land here. On drop we persist statusColumnId = null.
const NO_STATUS = "__none__";

export function KanbanBoard({
  workspaceId,
  boardId,
  statusColumns,
  initialTasks,
  members,
}: {
  workspaceId: string;
  boardId: string;
  statusColumns: KanbanStatusColumn[];
  initialTasks: KanbanTask[];
  // F9-13 extension: needed for `M` hotkey popup.
  members: AssignMember[];
}) {
  const assign = useAssignHotkey({ members, workspaceId });
  const [tasks, setTasks] = useState<KanbanTask[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startPatch] = useTransition();
  useWorkspaceRealtime(workspaceId);

  // Resync local state when the server props change (revalidate).
  useEffect(() => {
    setTasks(initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTasks.map((t) => `${t.id}:${t.statusColumnId ?? ""}:${t.rowOrder}`).join(",")]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Build column → ordered tasks map from the flat list.
  const columns = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const col of statusColumns) map.set(col.id, []);
    map.set(NO_STATUS, []);
    for (const t of tasks) {
      const key = t.statusColumnId ?? NO_STATUS;
      const list = map.get(key);
      if (list) list.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.rowOrder - b.rowOrder);
    return map;
  }, [tasks, statusColumns]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const findColumnIdOf = (taskId: string): string => {
    const t = tasks.find((x) => x.id === taskId);
    return t?.statusColumnId ?? NO_STATUS;
  };

  // When hovering another column, move the task into it locally so users
  // see the preview. We don't persist on drag over — only on drag end.
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeTaskId = String(active.id);
    const overId = String(over.id);

    const activeCol = findColumnIdOf(activeTaskId);

    // Dropping over a column drop zone directly (ids prefixed col:).
    let overCol: string | null = null;
    if (overId.startsWith("col:")) overCol = overId.slice(4);
    else {
      const overTask = tasks.find((x) => x.id === overId);
      if (overTask) overCol = overTask.statusColumnId ?? NO_STATUS;
    }
    if (!overCol || overCol === activeCol) return;

    // Move the task visually into the new column at the end (or at the
    // over-task position). Persist happens in onDragEnd.
    setTasks((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => x.id === activeTaskId);
      if (idx === -1) return prev;
      next[idx] = {
        ...next[idx],
        statusColumnId: overCol === NO_STATUS ? null : overCol,
      };
      return next;
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Resolve target column + position
    let targetColId: string;
    let targetIndex: number;

    if (overId.startsWith("col:")) {
      targetColId = overId.slice(4);
      const colTasks = columns.get(targetColId) ?? [];
      targetIndex = colTasks.length;
    } else {
      const overTask = tasks.find((x) => x.id === overId);
      if (!overTask) return;
      targetColId = overTask.statusColumnId ?? NO_STATUS;
      const colTasks = columns.get(targetColId) ?? [];
      const curIdx = colTasks.findIndex((t) => t.id === activeId);
      const overIdx = colTasks.findIndex((t) => t.id === overId);
      targetIndex = curIdx === -1 ? overIdx + 1 : overIdx;
    }

    const targetTasks = columns.get(targetColId) ?? [];
    const withoutActive = targetTasks.filter((t) => t.id !== activeId);
    const prev = targetIndex > 0 ? withoutActive[targetIndex - 1] : null;
    const next = targetIndex < withoutActive.length ? withoutActive[targetIndex] : null;

    const newRowOrder =
      prev && next
        ? (prev.rowOrder + next.rowOrder) / 2
        : prev
          ? prev.rowOrder + 1
          : next
            ? next.rowOrder / 2
            : 1;

    const newStatusColumnId = targetColId === NO_STATUS ? null : targetColId;

    if (
      activeTask.statusColumnId === newStatusColumnId &&
      activeTask.rowOrder === newRowOrder
    ) {
      return;
    }

    // Optimistic state already reflects the move done in onDragOver;
    // reorder within the column here.
    setTasks((prevState) => {
      const arr = [...prevState];
      const ix = arr.findIndex((t) => t.id === activeId);
      if (ix === -1) return prevState;
      arr[ix] = { ...arr[ix], statusColumnId: newStatusColumnId, rowOrder: newRowOrder };
      return arr;
    });

    // Persist
    const fd = new FormData();
    fd.set("id", activeId);
    fd.set("statusColumnId", newStatusColumnId ?? "");
    fd.set("rowOrder", String(newRowOrder));
    startPatch(() => {
      patchTaskAction(fd);
    });
  };

  // Render columns — in order of statusColumns + No Status at the end if it has items.
  const renderColumns: { id: string; column: KanbanStatusColumn | null }[] = [
    ...statusColumns.map((c) => ({ id: c.id, column: c })),
  ];
  if ((columns.get(NO_STATUS)?.length ?? 0) > 0) {
    renderColumns.push({ id: NO_STATUS, column: null });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {renderColumns.map(({ id, column }) => {
          const colTasks = columns.get(id) ?? [];
          return (
            <Column
              key={id}
              id={id}
              column={column}
              tasks={colTasks}
              workspaceId={workspaceId}
              boardId={boardId}
              getHotkeyProps={(t) =>
                assign.rowProps(
                  t.id,
                  t.assignees.map((a) => a.id),
                )
              }
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <CardShell task={activeTask} workspaceId={workspaceId} dragging />
        ) : null}
      </DragOverlay>
      {assign.menu}
    </DndContext>
  );
}

function Column({
  id,
  column,
  tasks,
  workspaceId,
  boardId,
  getHotkeyProps,
}: {
  id: string;
  column: KanbanStatusColumn | null;
  tasks: KanbanTask[];
  workspaceId: string;
  boardId: string;
  getHotkeyProps?: (task: KanbanTask) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  const color = column?.colorHex ?? "#94A3B8";
  const name = column?.name ?? "Bez statusu";
  // F11-10: inline add — Trello-style "+ Nowe zadanie" pinned at bottom
  // of every column. Stays in edit mode so user can fire many in a row.
  // Bez statusu column doesn't get the inline-add (no statusColumnId
  // for the server action to use).
  const canAddInline = id !== NO_STATUS;

  return (
    <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <div
        className="flex w-[300px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3"
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <span
            className="inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color, background: `${color}22` }}
          >
            {name}
          </span>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <ColumnDropZone id={id}>
          <div className="flex flex-col gap-2 min-h-[40px]">
            {tasks.map((t) => (
              <SortableCard
                key={t.id}
                task={t}
                workspaceId={workspaceId}
                hotkeyProps={getHotkeyProps?.(t)}
              />
            ))}
            {tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-background/40 py-6 text-center text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground/60">
                upuść tu
              </div>
            )}
          </div>
        </ColumnDropZone>
        {canAddInline && (
          <InlineAddTask
            workspaceId={workspaceId}
            boardId={boardId}
            statusColumnId={id}
          />
        )}
      </div>
    </SortableContext>
  );
}

// F11-10: inline +Nowe zadanie under each column. Click expands input;
// Enter creates and re-focuses for the next task; Esc collapses.
function InlineAddTask({
  workspaceId,
  boardId,
  statusColumnId,
}: {
  workspaceId: string;
  boardId: string;
  statusColumnId: string;
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
    fd.set("statusColumnId", statusColumnId);
    startTransition(async () => {
      await createTaskAction(null, fd);
      setTitle("");
      // stay in edit mode — Trello pattern, fire many in a row.
    });
  };
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-border bg-background/40 px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Plus size={11} /> Nowe zadanie
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-primary/40 bg-background p-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
        className="w-full bg-transparent text-[0.86rem] outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setTitle("");
            setEditing(false);
          }}
          className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="inline-flex h-6 items-center rounded-md bg-primary px-2.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Dodaj
        </button>
      </div>
    </div>
  );
}

function ColumnDropZone({ id, children }: { id: string; children: React.ReactNode }) {
  // Entire column is a drop target. Prefix "col:" so onDragOver/onDragEnd
  // can distinguish column hits from card-on-card hits.
  const { setNodeRef } = useDroppable({ id: `col:${id}` });
  return (
    <div ref={setNodeRef} className="flex-1">
      {children}
    </div>
  );
}

function SortableCard({
  task,
  workspaceId,
  hotkeyProps,
}: {
  task: KanbanTask;
  workspaceId: string;
  // F9-13: spread on the article so the `M` hotkey knows which card
  // is hovered. Passed from KanbanBoard via useAssignHotkey.
  hotkeyProps?: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <CardShell task={task} workspaceId={workspaceId} hotkeyProps={hotkeyProps} />
    </div>
  );
}

function CardShell({
  task,
  workspaceId,
  dragging,
  hotkeyProps,
}: {
  task: KanbanTask;
  workspaceId: string;
  dragging?: boolean;
  hotkeyProps?: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  return (
    <article
      {...(hotkeyProps ?? {})}
      className={`flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(10,10,40,0.04)] transition-shadow hover:shadow-[0_6px_16px_-8px_rgba(123,104,238,0.35)] active:cursor-grabbing ${
        dragging ? "ring-2 ring-primary/50 shadow-[0_20px_32px_-12px_rgba(123,104,238,0.45)]" : ""
      }`}
    >
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 4).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.64rem] font-medium"
              style={{ background: `${t.colorHex}1A`, color: t.colorHex }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: t.colorHex }} />
              {t.name}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/w/${workspaceId}/t/${task.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        // F11-7: long titles must wrap inside the card; previously they
        // overflowed the 300px column. break-words handles long single
        // tokens (URLs, IDs) that would otherwise stretch the card.
        className="font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em] whitespace-normal break-words transition-colors hover:text-primary"
      >
        {task.title}
      </Link>
      <div className="mt-auto flex items-center justify-between pt-1">
        {task.assignees.length > 0 ? (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <span
                key={a.id}
                title={a.name ?? a.email}
                className="grid h-5 w-5 place-items-center overflow-hidden rounded-full border-2 border-card bg-brand-gradient font-display text-[0.56rem] font-bold text-white"
              >
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (a.name ?? a.email).slice(0, 2).toUpperCase()
                )}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        {task.stopAt && (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            {new Date(task.stopAt).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </article>
  );
}

