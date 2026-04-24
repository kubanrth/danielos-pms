"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// All mutations scope by session.user.id — there's no sharing model for
// TODO (it's intentionally private). If the user doesn't own the row,
// the row isn't touched.
async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// --- Folders ---

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().optional().or(z.literal("")),
});

export async function createTodoFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createFolderSchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId") || undefined,
  });
  if (!parsed.success) return;

  const last = await db.todoFolder.findFirst({
    where: {
      userId,
      parentId: parsed.data.parentId || null,
    },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.todoFolder.create({
    data: {
      userId,
      name: parsed.data.name,
      parentId: parsed.data.parentId || null,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidatePath("/my/todo");
}

const deleteFolderSchema = z.object({ id: z.string().min(1) });

export async function deleteTodoFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteFolderSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.todoFolder.deleteMany({
    where: { id: parsed.data.id, userId },
  });
  revalidatePath("/my/todo");
}

// --- Lists ---

const createListSchema = z.object({
  name: z.string().trim().min(1).max(80),
  folderId: z.string().optional().or(z.literal("")),
});

export async function createTodoListAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createListSchema.safeParse({
    name: formData.get("name"),
    folderId: formData.get("folderId") || undefined,
  });
  if (!parsed.success) return;

  const last = await db.todoList.findFirst({
    where: { userId, folderId: parsed.data.folderId || null },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.todoList.create({
    data: {
      userId,
      name: parsed.data.name,
      folderId: parsed.data.folderId || null,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidatePath("/my/todo");
}

const deleteListSchema = z.object({ id: z.string().min(1) });

export async function deleteTodoListAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteListSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.todoList.deleteMany({ where: { id: parsed.data.id, userId } });
  revalidatePath("/my/todo");
}

// --- Items ---

const createItemSchema = z.object({
  listId: z.string().min(1),
  content: z.string().trim().min(1).max(300),
});

export async function createTodoItemAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createItemSchema.safeParse({
    listId: formData.get("listId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return;

  // Ownership guard: the list must belong to current user.
  const list = await db.todoList.findFirst({
    where: { id: parsed.data.listId, userId },
    select: { id: true },
  });
  if (!list) return;

  const last = await db.todoItem.findFirst({
    where: { listId: parsed.data.listId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.todoItem.create({
    data: {
      listId: parsed.data.listId,
      userId,
      content: parsed.data.content,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidatePath("/my/todo");
}

const toggleItemSchema = z.object({
  id: z.string().min(1),
  completed: z.enum(["true", "false"]),
});

export async function toggleTodoItemAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = toggleItemSchema.safeParse({
    id: formData.get("id"),
    completed: formData.get("completed"),
  });
  if (!parsed.success) return;
  await db.todoItem.updateMany({
    where: { id: parsed.data.id, userId },
    data: { completed: parsed.data.completed === "true" },
  });
  revalidatePath("/my/todo");
}

const deleteItemSchema = z.object({ id: z.string().min(1) });

export async function deleteTodoItemAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteItemSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.todoItem.deleteMany({ where: { id: parsed.data.id, userId } });
  revalidatePath("/my/todo");
}
