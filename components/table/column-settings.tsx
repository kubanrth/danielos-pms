"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns, Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react";
import { saveTableColumnPrefsAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";

export interface ColumnDef {
  id: string;
  label: string;
  // Status column is always visible — we hide the toggle but keep it
  // draggable so users can position it first/last/middle.
  required?: boolean;
}

export function ColumnSettings({
  workspaceId,
  boardId,
  columns,
  columnOrder,
  hidden,
  onLocalChange,
}: {
  workspaceId: string;
  boardId: string;
  columns: ColumnDef[];
  columnOrder: string[];
  hidden: string[];
  // Optimistic update callback — parent re-renders the table as we drag,
  // so the user sees the change before the server commits.
  onLocalChange: (next: { order: string[]; hidden: string[] }) => void;
}) {
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = (next: { order: string[]; hidden: string[] }) => {
    onLocalChange(next);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set(
      "config",
      JSON.stringify({ columnOrder: next.order, hidden: next.hidden }),
    );
    startTransition(() => {
      saveTableColumnPrefsAction(fd);
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = columnOrder.indexOf(String(active.id));
    const newIdx = columnOrder.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const next = [...columnOrder];
    next.splice(oldIdx, 1);
    next.splice(newIdx, 0, String(active.id));
    commit({ order: next, hidden });
  };

  const toggleHidden = (id: string) => {
    const nextHidden = hidden.includes(id)
      ? hidden.filter((h) => h !== id)
      : [...hidden, id];
    commit({ order: columnOrder, hidden: nextHidden });
  };

  const reset = () => {
    commit({
      order: columns.map((c) => c.id),
      hidden: [],
    });
  };

  // Render columns in their saved order; unknown/legacy columns append at
  // the tail so a schema tweak never drops a column from the UI.
  const orderedColumns = [
    ...columnOrder
      .map((id) => columns.find((c) => c.id === id))
      .filter((c): c is ColumnDef => Boolean(c)),
    ...columns.filter((c) => !columnOrder.includes(c.id)),
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Ustawienia kolumn tabeli"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Columns size={12} />
        <span>Kolumny</span>
        {hidden.length > 0 && (
          <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[0.58rem] text-primary-foreground">
            {hidden.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-72 rounded-xl border border-border bg-popover p-3 shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)]">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Kolumny tabeli</span>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              title="Przywróć domyślne"
            >
              <RotateCcw size={10} /> reset
            </button>
          </div>
          <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/80">
            przeciągnij aby zmienić kolejność · klik oka by ukryć
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedColumns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-1">
                {orderedColumns.map((c) => (
                  <SortableRow
                    key={c.id}
                    column={c}
                    hidden={hidden.includes(c.id)}
                    onToggle={() => toggleHidden(c.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function SortableRow({
  column,
  hidden,
  onToggle,
}: {
  column: ColumnDef;
  hidden: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className="flex items-center gap-2 rounded-md border border-transparent bg-background px-2 py-1.5 text-[0.88rem] hover:border-border"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przeciągnij aby przesunąć"
        className="grid h-6 w-5 shrink-0 cursor-grab place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>
      <span
        className={`flex-1 truncate transition-colors ${
          hidden ? "text-muted-foreground/60" : ""
        }`}
      >
        {column.label}
      </span>
      {column.required ? (
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-muted-foreground/60">
          wymagane
        </span>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-label={hidden ? "Pokaż kolumnę" : "Ukryj kolumnę"}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
    </li>
  );
}
