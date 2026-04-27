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
});

// F9-11: Client feedback was that folders should only contain lists,
// not nested sub-folders (MS To Do parity). We ignore any parentId
// that might have been posted by a legacy form.
export async function createTodoFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createFolderSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const last = await db.todoFolder.findFirst({
    where: { userId, parentId: null },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.todoFolder.create({
    data: {
      userId,
      name: parsed.data.name,
      parentId: null,
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

// F12-K28: bulk-delete completed items na liście. Optional listId
// (gdy pusty/brak — usuwa wszystkie completed użytkownika, np. ze
// smart view'u). Klient: 'usuń wszystkie wykonane zadania'.
const bulkDeleteCompletedSchema = z.object({
  listId: z.string().optional(),
});

export async function bulkDeleteCompletedTodoItemsAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = bulkDeleteCompletedSchema.safeParse({
    listId: formData.get("listId") || undefined,
  });
  if (!parsed.success) return;
  await db.todoItem.deleteMany({
    where: {
      userId,
      completed: true,
      ...(parsed.data.listId ? { listId: parsed.data.listId } : {}),
    },
  });
  revalidatePath("/my/todo");
}

// F8c — MS To Do parity ==================================================

const itemIdSchema = z.object({ id: z.string().min(1) });

// Toggle star / Ważne. `next` is the target state so the UI button can
// pass "true"/"false" explicitly — prevents racy double-toggles when the
// user clicks fast.
const toggleBoolSchema = z.object({
  id: z.string().min(1),
  next: z.enum(["true", "false"]),
});

export async function toggleTodoImportantAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = toggleBoolSchema.safeParse({
    id: formData.get("id"),
    next: formData.get("next"),
  });
  if (!parsed.success) return;
  await db.todoItem.updateMany({
    where: { id: parsed.data.id, userId },
    data: { important: parsed.data.next === "true" },
  });
  revalidatePath("/my/todo");
}

// Add to / remove from "Mój dzień". Setting timestamp = now lets us
// expire membership at the next day boundary without a cron — the page
// filters by `myDayAt >= todayStart`.
export async function toggleTodoMyDayAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = toggleBoolSchema.safeParse({
    id: formData.get("id"),
    next: formData.get("next"),
  });
  if (!parsed.success) return;
  await db.todoItem.updateMany({
    where: { id: parsed.data.id, userId },
    data: { myDayAt: parsed.data.next === "true" ? new Date() : null },
  });
  revalidatePath("/my/todo");
}

const setDueSchema = z.object({
  id: z.string().min(1),
  // Empty string = clear the date; otherwise ISO string.
  dueDate: z.string().optional().or(z.literal("")),
});

export async function setTodoDueDateAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = setDueSchema.safeParse({
    id: formData.get("id"),
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) return;
  let due: Date | null = null;
  if (parsed.data.dueDate && parsed.data.dueDate.trim() !== "") {
    const d = new Date(parsed.data.dueDate);
    if (!Number.isNaN(d.getTime())) due = d;
  }
  await db.todoItem.updateMany({
    where: { id: parsed.data.id, userId },
    data: { dueDate: due },
  });
  revalidatePath("/my/todo");
}

const setReminderSchema = z.object({
  id: z.string().min(1),
  reminderAt: z.string().optional().or(z.literal("")),
});

export async function setTodoReminderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = setReminderSchema.safeParse({
    id: formData.get("id"),
    reminderAt: formData.get("reminderAt") ?? "",
  });
  if (!parsed.success) return;
  let at: Date | null = null;
  if (parsed.data.reminderAt && parsed.data.reminderAt.trim() !== "") {
    const d = new Date(parsed.data.reminderAt);
    if (!Number.isNaN(d.getTime())) at = d;
  }
  await db.todoItem.updateMany({
    where: { id: parsed.data.id, userId },
    // Clearing reminderSentAt when time changes so cron re-fires.
    data: { reminderAt: at, reminderSentAt: null },
  });
  revalidatePath("/my/todo");
}

const updateNotesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().max(5000),
});

export async function updateTodoNotesAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = updateNotesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return;
  await db.todoItem.updateMany({
    where: { id: parsed.data.id, userId },
    data: { notes: parsed.data.notes.length === 0 ? null : parsed.data.notes },
  });
  revalidatePath("/my/todo");
}

const updateTitleSchema = z.object({
  id: z.string().min(1),
  content: z.string().trim().min(1).max(300),
});

export async function updateTodoTitleAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = updateTitleSchema.safeParse({
    id: formData.get("id"),
    content: formData.get("content"),
  });
  if (!parsed.success) return;
  await db.todoItem.updateMany({
    where: { id: parsed.data.id, userId },
    data: { content: parsed.data.content },
  });
  revalidatePath("/my/todo");
}

// --- Steps (MS To Do "Kroki") ---

const createStepSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
});

export async function createTodoStepAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createStepSchema.safeParse({
    itemId: formData.get("itemId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return;

  // Ownership: parent item must belong to current user.
  const owner = await db.todoItem.findFirst({
    where: { id: parsed.data.itemId, userId },
    select: { id: true },
  });
  if (!owner) return;

  const last = await db.todoStep.findFirst({
    where: { itemId: parsed.data.itemId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.todoStep.create({
    data: {
      itemId: parsed.data.itemId,
      title: parsed.data.title,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidatePath("/my/todo");
}

const toggleStepSchema = z.object({
  id: z.string().min(1),
  completed: z.enum(["true", "false"]),
});

export async function toggleTodoStepAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = toggleStepSchema.safeParse({
    id: formData.get("id"),
    completed: formData.get("completed"),
  });
  if (!parsed.success) return;

  // Ownership via item → user.
  const step = await db.todoStep.findUnique({
    where: { id: parsed.data.id },
    include: { item: { select: { userId: true } } },
  });
  if (!step || step.item.userId !== userId) return;

  await db.todoStep.update({
    where: { id: parsed.data.id },
    data: { completed: parsed.data.completed === "true" },
  });
  revalidatePath("/my/todo");
}

const deleteStepSchema = z.object({ id: z.string().min(1) });

export async function deleteTodoStepAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteStepSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const step = await db.todoStep.findUnique({
    where: { id: parsed.data.id },
    include: { item: { select: { userId: true } } },
  });
  if (!step || step.item.userId !== userId) return;
  await db.todoStep.delete({ where: { id: parsed.data.id } });
  revalidatePath("/my/todo");
}

// F12-K28: notes per subtask. Klient zażądał opisów dla każdego
// pod-zadania, nie tylko parent task'a.
const updateStepNotesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().max(5000),
});

export async function updateTodoStepNotesAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = updateStepNotesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return;
  const step = await db.todoStep.findUnique({
    where: { id: parsed.data.id },
    include: { item: { select: { userId: true } } },
  });
  if (!step || step.item.userId !== userId) return;
  await db.todoStep.update({
    where: { id: parsed.data.id },
    data: { notes: parsed.data.notes.trim() === "" ? null : parsed.data.notes },
  });
  revalidatePath("/my/todo");
}

const updateStepTitleSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
});

export async function updateTodoStepTitleAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = updateStepTitleSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
  });
  if (!parsed.success) return;
  const step = await db.todoStep.findUnique({
    where: { id: parsed.data.id },
    include: { item: { select: { userId: true } } },
  });
  if (!step || step.item.userId !== userId) return;
  await db.todoStep.update({
    where: { id: parsed.data.id },
    data: { title: parsed.data.title },
  });
  revalidatePath("/my/todo");
}
