"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  Folder,
  List as ListIcon,
  Plus,
  Star,
  Sun,
  Trash2,
} from "lucide-react";
import {
  createTodoFolderAction,
  createTodoItemAction,
  createTodoListAction,
  deleteTodoFolderAction,
  deleteTodoListAction,
  toggleTodoImportantAction,
  toggleTodoItemAction,
  toggleTodoMyDayAction,
} from "@/app/(app)/my/todo/actions";
import type { SmartView } from "@/app/(app)/my/todo/page";
import { TodoDetailPanel, type TodoItemFull } from "@/components/my/todo/todo-detail-panel";

export interface TodoFolderNode {
  id: string;
  name: string;
  parentId: string | null;
}
export interface TodoListNode {
  id: string;
  name: string;
  folderId: string | null;
}

// MS-To-Do-like labels / icons for the three smart views.
const SMART_VIEWS: { key: SmartView; label: string; icon: typeof Sun; accent: string }[] = [
  { key: "my-day", label: "Mój dzień", icon: Sun, accent: "text-amber-500" },
  { key: "important", label: "Ważne", icon: Star, accent: "text-rose-500" },
  { key: "planned", label: "Zaplanowane", icon: CalendarDays, accent: "text-sky-500" },
];

// F9-11: fullwidth 2-column layout (sidebar + main) with a slide-in
// right-side detail panel when a task is selected. Folders only contain
// lists — nested folders are no longer part of the UX (we ignore
// parentId in the tree and server-side createTodoFolderAction forces
// parentId = null on new rows).
export function TodoWorkspace({
  folders,
  lists,
  activeListId,
  activeListName,
  smart,
  items,
  focusedItemId,
}: {
  folders: TodoFolderNode[];
  lists: TodoListNode[];
  activeListId: string | null;
  activeListName: string | null;
  smart: SmartView | null;
  items: TodoItemFull[];
  focusedItemId: string | null;
}) {
  // Only render top-level folders — ignore any legacy nested rows.
  const rootFolders = useMemo(
    () => folders.filter((f) => f.parentId === null),
    [folders],
  );
  const listsByFolder = useMemo(() => {
    const m = new Map<string | null, TodoListNode[]>();
    for (const l of lists) {
      const k = l.folderId;
      const bucket = m.get(k) ?? [];
      bucket.push(l);
      m.set(k, bucket);
    }
    return m;
  }, [lists]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(focusedItemId);
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;

  if (selectedItemId && !items.find((i) => i.id === selectedItemId)) {
    setTimeout(() => setSelectedItemId(null), 0);
  }

  const activeSmart = SMART_VIEWS.find((v) => v.key === smart);
  const pageTitle = activeListName ?? activeSmart?.label ?? "TO DO";

  const incomplete = items.filter((i) => !i.completed);
  const completed = items.filter((i) => i.completed);

  return (
    <div className="flex h-[calc(100dvh-0px)] overflow-hidden">
      {/* Left sidebar — smart views + flat folders with lists */}
      <aside className="flex w-[280px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-card/50 p-3">
        <div className="px-2 pt-1 pb-2">
          <span className="eyebrow">Prywatne TO DO</span>
        </div>

        {/* Smart views */}
        <div className="flex flex-col gap-0.5">
          {SMART_VIEWS.map((v) => {
            const Icon = v.icon;
            const active = smart === v.key && !activeListId;
            return (
              <Link
                key={v.key}
                href={`/my/todo?smart=${v.key}`}
                data-active={active ? "true" : "false"}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.88rem] transition-colors hover:bg-accent/60 data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
              >
                <Icon size={14} className={v.accent} />
                <span className="flex-1">{v.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="my-1 border-t border-border" />

        {/* Root-level lists (no folder) */}
        {(listsByFolder.get(null) ?? []).map((l) => (
          <ListLink key={l.id} list={l} activeListId={activeListId} />
        ))}

        {/* Flat folders — each folder expands to show its lists */}
        {rootFolders.map((f) => (
          <FolderBlock
            key={f.id}
            folder={f}
            lists={listsByFolder.get(f.id) ?? []}
            activeListId={activeListId}
          />
        ))}

        {/* New folder / new list inputs pinned at bottom of sidebar */}
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <NewListForm folderId={null} placeholder="+ nowa lista" />
          <NewFolderForm placeholder="+ nowy folder" />
        </div>
      </aside>

      {/* Main content — selected list or smart view */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
          <div className="flex items-center gap-2">
            {activeSmart && (
              <activeSmart.icon size={22} className={activeSmart.accent} aria-hidden />
            )}
            <h1 className="font-display text-[1.8rem] font-bold leading-tight tracking-[-0.02em]">
              {pageTitle}
            </h1>
            <span className="ml-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              {completed.length} z {items.length}
            </span>
          </div>
        </header>

        {/* Quick-add: MS To Do places it RIGHT under the header and
             always-visible. We show it only for regular lists — smart
             views have no canonical target. */}
        {activeListId && (
          <div className="px-8 pt-4">
            <QuickAddItem listId={activeListId} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-8 py-4">
          {items.length === 0 ? (
            <EmptyState smart={smart} hasList={!!activeListId} />
          ) : (
            <div className="flex flex-col gap-4">
              <ItemsList
                items={incomplete}
                selectedItemId={selectedItemId}
                onSelect={setSelectedItemId}
                showListChip={!activeListId}
              />
              {completed.length > 0 && (
                <CompletedSection
                  items={completed}
                  selectedItemId={selectedItemId}
                  onSelect={setSelectedItemId}
                  showListChip={!activeListId}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* F11-11 (#1): klient zażądał MS-To-Do parity — po kliknięciu w
          listę pokaż po prawej stronie pole dodawania zadania. Right
          panel jest teraz ZAWSZE widoczny gdy lista jest aktywna:
          - selectedItem present → klasyczny TodoDetailPanel
          - else, activeListId set → quick-add prompt z dedykowanym CTA
          - smart view → panel ukryty (smart view nie ma kanonicznego
            targetu) */}
      {selectedItem ? (
        <div className="w-[380px] shrink-0 border-l border-border bg-card/50 overflow-y-auto">
          <TodoDetailPanel
            key={selectedItem.id}
            item={selectedItem}
            onClose={() => setSelectedItemId(null)}
          />
        </div>
      ) : activeListId ? (
        <div className="w-[380px] shrink-0 border-l border-border bg-card/50 overflow-y-auto p-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_4px_16px_-8px_rgba(10,10,40,0.1)]">
            <span className="eyebrow text-primary">Dodaj zadanie</span>
            <p className="font-display text-[1rem] font-semibold leading-tight tracking-[-0.01em]">
              Co masz do zrobienia w {activeListName ? `„${activeListName}"` : "tej liście"}?
            </p>
            <QuickAddItem listId={activeListId} variant="panel" />
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
              klik w istniejące zadanie → szczegóły / kroki / przypomnienie
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Sidebar building blocks ---

function FolderBlock({
  folder,
  lists,
  activeListId,
}: {
  folder: TodoFolderNode;
  lists: TodoListNode[];
  activeListId: string | null;
}) {
  // Open by default if the active list belongs to this folder.
  const [open, setOpen] = useState(
    !activeListId || lists.some((l) => l.id === activeListId),
  );
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-[0.86rem] hover:bg-accent/40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Zwiń" : "Rozwiń"}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Folder size={13} className="shrink-0 text-primary/70" />
        <span className="flex-1 truncate font-medium">{folder.name}</span>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          aria-label="Dodaj listę do folderu"
          title="Nowa lista w folderze"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus size={11} />
        </button>
        <form
          action={(fd) => startTransition(() => deleteTodoFolderAction(fd))}
          className="m-0"
        >
          <input type="hidden" name="id" value={folder.id} />
          <button
            type="submit"
            aria-label="Usuń folder"
            className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        </form>
      </div>

      {open && (
        <div className="flex flex-col gap-0.5 pl-5">
          {lists.map((l) => (
            <ListLink key={l.id} list={l} activeListId={activeListId} />
          ))}
          {showAdd && (
            <NewListForm folderId={folder.id} placeholder="+ nowa lista" />
          )}
        </div>
      )}
    </div>
  );
}

function ListLink({
  list,
  activeListId,
}: {
  list: TodoListNode;
  activeListId: string | null;
}) {
  const active = list.id === activeListId;
  return (
    <div className="group flex items-center gap-1 rounded-md">
      <Link
        href={`/my/todo?listId=${list.id}`}
        data-active={active ? "true" : "false"}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-[0.86rem] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
      >
        <ListIcon size={12} className="shrink-0" />
        <span className="truncate">{list.name}</span>
      </Link>
      <form
        action={(fd) => startTransition(() => deleteTodoListAction(fd))}
        className="m-0"
      >
        <input type="hidden" name="id" value={list.id} />
        <button
          type="submit"
          aria-label="Usuń listę"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </form>
    </div>
  );
}

// F11-X (klient): wszystkie inline-add formy mają teraz widoczny + button
// żeby user mógł kliknąć myszką zamiast szukać Enter.
function NewFolderForm({ placeholder }: { placeholder: string }) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createTodoFolderAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1 rounded-md transition-colors focus-within:bg-background"
    >
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder={placeholder}
        className="h-8 flex-1 rounded-md border border-transparent bg-background px-2 text-[0.82rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Dodaj folder"
        title="Dodaj folder (Enter)"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={13} />
      </button>
    </form>
  );
}

function NewListForm({
  folderId,
  placeholder,
}: {
  folderId: string | null;
  placeholder: string;
}) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createTodoListAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1 rounded-md transition-colors focus-within:bg-background"
    >
      {folderId && <input type="hidden" name="folderId" value={folderId} />}
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder={placeholder}
        className="h-8 flex-1 rounded-md border border-transparent bg-background px-2 text-[0.82rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Dodaj listę"
        title="Dodaj listę (Enter)"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={13} />
      </button>
    </form>
  );
}

// --- Main area ---

function ItemsList({
  items,
  selectedItemId,
  onSelect,
  showListChip,
}: {
  items: TodoItemFull[];
  selectedItemId: string | null;
  onSelect: (id: string | null) => void;
  showListChip: boolean;
}) {
  return (
    <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      {items.map((item) => (
        <li key={item.id} className="border-b border-border last:border-b-0">
          <ItemRow
            item={item}
            selected={item.id === selectedItemId}
            onSelect={() => onSelect(item.id === selectedItemId ? null : item.id)}
            showListChip={showListChip}
          />
        </li>
      ))}
    </ul>
  );
}

function CompletedSection({
  items,
  selectedItemId,
  onSelect,
  showListChip,
}: {
  items: TodoItemFull[];
  selectedItemId: string | null;
  onSelect: (id: string | null) => void;
  showListChip: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Ukończone ({items.length})
      </button>
      {open && (
        <ItemsList
          items={items}
          selectedItemId={selectedItemId}
          onSelect={onSelect}
          showListChip={showListChip}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  selected,
  onSelect,
  showListChip,
}: {
  item: TodoItemFull;
  selected: boolean;
  onSelect: () => void;
  showListChip: boolean;
}) {
  const now = new Date();
  const overdue = item.dueDate && new Date(item.dueDate) < now && !item.completed;
  const isMyDay = !!item.myDayAt;
  const stepCount = item.steps.length;
  const stepsDone = item.steps.filter((s) => s.completed).length;

  return (
    <div
      data-selected={selected ? "true" : "false"}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 data-[selected=true]:bg-primary/5"
    >
      <form
        action={(fd) => startTransition(() => toggleTodoItemAction(fd))}
        className="m-0 flex shrink-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="completed" value={item.completed ? "false" : "true"} />
        <button
          type="submit"
          aria-label={item.completed ? "Odznacz" : "Oznacz jako ukończone"}
          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
        >
          {item.completed ? (
            <CheckCircle2 size={18} className="text-primary" />
          ) : (
            <Circle size={18} />
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left focus-visible:outline-none"
      >
        <span
          className={`truncate text-[0.94rem] transition-colors ${
            item.completed ? "text-muted-foreground line-through" : ""
          }`}
        >
          {item.content}
        </span>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          {showListChip && (
            <span className="inline-flex items-center gap-1">
              <ListIcon size={10} /> {item.listName}
            </span>
          )}
          {isMyDay && (
            <span className="inline-flex items-center gap-1 text-amber-500">
              <Sun size={10} /> Mój dzień
            </span>
          )}
          {item.dueDate && (
            <span
              className={`inline-flex items-center gap-1 ${
                overdue ? "text-destructive" : ""
              }`}
            >
              <CalendarDays size={10} /> {formatShortDate(item.dueDate)}
            </span>
          )}
          {stepCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare size={10} /> {stepsDone}/{stepCount}
            </span>
          )}
          {item.notes && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>≡</span> notatka
            </span>
          )}
        </div>
      </button>

      <form
        action={(fd) => startTransition(() => toggleTodoMyDayAction(fd))}
        className="m-0 shrink-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="next" value={isMyDay ? "false" : "true"} />
        <button
          type="submit"
          aria-label={isMyDay ? "Usuń z Mój dzień" : "Dodaj do Mój dzień"}
          title={isMyDay ? "Usuń z Mój dzień" : "Dodaj do Mój dzień"}
          data-on={isMyDay ? "true" : "false"}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-amber-500 data-[on=true]:text-amber-500"
        >
          <Sun size={14} />
        </button>
      </form>

      <form
        action={(fd) => startTransition(() => toggleTodoImportantAction(fd))}
        className="m-0 shrink-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="next" value={item.important ? "false" : "true"} />
        <button
          type="submit"
          aria-label={item.important ? "Usuń z Ważne" : "Oznacz jako ważne"}
          title={item.important ? "Usuń z Ważne" : "Oznacz jako ważne"}
          data-on={item.important ? "true" : "false"}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-rose-500 data-[on=true]:text-rose-500"
        >
          <Star size={14} fill={item.important ? "currentColor" : "none"} />
        </button>
      </form>
    </div>
  );
}

function QuickAddItem({
  listId,
  variant = "main",
}: {
  listId: string;
  // F11-11: same form rendered in two places (main top header + right
  // panel). Right-panel variant has slimmer chrome since it's nested in
  // a card.
  variant?: "main" | "panel";
}) {
  const [content, setContent] = useState("");
  const cls =
    variant === "panel"
      ? "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 transition-colors focus-within:border-primary/60"
      : "flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-[0_1px_2px_rgba(10,10,40,0.04)]";
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createTodoItemAction(fd);
          setContent("");
        })
      }
      className={cls}
    >
      <input type="hidden" name="listId" value={listId} />
      <Plus size={variant === "panel" ? 13 : 15} className="text-primary/70" />
      <input
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        maxLength={300}
        placeholder="Dodaj zadanie…"
        autoFocus={variant === "panel"}
        className={
          variant === "panel"
            ? "flex-1 bg-transparent text-[0.88rem] outline-none placeholder:text-muted-foreground/60"
            : "flex-1 bg-transparent py-1 text-[0.95rem] outline-none placeholder:text-muted-foreground/60"
        }
      />
      <button
        type="submit"
        disabled={!content.trim()}
        aria-label="Dodaj zadanie"
        title="Dodaj (Enter)"
        className={
          variant === "panel"
            ? "grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            : "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        <Plus size={variant === "panel" ? 13 : 16} />
      </button>
    </form>
  );
}

function EmptyState({
  smart,
  hasList,
}: {
  smart: SmartView | null;
  hasList: boolean;
}) {
  if (smart === "my-day") {
    return (
      <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <Sun size={26} className="text-amber-500" />
        <p className="mt-3 font-display text-[1.05rem] font-semibold">
          Mój dzień jest czysty.
        </p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Dodawaj zadania z innych list do „Mój dzień" (ikona słoneczka obok zadania).
        </p>
      </div>
    );
  }
  if (smart === "important") {
    return (
      <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <Star size={26} className="text-rose-500" />
        <p className="mt-3 font-display text-[1.05rem] font-semibold">Brak ważnych zadań.</p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Kliknij gwiazdkę obok zadania żeby dodać je tutaj.
        </p>
      </div>
    );
  }
  if (smart === "planned") {
    return (
      <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <CalendarDays size={26} className="text-sky-500" />
        <p className="mt-3 font-display text-[1.05rem] font-semibold">
          Nic nie jest zaplanowane.
        </p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Ustaw termin w szczegółach zadania (prawy panel).
        </p>
      </div>
    );
  }
  return (
    <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
      <p className="font-display text-[1.05rem] font-semibold">
        {hasList ? "Lista jest pusta." : "Wybierz listę po lewej."}
      </p>
      <p className="mt-1 text-[0.88rem] text-muted-foreground">
        {hasList
          ? "Dodaj pierwsze zadanie w pasku u góry."
          : "Utwórz nową listę lub folder w dolnej części panelu."}
      </p>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
