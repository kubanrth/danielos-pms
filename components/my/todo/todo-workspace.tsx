"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Folder,
  List as ListIcon,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  createTodoFolderAction,
  createTodoItemAction,
  createTodoListAction,
  deleteTodoFolderAction,
  deleteTodoItemAction,
  deleteTodoListAction,
  toggleTodoItemAction,
} from "@/app/(app)/my/todo/actions";

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
export interface TodoItemRow {
  id: string;
  content: string;
  completed: boolean;
}

// Builds a parent→children map for quick tree rendering.
function buildFolderMap(folders: TodoFolderNode[]): Map<string | null, TodoFolderNode[]> {
  const map = new Map<string | null, TodoFolderNode[]>();
  for (const f of folders) {
    const key = f.parentId;
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return map;
}

export function TodoWorkspace({
  folders,
  lists,
  activeListId,
  activeListName,
  items,
}: {
  folders: TodoFolderNode[];
  lists: TodoListNode[];
  activeListId: string | null;
  activeListName: string | null;
  items: TodoItemRow[];
}) {
  const folderMap = useMemo(() => buildFolderMap(folders), [folders]);
  const listMap = useMemo(() => {
    const m = new Map<string | null, TodoListNode[]>();
    for (const l of lists) {
      const k = l.folderId;
      const bucket = m.get(k) ?? [];
      bucket.push(l);
      m.set(k, bucket);
    }
    return m;
  }, [lists]);

  return (
    <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <Tree
          folderMap={folderMap}
          listMap={listMap}
          parentId={null}
          activeListId={activeListId}
          depth={0}
        />
        <NewFolderForm parentId={null} />
        <NewListForm folderId={null} />
      </aside>

      <section className="flex flex-col gap-4">
        {activeListId ? (
          <ItemsPanel
            listId={activeListId}
            listName={activeListName ?? "Lista"}
            items={items}
          />
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-[1.15rem] font-semibold">
              Zacznij od utworzenia listy.
            </p>
            <p className="mt-1 text-[0.9rem] text-muted-foreground">
              Foldery ułatwią porządkowanie — możesz mieć je zagnieżdżone.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Tree({
  folderMap,
  listMap,
  parentId,
  activeListId,
  depth,
}: {
  folderMap: Map<string | null, TodoFolderNode[]>;
  listMap: Map<string | null, TodoListNode[]>;
  parentId: string | null;
  activeListId: string | null;
  depth: number;
}) {
  const folders = folderMap.get(parentId) ?? [];
  const lists = listMap.get(parentId) ?? [];

  return (
    <div className="flex flex-col gap-0.5">
      {folders.map((f) => (
        <FolderNode
          key={f.id}
          folder={f}
          folderMap={folderMap}
          listMap={listMap}
          activeListId={activeListId}
          depth={depth}
        />
      ))}
      {lists.map((l) => (
        <ListLink key={l.id} list={l} activeListId={activeListId} depth={depth} />
      ))}
    </div>
  );
}

function FolderNode({
  folder,
  folderMap,
  listMap,
  activeListId,
  depth,
}: {
  folder: TodoFolderNode;
  folderMap: Map<string | null, TodoFolderNode[]>;
  listMap: Map<string | null, TodoListNode[]>;
  activeListId: string | null;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [showForms, setShowForms] = useState(false);

  return (
    <div className="flex flex-col">
      <div
        className="group flex items-center gap-1 rounded-sm px-1 py-1 text-[0.88rem] hover:bg-accent/60"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Zwiń folder" : "Rozwiń folder"}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-transform hover:text-foreground"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Folder size={13} className="shrink-0 text-primary/70" />
        <span className="flex-1 truncate">{folder.name}</span>
        <button
          type="button"
          onClick={() => setShowForms((v) => !v)}
          aria-label="Dodaj podfolder / listę"
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
        <>
          <Tree
            folderMap={folderMap}
            listMap={listMap}
            parentId={folder.id}
            activeListId={activeListId}
            depth={depth + 1}
          />
          {showForms && (
            <div
              className="flex flex-col gap-1 rounded-sm bg-muted/50 p-1.5"
              style={{ marginLeft: `${(depth + 1) * 12}px` }}
            >
              <NewFolderForm parentId={folder.id} />
              <NewListForm folderId={folder.id} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ListLink({
  list,
  activeListId,
  depth,
}: {
  list: TodoListNode;
  activeListId: string | null;
  depth: number;
}) {
  const active = list.id === activeListId;
  return (
    <div
      className="group flex items-center gap-1 rounded-sm"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      <Link
        href={`/my/todo?listId=${list.id}`}
        data-active={active ? "true" : "false"}
        className="group/link flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-2 py-1 text-[0.86rem] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
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

function NewFolderForm({ parentId }: { parentId: string | null }) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createTodoFolderAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1"
    >
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder="+ nowy folder"
        className="h-7 flex-1 rounded-sm border border-transparent bg-background px-2 text-[0.82rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
      />
    </form>
  );
}

function NewListForm({ folderId }: { folderId: string | null }) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createTodoListAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1"
    >
      {folderId && <input type="hidden" name="folderId" value={folderId} />}
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder="+ nowa lista"
        className="h-7 flex-1 rounded-sm border border-transparent bg-background px-2 text-[0.82rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
      />
    </form>
  );
}

function ItemsPanel({
  listId,
  listName,
  items,
}: {
  listId: string;
  listName: string;
  items: TodoItemRow[];
}) {
  const [content, setContent] = useState("");
  const done = items.filter((i) => i.completed).length;

  return (
    <div className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-[1.2rem] font-semibold leading-tight tracking-[-0.01em]">
            {listName}
          </h2>
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            {done} z {items.length}
          </span>
        </div>
      </header>

      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0 hover:bg-accent/40"
          >
            <form
              action={(fd) => startTransition(() => toggleTodoItemAction(fd))}
              className="m-0 flex shrink-0"
            >
              <input type="hidden" name="id" value={item.id} />
              <input
                type="hidden"
                name="completed"
                value={item.completed ? "false" : "true"}
              />
              <button
                type="submit"
                aria-label={item.completed ? "Odznacz" : "Zaznacz"}
                className="grid h-5 w-5 place-items-center text-muted-foreground transition-colors hover:text-primary"
              >
                {item.completed ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            </form>
            <span
              className={`flex-1 truncate text-[0.92rem] transition-colors ${
                item.completed ? "text-muted-foreground line-through" : ""
              }`}
            >
              {item.content}
            </span>
            <form
              action={(fd) => startTransition(() => deleteTodoItemAction(fd))}
              className="m-0"
            >
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                aria-label="Usuń"
                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </form>
          </li>
        ))}
      </ul>

      <form
        action={(fd) =>
          startTransition(async () => {
            await createTodoItemAction(fd);
            setContent("");
          })
        }
        className="flex items-center gap-2 border-t border-border px-5 py-3"
      >
        <input type="hidden" name="listId" value={listId} />
        <Plus size={14} className="text-muted-foreground" />
        <input
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={300}
          placeholder="Dodaj zadanie…"
          className="flex-1 bg-transparent py-1 text-[0.92rem] outline-none placeholder:text-muted-foreground/60"
        />
      </form>
    </div>
  );
}
