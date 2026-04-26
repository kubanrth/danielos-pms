"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Folder,
  FolderOpen,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  createNoteAction,
  createNoteFolderAction,
  deleteNoteAction,
  deleteNoteFolderAction,
  emptyTrashAction,
  permanentDeleteNoteAction,
  renameNoteFolderAction,
  restoreNoteAction,
  togglePinNoteAction,
  updateNoteAction,
} from "@/app/(app)/my/notes/actions";
import {
  RichTextEditor,
  type RichTextDoc,
} from "@/components/task/rich-text-editor";

export interface NoteFolderRow {
  id: string;
  name: string;
}
export interface NoteListRow {
  id: string;
  title: string;
  snippet: string;
  updatedAt: string;
  pinned: boolean;
  folderId: string | null;
  // F11-23: marker for Trash view rows.
  isTrashed: boolean;
}
export interface ActiveNote {
  id: string;
  title: string;
  content: string;
  // F11-23: Tiptap rich-text doc.
  contentJson: RichTextDoc | null;
  folderId: string | null;
  pinned: boolean;
  isTrashed: boolean;
  updatedAt: string;
}

// F9-15 + F11-23 (#14): Apple-Notes-like 3-column layout with iOS parity:
// smart folders (Pinned/Recent/Trash), search, soft delete + restore,
// rich text via Tiptap.
export function NotesWorkspace({
  folders,
  notes,
  totalByFolder,
  selectedFolder,
  searchQuery,
  activeNote,
}: {
  folders: NoteFolderRow[];
  notes: NoteListRow[];
  totalByFolder: Record<string, number>;
  selectedFolder: string;
  searchQuery: string;
  activeNote: ActiveNote | null;
}) {
  return (
    <div className="flex h-[calc(100dvh-0px)] overflow-hidden">
      <FoldersColumn
        folders={folders}
        totalByFolder={totalByFolder}
        selectedFolder={selectedFolder}
      />
      <NotesListColumn
        notes={notes}
        activeNoteId={activeNote?.id ?? null}
        selectedFolder={selectedFolder}
        searchQuery={searchQuery}
      />
      <EditorColumn note={activeNote} folders={folders} />
    </div>
  );
}

// --- Left column: folders ---

function FoldersColumn({
  folders,
  totalByFolder,
  selectedFolder,
}: {
  folders: NoteFolderRow[];
  totalByFolder: Record<string, number>;
  selectedFolder: string;
}) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-card/60 p-3">
      <div className="px-2 pt-1 pb-2">
        <span className="eyebrow">Notatnik</span>
      </div>

      {/* F11-23: smart folders (iOS parity). Pinned + Recent + Trash. */}
      <FolderLink
        href="/my/notes"
        active={selectedFolder === "all"}
        label="Wszystkie"
        count={totalByFolder.all ?? 0}
        icon={<FolderOpen size={13} className="text-primary/70" />}
      />
      <FolderLink
        href="/my/notes?folderId=pinned"
        active={selectedFolder === "pinned"}
        label="Przypięte"
        count={totalByFolder.pinned ?? 0}
        icon={<Pin size={13} className="text-amber-500" />}
      />
      <FolderLink
        href="/my/notes?folderId=recent"
        active={selectedFolder === "recent"}
        label="Ostatnie 30 dni"
        count={totalByFolder.recent ?? 0}
        icon={<Clock size={13} className="text-sky-500" />}
      />

      <div className="my-1 border-t border-border" />

      {folders.map((f) => (
        <FolderRow
          key={f.id}
          folder={f}
          active={selectedFolder === f.id}
          count={totalByFolder[f.id] ?? 0}
        />
      ))}

      <div className="mt-auto flex flex-col gap-1.5">
        <FolderLink
          href="/my/notes?folderId=trash"
          active={selectedFolder === "trash"}
          label="Kosz"
          count={totalByFolder.trash ?? 0}
          icon={<Trash2 size={13} className="text-muted-foreground" />}
        />
        <NewFolderForm />
      </div>
    </aside>
  );
}

function FolderLink({
  href,
  active,
  label,
  count,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.88rem] transition-colors hover:bg-accent/60 data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[0.62rem] text-muted-foreground">{count}</span>
    </Link>
  );
}

