"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateNewSecret,
  generateRecoveryCodes,
  verifyTotpToken,
} from "@/lib/totp";

export type BeginEnrollmentResult =
  | { ok: true; base32: string; otpauthUrl: string }
  | { ok: false; error: string };

// Step 1/2: mint a fresh secret and stash it on the user row without
// enabling 2FA yet. totpEnabledAt stays null until completeEnrollment
// confirms the user can read codes from their authenticator. Calling
// this twice just rotates the secret — no damage, old QR invalidated.
export async function beginTotpEnrollmentAction(): Promise<BeginEnrollmentResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Nie zalogowany." };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, totpEnabledAt: true },
  });
  if (!user) return { ok: false, error: "Użytkownik nie istnieje." };
  if (user.totpEnabledAt) {
    return { ok: false, error: "2FA jest już włączone — najpierw wyłącz." };
  }

  const bundle = generateNewSecret(user.email);
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: bundle.base32 },
  });
  return { ok: true, base32: bundle.base32, otpauthUrl: bundle.otpauthUrl };
}

export type CompleteEnrollmentResult =
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; error: string };

// Step 2/2: user enters the first 6-digit token from their app. On
// success we flip totpEnabledAt, generate 10 single-use recovery codes,
// and return the plain codes ONCE so the UI can display them. We
// persist only bcrypt hashes.
export async function completeTotpEnrollmentAction(input: {
  token: string;
}): Promise<CompleteEnrollmentResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Nie zalogowany." };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, totpSecret: true, totpEnabledAt: true },
  });
  if (!user) return { ok: false, error: "Użytkownik nie istnieje." };
  if (!user.totpSecret) return { ok: false, error: "Nie ma aktywnego setupu." };
  if (user.totpEnabledAt) return { ok: false, error: "2FA już włączone." };

  const delta = verifyTotpToken(user.totpSecret, input.token);
  if (delta === null) return { ok: false, error: "Kod nieprawidłowy." };

  const { plain, hashed } = generateRecoveryCodes();
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date() },
    }),
    // Wipe any stale recovery codes from a prior attempt that never
    // completed — shouldn't exist, but defensive.
    db.totpRecoveryCode.deleteMany({ where: { userId: user.id } }),
    db.totpRecoveryCode.createMany({
      data: hashed.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  revalidatePath("/profile");
  return { ok: true, recoveryCodes: plain };
}

export type DisableResult = { ok: true } | { ok: false; error: string };

// Requires current password + current TOTP token. Dropping 2FA without
// this double-check would mean a compromised session auto-downgrades
// the account.
export async function disableTotpAction(input: {
  password: string;
  token: string;
}): Promise<DisableResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Nie zalogowany." };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      passwordHash: true,
      totpSecret: true,
      totpEnabledAt: true,
    },
  });
  if (!user || !user.passwordHash || !user.totpSecret || !user.totpEnabledAt) {
    return { ok: false, error: "2FA nie jest włączone." };
  }

  const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordOk) return { ok: false, error: "Nieprawidłowe hasło." };

  const delta = verifyTotpToken(user.totpSecret, input.token);
  if (delta === null) return { ok: false, error: "Kod nieprawidłowy." };

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnabledAt: null },
    }),
    db.totpRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);

  revalidatePath("/profile");
  return { ok: true };
}
