"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Mark a single notification read — only for the recipient; we scope by
// userId so a doctored form body can't flip someone else's state.
export async function markNotificationReadAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const session = await auth();
  if (!session?.user) return;
  await db.notification.updateMany({
    where: { id, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/inbox");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user) return;
  await db.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/inbox");
}

// F12-K35: toggle read/unread (klik powtórny zaznacza ponownie jako
// nieprzeczytane).
export async function toggleNotificationReadAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const session = await auth();
  if (!session?.user) return;
  const existing = await db.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { readAt: true },
  });
  if (!existing) return;
  await db.notification.update({
    where: { id },
    data: { readAt: existing.readAt ? null : new Date() },
  });
  revalidatePath("/inbox");
}

// F12-K35: usuń pojedynczą notyfikację. Recipient-only — admin nie może
// czyścić cudzego inbox'u.
export async function deleteNotificationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const session = await auth();
  if (!session?.user) return;
  await db.notification.deleteMany({
    where: { id, userId: session.user.id },
  });
  revalidatePath("/inbox");
}

// F12-K35: bulk-delete wszystkich przeczytanych — typowy use case
// 'wyczyść inbox po sprintu'.
export async function deleteAllReadNotificationsAction() {
  const session = await auth();
  if (!session?.user) return;
  await db.notification.deleteMany({
    where: { userId: session.user.id, readAt: { not: null } },
  });
  revalidatePath("/inbox");
}

const updateNoteSchema = z.object({
  id: z.string().min(1),
  // Empty = remove note. Limit 500 znaków — to ma być adnotacja, nie esej.
  userNote: z.string().max(500),
});

// F12-K35: edytuj user-note doklejony do notyfikacji. Klient: 'zapisane
// powiadomienie musi mieć możliwość edycji'. Sam payload (auto-generowany)
// zostaje nietknięty; user może dopisać własną notatkę.
export async function updateNotificationNoteAction(input: {
  id: string;
  userNote: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Brak sesji." };
  const { count } = await db.notification.updateMany({
    where: { id: parsed.data.id, userId: session.user.id },
    data: { userNote: parsed.data.userNote.trim() || null },
  });
  if (count === 0) return { ok: false, error: "Notyfikacja nie istnieje." };
  revalidatePath("/inbox");
  return { ok: true };
}

// F12-K35: fetchuje 1 notyfikację dla `<UserToaster>` po realtime
// broadcast'cie (kanał `user:<userId>` przesyła tylko id, klient pobiera
// szczegóły żeby renderować toast).
export interface ToastNotificationPayload {
  id: string;
  type: string;
  createdAt: string;
  href: string;
  title: string;
  body: string | null;
  iconKind: "mention" | "poll" | "assigned" | "support" | "default";
}

export async function getNotificationForToastAction(input: {
  id: string;
}): Promise<{ ok: true; notification: ToastNotificationPayload } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Brak sesji." };
  const n = await db.notification.findFirst({
    where: { id: input.id, userId: session.user.id },
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
    },
  });
  if (!n) return { ok: false, error: "Notyfikacja nie istnieje." };

  const p = (n.payload ?? {}) as Record<string, unknown>;
  const workspaceId = typeof p.workspaceId === "string" ? p.workspaceId : null;
  const taskId = typeof p.taskId === "string" ? p.taskId : null;
  const taskTitle = typeof p.taskTitle === "string" ? p.taskTitle : null;
  const ticketId = typeof p.ticketId === "string" ? p.ticketId : null;
  const ticketTitle = typeof p.ticketTitle === "string" ? p.ticketTitle : null;
  const authorName = typeof p.authorName === "string" ? p.authorName : null;
  const actorName = typeof p.actorName === "string" ? p.actorName : null;
  const boardName = typeof p.boardName === "string" ? p.boardName : null;
  const status = typeof p.status === "string" ? p.status : null;

  let href = "/inbox";
  let title = "Nowe powiadomienie";
  let body: string | null = null;
  let iconKind: ToastNotificationPayload["iconKind"] = "default";

  switch (n.type) {
    case "comment.mention":
      iconKind = "mention";
      title = `${authorName ?? "Ktoś"} oznaczył(a) Cię w komentarzu`;
      body = taskTitle ?? null;
      if (workspaceId && taskId) href = `/w/${workspaceId}/t/${taskId}`;
      break;
    case "poll.created":
      iconKind = "poll";
      title = "Nowe głosowanie";
      body = taskTitle
        ? `${taskTitle}${boardName ? ` · ${boardName}` : ""}`
        : null;
      if (workspaceId && taskId) href = `/w/${workspaceId}/t/${taskId}`;
      break;
    case "task.assigned":
      iconKind = "assigned";
      title = `${actorName ?? "Ktoś"} przypisał(a) Cię do zadania`;
      body = taskTitle
        ? `${taskTitle}${boardName ? ` · ${boardName}` : ""}`
        : null;
      if (workspaceId && taskId) href = `/w/${workspaceId}/t/${taskId}`;
      break;
    case "support.resolved":
      iconKind = "support";
      title = `Zgłoszenie ${
        status === "RESOLVED" ? "rozwiązane" : "zamknięte"
      }`;
      body = ticketTitle ?? null;
      if (workspaceId) href = `/w/${workspaceId}/support`;
      break;
    case "support.assigned":
      iconKind = "support";
      title = `${actorName ?? "Ktoś"} przypisał(a) Cię do zgłoszenia`;
      body = ticketTitle ?? null;
      if (workspaceId && ticketId) href = `/w/${workspaceId}/support`;
      break;
    default:
      title = n.type;
  }

  return {
    ok: true,
    notification: {
      id: n.id,
      type: n.type,
      createdAt: n.createdAt.toISOString(),
      href,
      title,
      body,
      iconKind,
    },
  };
}
