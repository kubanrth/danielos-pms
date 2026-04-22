// F8c: 2FA TOTP end-to-end.
//
// Exercises the whole flow as the admin account:
//   1. Login normally (no 2FA yet).
//   2. Visit /profile, click "Włącz 2FA", grab the freshly-minted secret
//      from the DOM. Compute a current TOTP token locally and submit it.
//   3. Capture the 10 recovery codes the UI shows.
//   4. Logout + log back in with email + password + TOTP → should succeed.
//   5. Logout + log back in with email + password + recovery code → also
//      succeeds, and the used code is marked consumed.
//   6. Logout + try logging in with JUST email + password → should fail.
//   7. Disable 2FA via password + TOTP. State cleaned up so later smokes
//      aren't affected.
//
// The failure scenario (6) relies on Credentials signIn returning the
// portal page on rejection — we detect by URL staying on /secure-access-portal.
import "dotenv/config";
import puppeteer, { type Page } from "puppeteer";
import { TOTP, Secret } from "otpauth";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ADMIN_EMAIL = "admin@danielos.local";
const ADMIN_PW = "danielos-demo-2026";

function currentTotp(base32: string): string {
  const totp = new TOTP({
    issuer: "DANIELOS PMS",
    label: ADMIN_EMAIL,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(base32),
  });
  return totp.generate();
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  // Clean state up front — guarantees a predictable starting point if
  // a prior smoke bailed half-way.
  await db.user.update({
    where: { email: ADMIN_EMAIL },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  await db.totpRecoveryCode.deleteMany({
    where: { user: { email: ADMIN_EMAIL } },
  });

  const browser = await puppeteer.launch({ headless: true });

  const login = async (page: Page, totp = "") => {
    await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
    await page.type('input[name="email"]', ADMIN_EMAIL);
    await page.type('input[name="password"]', ADMIN_PW);
    if (totp) await page.type('input[name="totp"]', totp);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    await new Promise((r) => setTimeout(r, 500));
    return page.url();
  };

  const logout = async (page: Page) => {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.trim() === "Wyloguj",
      );
      (btn as HTMLButtonElement | undefined)?.click();
    });
    await new Promise((r) => setTimeout(r, 900));
  };

  // ── 1. Plain login (no 2FA yet) ──────────────────────────────────
  const loginPage = await browser.newPage();
  await loginPage.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  const urlAfterLogin = await login(loginPage);
  console.log("[1] plain login landed on:", urlAfterLogin);
  if (urlAfterLogin.includes("/secure-access-portal")) {
    throw new Error("admin login failed before 2FA enrolled");
  }

  // ── 2. Visit /profile, enroll 2FA ────────────────────────────────
  await loginPage.goto("http://localhost:3100/profile", { waitUntil: "networkidle0" });
  const foundBtn = await loginPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim() === "Włącz 2FA",
    );
    if (!btn) return false;
    (btn as HTMLButtonElement).click();
    return true;
  });
  if (!foundBtn) throw new Error("Włącz 2FA button not found");
  // Give the server action + dynamic qrcode import time to resolve.
  await new Promise((r) => setTimeout(r, 2500));
  const domState = await loginPage.evaluate(() => ({
    codes: document.querySelectorAll("code").length,
    bodyPreview: document.body.textContent?.slice(0, 400),
  }));
  console.log("[2a] after begin — code tags:", domState.codes);
  if (domState.codes === 0) {
    console.log("[2a] body preview:", domState.bodyPreview);
    throw new Error("begin enrollment didn't render the setup panel");
  }
  // Pull the secret from the <code> block under the "Sekret" eyebrow.
  const secret = await loginPage.evaluate(() => {
    const codes = Array.from(document.querySelectorAll("code"));
    // The secret code is BASE32 — letters + digits, 32 chars typical.
    const hit = codes.find((c) => /^[A-Z2-7]{16,64}$/.test(c.textContent?.trim() ?? ""));
    return hit?.textContent?.trim() ?? null;
  });
  if (!secret) throw new Error("couldn't locate base32 secret in the DOM");
  console.log("[2] enrollment secret captured, length:", secret.length);

  // Submit first TOTP
  const token = currentTotp(secret);
  await loginPage.type('input[placeholder="123 456"]', token);
  await loginPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Potwierdź"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await loginPage.waitForFunction(
    () => !!Array.from(document.querySelectorAll("span")).find((s) => s.textContent === "2FA włączone"),
    { timeout: 5000 },
  );
  const codes = await loginPage.evaluate(() =>
    Array.from(document.querySelectorAll("li"))
      .map((li) => li.textContent?.trim() ?? "")
      .filter((t) => /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(t)),
  );
  console.log("[3] recovery codes captured:", codes.length);
  if (codes.length !== 10) throw new Error(`expected 10 recovery codes, got ${codes.length}`);

  // DB state check
  const userAfterEnroll = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { totpEnabledAt: true, totpSecret: true },
  });
  if (!userAfterEnroll?.totpEnabledAt) throw new Error("totpEnabledAt not set");
  if (userAfterEnroll.totpSecret !== secret) throw new Error("DB secret doesn't match UI");

  // ── 3. Login with TOTP works ─────────────────────────────────────
  const totpCtx = await browser.createBrowserContext();
  const totpPage = await totpCtx.newPage();
  await totpPage.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  const afterTotp = await login(totpPage, currentTotp(secret));
  console.log("[4] login with TOTP landed on:", afterTotp);
  if (afterTotp.includes("/secure-access-portal")) {
    throw new Error("TOTP login should have succeeded");
  }
  await totpPage.close();
  await totpCtx.close();

  // ── 4. Login with recovery code works ────────────────────────────
  const recoveryCtx = await browser.createBrowserContext();
  const recoveryPage = await recoveryCtx.newPage();
  await recoveryPage.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  const afterRecovery = await login(recoveryPage, codes[0]);
  console.log("[5] login with recovery code landed on:", afterRecovery);
  if (afterRecovery.includes("/secure-access-portal")) {
    throw new Error("recovery code login should have succeeded");
  }
  // Verify it's marked used
  const used = await db.totpRecoveryCode.count({
    where: { user: { email: ADMIN_EMAIL }, usedAt: { not: null } },
  });
  console.log("[6] used recovery codes in DB:", used);
  if (used !== 1) throw new Error(`expected 1 used code, got ${used}`);
  await recoveryPage.close();
  await recoveryCtx.close();

  // ── 5. Login WITHOUT 2FA fails ───────────────────────────────────
  const noCtx = await browser.createBrowserContext();
  const noPage = await noCtx.newPage();
  await noPage.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  const afterNothing = await login(noPage);
  console.log("[7] login without 2FA landed on:", afterNothing);
  if (!afterNothing.includes("/secure-access-portal")) {
    throw new Error("login without 2FA should have been rejected");
  }
  await noPage.close();
  await noCtx.close();

  // ── 6. Disable 2FA ───────────────────────────────────────────────
  await loginPage.goto("http://localhost:3100/profile", { waitUntil: "networkidle0" });
  // First button is "Wyłącz 2FA" (confirm toggle); after clicking it
  // a password field + token field appear along with a SECOND "Wyłącz
  // 2FA" button that actually submits. Separate both steps.
  await loginPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim() === "Wyłącz 2FA",
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await loginPage.waitForSelector('input[autocomplete="current-password"]', { timeout: 3000 });
  // Use page.type so the React state updates via real keydown/input events.
  const pwSelector = 'input[autocomplete="current-password"]';
  await loginPage.click(pwSelector);
  await loginPage.type(pwSelector, ADMIN_PW, { delay: 10 });
  const disableToken = currentTotp(secret);
  // TOTP input in disable panel is the only remaining input[inputmode=numeric]
  const totpSelector = 'input[inputmode="numeric"]';
  await loginPage.click(totpSelector);
  await loginPage.type(totpSelector, disableToken, { delay: 10 });
  await loginPage.evaluate(() => {
    // Click the second "Wyłącz 2FA" — the confirm button inside the form.
    const btns = Array.from(document.querySelectorAll("button"))
      .filter((b) => b.textContent?.trim() === "Wyłącz 2FA");
    (btns[btns.length - 1] as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1800));
  const finalState = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { totpEnabledAt: true, totpSecret: true },
  });
  console.log("[8] after disable — enabledAt:", finalState?.totpEnabledAt, "secret:", finalState?.totpSecret);
  if (finalState?.totpEnabledAt !== null || finalState?.totpSecret !== null) {
    throw new Error("disable didn't clear 2FA state");
  }

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F8c 2FA TOTP 8/8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
