"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// F9-15: private per-user Notes module (Apple-Notes parity). All
// actions scope by session user — the module is intentionally
// single-player.

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// --- Folders ---

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function createNoteFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createFolderSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return;

  const last = await db.noteFolder.findFirst({
    where: { userId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.noteFolder.create({
    data: {
      userId,
      name: parsed.data.name,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidatePath("/my/notes");
}

const deleteFolderSchema = z.object({ id: z.string().min(1) });

export async function deleteNoteFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteFolderSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.noteFolder.deleteMany({ where: { id: parsed.data.id, userId } });
  revalidatePath("/my/notes");
}

const renameFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function renameNoteFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = renameFolderSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;
  await db.noteFolder.updateMany({
    where: { id: parsed.data.id, userId },
    data: { name: parsed.data.name },
  });
  revalidatePath("/my/notes");
}

// --- Notes ---

const createNoteSchema = z.object({
  folderId: z.string().optional().or(z.literal("")),
});

export async function createNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createNoteSchema.safeParse({
    folderId: formData.get("folderId") ?? "",
  });
  if (!parsed.success) return;

  // Validate folder ownership if provided.
  let folderId: string | null = null;
  if (parsed.data.folderId) {
    const f = await db.noteFolder.findFirst({
      where: { id: parsed.data.folderId, userId },
      select: { id: true },
    });
    if (f) folderId = f.id;
  }

  const note = await db.note.create({
    data: { userId, folderId, title: "Nowa notatka" },
  });
  // Auto-open the new note — user starts typing immediately.
  redirect(`/my/notes?noteId=${note.id}`);
}

const updateNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  content: z.string().max(50_000).optional(),
});

export async function updateNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = updateNoteSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    content: formData.get("content") ?? undefined,
  });
  if (!parsed.success) return;
  const data: { title?: string; content?: string } = {};
  if (typeof parsed.data.title === "string") data.title = parsed.data.title;
  if (typeof parsed.data.content === "string") data.content = parsed.data.content;
  if (Object.keys(data).length === 0) return;
  await db.note.updateMany({
    where: { id: parsed.data.id, userId },
    data,
  });
  revalidatePath("/my/notes");
}

const moveNoteSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().optional().or(z.literal("")),
});

export async function moveNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = moveNoteSchema.safeParse({
    id: formData.get("id"),
    folderId: formData.get("folderId") ?? "",
  });
  if (!parsed.success) return;

  let folderId: string | null = null;
  if (parsed.data.folderId) {
    const f = await db.noteFolder.findFirst({
      where: { id: parsed.data.folderId, userId },
      select: { id: true },
    });
    if (f) folderId = f.id;
  }
  await db.note.updateMany({
    where: { id: parsed.data.id, userId },
    data: { folderId },
  });
  revalidatePath("/my/notes");
}

const deleteNoteSchema = z.object({ id: z.string().min(1) });

export async function deleteNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteNoteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.note.deleteMany({ where: { id: parsed.data.id, userId } });
  revalidatePath("/my/notes");
}

const togglePinSchema = z.object({
  id: z.string().min(1),
  next: z.enum(["true", "false"]),
});

export async function togglePinNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = togglePinSchema.safeParse({
    id: formData.get("id"),
    next: formData.get("next"),
  });
  if (!parsed.success) return;
  await db.note.updateMany({
    where: { id: parsed.data.id, userId },
    data: { pinned: parsed.data.next === "true" },
  });
  revalidatePath("/my/notes");
}
