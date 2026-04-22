// Thin wrapper around `otpauth` + recovery-code helpers.
//
// Secrets live in User.totpSecret as base32 (what authenticator apps
// expect) — no extra at-rest encryption because (a) RLS now denies the
// anon role, (b) the DB is hosted on Supabase with backups encrypted,
// (c) TOTP secrets without a second factor (the password) don't grant
// access anyway. If we later move to high-security tenancy we should
// wrap this in a KMS envelope.

import { Secret, TOTP } from "otpauth";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

const ISSUER = "DANIELOS PMS";
const DIGITS = 6;
const PERIOD = 30;
const WINDOW = 1; // accept previous + current + next 30s slice
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 6; // → 12 hex chars, grouped as 4-4-4

export interface NewSecretBundle {
  base32: string;
  otpauthUrl: string;
}

export function generateNewSecret(userEmail: string): NewSecretBundle {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret,
  });
  return { base32: secret.base32, otpauthUrl: totp.toString() };
}

// Verifies a 6-digit token against a stored base32 secret with a small
// ± window so clock skew between client and server doesn't lock users
// out. Returns delta (0 for current slice, ±N for past/future slices)
// or null on mismatch.
export function verifyTotpToken(base32Secret: string, token: string): number | null {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return null;
  const totp = new TOTP({
    issuer: ISSUER,
    label: "ignored",
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(base32Secret),
  });
  const delta = totp.validate({ token: cleaned, window: WINDOW });
  return delta;
}

// Generates N single-use recovery codes. Plain text is shown to the
// user ONCE — only the bcrypt hash is persisted.
export function generateRecoveryCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const bytes = crypto.randomBytes(RECOVERY_CODE_BYTES);
    const hex = bytes.toString("hex").toUpperCase();
    // XXXX-XXXX-XXXX style grouping for readability.
    const code = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    plain.push(code);
    hashed.push(bcrypt.hashSync(code, 10));
  }
  return { plain, hashed };
}

// Returns true if `input` bcrypt-matches any of the provided hashes.
// Scales linearly with the number of codes (10) — fine for login path.
export function verifyRecoveryCode(
  input: string,
  hashes: string[],
): number | null {
  const normalised = input.trim().toUpperCase();
  if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(normalised)) return null;
  for (let i = 0; i < hashes.length; i++) {
    if (bcrypt.compareSync(normalised, hashes[i])) return i;
  }
  return null;
}
