import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotesWorkspace } from "@/components/my/notes/notes-workspace";

// F9-15: 3-column Apple-Notes-style layout (fullwidth, no AppShell):
// folders | note list | editor. URL: /my/notes?folderId=<id>&noteId=<id>
// — so reloads keep the user's selection.
export default async function MyNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string; noteId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;
  const params = await searchParams;

  const [folders, allNotes] = await Promise.all([
    db.noteFolder.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.note.findMany({
      where: { userId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  // "Wszystkie" pseudo-folder: null folderId means show all notes.
  const selectedFolder = params.folderId ?? "all";
  const filteredNotes =
    selectedFolder === "all"
      ? allNotes
      : allNotes.filter((n) => n.folderId === selectedFolder);

  // Select the first note in the filtered list if user didn't pick one.
  const selectedNoteId =
    params.noteId ?? filteredNotes[0]?.id ?? null;
  const activeNote = selectedNoteId
    ? allNotes.find((n) => n.id === selectedNoteId) ?? null
    : null;

  return (
    <main className="flex-1 min-h-0">
      <NotesWorkspace
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        notes={filteredNotes.map((n) => ({
          id: n.id,
          title: n.title,
          snippet: n.content.slice(0, 80),
          updatedAt: n.updatedAt.toISOString(),
          pinned: n.pinned,
          folderId: n.folderId,
        }))}
        totalByFolder={countNotesByFolder(allNotes)}
        selectedFolder={selectedFolder}
        activeNote={
          activeNote
            ? {
                id: activeNote.id,
                title: activeNote.title,
                content: activeNote.content,
                folderId: activeNote.folderId,
                pinned: activeNote.pinned,
                updatedAt: activeNote.updatedAt.toISOString(),
              }
            : null
        }
      />
    </main>
  );
}

function countNotesByFolder(notes: { folderId: string | null }[]): Record<string, number> {
  const m: Record<string, number> = { all: notes.length, none: 0 };
  for (const n of notes) {
    if (n.folderId === null) m.none = (m.none ?? 0) + 1;
    else m[n.folderId] = (m[n.folderId] ?? 0) + 1;
  }
  return m;
}