function FolderRow({
  folder,
  active,
  count,
}: {
  folder: NoteFolderRow;
  active: boolean;
  count: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  if (renaming) {
    return (
      <form
        action={(fd) =>
          startTransition(async () => {
            await renameNoteFolderAction(fd);
            setRenaming(false);
          })
        }
        className="flex items-center gap-2 rounded-md px-2 py-1.5"
      >
        <Folder size={13} className="text-primary/70 shrink-0" />
        <input type="hidden" name="id" value={folder.id} />
        <input
          name="name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          required
          maxLength={80}
          onBlur={(e) => {
            if (draft.trim() === folder.name || draft.trim() === "") {
              setDraft(folder.name);
              setRenaming(false);
              return;
            }
            (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(folder.name);
              setRenaming(false);
            }
          }}
          className="flex-1 min-w-0 rounded-sm border border-primary/40 bg-background px-1.5 py-0.5 text-[0.85rem] outline-none focus:border-primary"
        />
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-1 rounded-md">
      <Link
        href={`/my/notes?folderId=${folder.id}`}
        data-active={active ? "true" : "false"}
        onDoubleClick={() => setRenaming(true)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[0.88rem] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
      >
        <Folder size={13} className="text-primary/70 shrink-0" />
        <span className="flex-1 truncate">{folder.name}</span>
        <span className="font-mono text-[0.62rem] text-muted-foreground">{count}</span>
      </Link>
      <form
        action={(fd) => startTransition(() => deleteNoteFolderAction(fd))}
        className="m-0"
      >
        <input type="hidden" name="id" value={folder.id} />
        <button
          type="submit"
          aria-label="Usuń folder"
          title="Usuń folder"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </form>
    </div>
  );
}

function NewFolderForm() {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createNoteFolderAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1 border-t border-border pt-2"
    >
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder="nowy folder"
        className="h-8 flex-1 rounded-md border border-transparent bg-background px-2 text-[0.82rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Dodaj folder"
        title="Dodaj folder (Enter)"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={12} />
      </button>
    </form>
  );
}

// --- Middle column: note list ---

function NotesListColumn({
  notes,
  activeNoteId,
  selectedFolder,
  searchQuery,
}: {
  notes: NoteListRow[];
  activeNoteId: string | null;
  selectedFolder: string;
  searchQuery: string;
}) {
  // F11-23: don't auto-target trash/pinned/recent for create — only
  // concrete folders pre-fill folderId on new notes.
  const folderId =
    selectedFolder === "all" ||
    selectedFolder === "pinned" ||
    selectedFolder === "recent" ||
    selectedFolder === "trash"
      ? ""
      : selectedFolder;
  const isTrash = selectedFolder === "trash";

  const router = useRouter();
  const [search, setSearch] = useState(searchQuery);

  // F11-23: debounced search → URL param so refreshes preserve query.
  useEffect(() => {
    if (search === searchQuery) return;
    const h = setTimeout(() => {
      const params = new URLSearchParams();
      if (selectedFolder && selectedFolder !== "all")
        params.set("folderId", selectedFolder);
      if (search.trim()) params.set("q", search.trim());
      router.replace(`/my/notes${params.toString() ? `?${params}` : ""}`);
    }, 300);
    return () => clearTimeout(h);
  }, [search, searchQuery, selectedFolder, router]);

  // Group by pinned vs. rest — matches Apple Notes grouping. Trash view
  // skips the grouping (everything is "trashed").
  const pinned = isTrash ? [] : notes.filter((n) => n.pinned);
  const rest = isTrash ? notes : notes.filter((n) => !n.pinned);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-border bg-background">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">
            {isTrash
              ? notes.length === 1
                ? "1 w koszu"
                : `${notes.length} w koszu`
              : notes.length === 1
                ? "1 notatka"
                : `${notes.length} notatek`}
          </span>
          {!isTrash ? (
            <form
              action={(fd) => startTransition(() => createNoteAction(fd))}
              className="m-0"
            >
              <input type="hidden" name="folderId" value={folderId} />
              <button
                type="submit"
                aria-label="Nowa notatka"
                title="Nowa notatka"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus size={14} />
              </button>
            </form>
          ) : (
            notes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Usunąć wszystkie z kosza? Nie da się tego cofnąć.")) return;
                  startTransition(() => emptyTrashAction());
                }}
                className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-destructive"
              >
                Opróżnij
              </button>
            )
          )}
        </div>

        {/* F11-23: search bar (Apple Notes parity). Filtruje po title +
            content (snippet). Debounced 300ms → URL param. */}
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 transition-colors focus-within:border-primary/60">
          <Search size={11} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj…"
            className="flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Wyczyść"
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <StickyNote size={22} className="text-muted-foreground/60" />
            <p className="mt-3 font-display text-[0.95rem] font-semibold">
              Pusto tu.
            </p>
            <p className="mt-1 text-[0.84rem] text-muted-foreground">
              Dodaj pierwszą notatkę klikając +
            </p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Przypięte
                </div>
                {pinned.map((n) => (
                  <NoteCard key={n.id} note={n} active={n.id === activeNoteId} />
                ))}
              </>
            )}
            {rest.length > 0 && pinned.length > 0 && (
              <div className="mt-1 px-4 pt-3 pb-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">
                Pozostałe
              </div>
            )}
            {rest.map((n) => (
              <NoteCard key={n.id} note={n} active={n.id === activeNoteId} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

function NoteCard({ note, active }: { note: NoteListRow; active: boolean }) {
  return (
    <Link
      href={`/my/notes?noteId=${note.id}${note.folderId ? `&folderId=${note.folderId}` : ""}`}
      data-active={active ? "true" : "false"}
      className="block border-b border-border px-4 py-3 transition-colors hover:bg-accent/40 data-[active=true]:bg-primary/10"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em]">
          {note.title || "Bez tytułu"}
        </span>
        {note.pinned && <Pin size={11} className="shrink-0 text-amber-500" />}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[0.78rem] text-muted-foreground">
        <span className="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.14em]">
          {formatShortDateTime(note.updatedAt)}
        </span>
        <span className="truncate">{note.snippet || "Brak dodatkowego tekstu"}</span>
      </div>
    </Link>
  );
}

// --- Right column: editor ---

function EditorColumn({
  note,
  folders,
}: {
  note: ActiveNote | null;
  folders: NoteFolderRow[];
}) {
  if (!note) {
    return (
      <section className="flex flex-1 items-center justify-center bg-background">
        <div className="max-w-[320px] text-center text-muted-foreground">
          <StickyNote size={28} className="mx-auto text-muted-foreground/50" />
          <p className="mt-3 font-display text-[1rem] font-semibold text-foreground">
            Wybierz notatkę z listy.
          </p>
          <p className="mt-1 text-[0.88rem]">
            Albo kliknij <strong>+</strong> aby utworzyć nową.
          </p>
        </div>
      </section>
    );
  }
  return <NoteEditor key={note.id} note={note} folders={folders} />;
}

function NoteEditor({ note, folders }: { note: ActiveNote; folders: NoteFolderRow[] }) {
  const [title, setTitle] = useState(note.title);
  const [doc, setDoc] = useState<RichTextDoc | null>(note.contentJson);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const isTrashed = note.isTrashed;

  // Autosave with debounce — matches Apple Notes (edits persist as you
  // type, no explicit Save button). Trashed notes are read-only.
  useEffect(() => {
    if (isTrashed) return;
    const docStr = doc ? JSON.stringify(doc) : "";
    const initialDocStr = note.contentJson ? JSON.stringify(note.contentJson) : "";
    if (title === note.title && docStr === initialDocStr) return;
    const h = setTimeout(() => {
      const fd = new FormData();
      fd.set("id", note.id);
      fd.set("title", title);
      if (doc) fd.set("contentJson", JSON.stringify(doc));
      startTransition(async () => {
        await updateNoteAction(fd);
        setSavedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
      });
    }, 500);
    return () => clearTimeout(h);
  }, [title, doc, note.id, note.title, note.contentJson, isTrashed]);

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          {formatLongDateTime(note.updatedAt)}
        </span>
        {savedAt && !isTrashed && (
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-primary">
            zapisano {savedAt}
          </span>
        )}
        {isTrashed && (
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-destructive">
            🗑 w koszu — przywróć żeby edytować
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {isTrashed ? (
            <>
              <form
                action={(fd) => startTransition(() => restoreNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Przywróć"
                  title="Przywróć z kosza"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  <RotateCcw size={13} /> Przywróć
                </button>
              </form>
              <form
                action={(fd) => startTransition(() => permanentDeleteNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Usuń trwale"
                  title="Usuń na zawsze"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </>
          ) : (
            <>
              <form
                action={(fd) => startTransition(() => togglePinNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <input
                  type="hidden"
                  name="next"
                  value={note.pinned ? "false" : "true"}
                />
                <button
                  type="submit"
                  aria-label={note.pinned ? "Odepnij" : "Przypnij"}
                  title={note.pinned ? "Odepnij" : "Przypnij"}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-amber-500 data-[on=true]:text-amber-500"
                  data-on={note.pinned ? "true" : "false"}
                >
                  {note.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                </button>
              </form>

              <form
                action={(fd) => startTransition(() => deleteNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Usuń (do kosza)"
                  title="Przenieś do kosza"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </form>

              <select
                value={note.folderId ?? ""}
                onChange={(e) => {
                  const fd = new FormData();
                  fd.set("id", note.id);
                  fd.set("folderId", e.target.value);
                  startTransition(async () => {
                    const { moveNoteAction } = await import("@/app/(app)/my/notes/actions");
                    await moveNoteAction(fd);
                  });
                }}
                className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
              >
                <option value="">— brak folderu —</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tytuł"
          maxLength={200}
          readOnly={isTrashed}
          className="w-full border-0 bg-transparent pb-2 font-display text-[2rem] font-bold leading-tight tracking-[-0.02em] outline-none placeholder:text-muted-foreground/40"
        />
        {/* F11-23: Tiptap rich-text editor (StarterKit + headings + lists +
            checklists). Reuses the editor from task descriptions. */}
        <div className="flex-1">
          <RichTextEditor
            initial={doc}
            readOnly={isTrashed}
            placeholder="Zacznij pisać…"
            variant="display"
            onChange={(d) => setDoc(d)}
          />
        </div>
      </div>
    </section>
  );
}

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function formatLongDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
}
