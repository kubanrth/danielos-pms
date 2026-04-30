// F12-K43 L1: timing-safe Bearer token comparison dla cron endpoint'ów.
// Wcześniej każdy cron route miał inline `auth === 'Bearer ${secret}'`
// (string equality wczesnie wychodzi przy pierwszym różnym znaku).
// Realny atak na CRON_SECRET (32 bajty + Vercel infra) wymaga miliardów
// żądań, ale defense-in-depth = use timingSafeEqual.
//
// Wszystkie 3 cron route'y (send-reminders, spawn-recurring,
// workspace-backup) dzielą tę funkcję żeby uniknąć drift'u.

import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // timingSafeEqual wymaga buffer'ów tej samej długości — inaczej throw.
  // Zwracamy false gdy długości różne (wskazuje że auth jest klamą).
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
}
