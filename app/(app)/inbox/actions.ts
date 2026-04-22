"use server";

import { revalidatePath } from "next/cache";
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
