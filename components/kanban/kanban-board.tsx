"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
}: {
  workspaceId: string;
  boardId: string;
  statusColumns: KanbanStatusColumn[];
  initialTasks: KanbanTask[];
}) {
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
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <CardShell task={activeTask} workspaceId={workspaceId} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  column,
  tasks,
  workspaceId,
  boardId,
}: {
  id: string;
  column: KanbanStatusColumn | null;
  tasks: KanbanTask[];
  workspaceId: string;
  boardId: string;
}) {
  const color = column?.colorHex ?? "#94A3B8";
  const name = column?.name ?? "Bez statusu";

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
              <SortableCard key={t.id} task={t} workspaceId={workspaceId} />
            ))}
            {tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-background/40 py-6 text-center text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground/60">
                upuść tu
              </div>
            )}
          </div>
        </ColumnDropZone>
      </div>
    </SortableContext>
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
}: {
  task: KanbanTask;
  workspaceId: string;
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
      <CardShell task={task} workspaceId={workspaceId} />
    </div>
  );
}

function CardShell({
  task,
  workspaceId,
  dragging,
}: {
  task: KanbanTask;
  workspaceId: string;
  dragging?: boolean;
}) {
  return (
    <article
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
        className="font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em] transition-colors hover:text-primary"
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

