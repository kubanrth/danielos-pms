"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const BCRYPT_COST = 12;

type FieldErrors = { currentPassword?: string; newPassword?: string };

export type ChangePasswordState =
  | { ok: true; message: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  const fe: FieldErrors = {};
  if (!currentPassword) fe.currentPassword = "Podaj aktualne hasło.";
  if (newPassword.length < 8) fe.newPassword = "Hasło musi mieć min 8 znaków.";
  else if (newPassword.length > 200) fe.newPassword = "Hasło za długie (max 200).";
  if (Object.keys(fe).length > 0) return { ok: false, fieldErrors: fe };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { ok: false, error: "Konto bez hasła — skontaktuj się z administratorem." };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return {
      ok: false,
      fieldErrors: { currentPassword: "Nieprawidłowe aktualne hasło." },
    };
  }

  if (currentPassword === newPassword) {
    return {
      ok: false,
      fieldErrors: { newPassword: "Nowe hasło musi być inne niż aktualne." },
    };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return { ok: true, message: "Hasło zmienione." };
}
