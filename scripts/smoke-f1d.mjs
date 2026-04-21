// F1d: end-to-end invitation flow — admin invites → new user accepts → joins workspace.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f1d-${tag}-${label}.png`), fullPage: true });

const INVITE_EMAIL = `smoke-invite-${tag}@danielos.local`;
const INVITE_PASSWORD = "invited-user-pass-2026";
const INVITE_NAME = "Smoke Invitee";

const browser = await puppeteer.launch({ headless: "new" });

// --- Admin context ---
const admin = await browser.newPage();
await admin.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

await admin.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await admin.type('input[name="email"]', "admin@danielos.local");
await admin.type('input[name="password"]', "danielos-demo-2026");
await Promise.all([
  admin.waitForNavigation({ waitUntil: "networkidle0" }),
  admin.click('button[type="submit"]'),
]);
console.log("[1] admin logged in →", admin.url());

// Navigate into Demo Workspace
await Promise.all([
  admin.waitForNavigation({ waitUntil: "networkidle0" }),
  admin.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.includes("Demo Workspace"),
    );
    a?.click();
  }),
]);
const workspaceUrl = admin.url();
const workspaceId = workspaceUrl.match(/\/w\/([^/]+)/)?.[1];
if (!workspaceId) throw new Error("No workspaceId found");
console.log("[2] in workspace:", workspaceId);

// Go to members
await admin.goto(`http://localhost:3100/w/${workspaceId}/members`, { waitUntil: "networkidle0" });
await shot(admin, "1-members-empty-pending");
console.log("[3] members page loaded");

// Fill invite form and submit
await admin.type('input[name="email"]', INVITE_EMAIL);
await admin.select('select[name="role"]', "MEMBER");
await Promise.all([
  admin.waitForResponse((r) => r.status() === 200 && r.url().includes("/members"), { timeout: 15000 }).catch(() => {}),
  admin.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button[type=submit]")).find((x) =>
      x.textContent?.includes("Wyślij zaproszenie"),
    );
    b?.click();
  }),
]);
await new Promise((r) => setTimeout(r, 1500));
await shot(admin, "2-after-invite");

// Extract invite URL from the success toast
const inviteUrl = await admin.$eval(
  'code',
  (el) => el.textContent?.trim() ?? "",
);
if (!inviteUrl || !inviteUrl.includes("/invites/")) throw new Error("No invite URL found in success state");
console.log("[4] invite URL →", inviteUrl);

// Verify pending invite row appears after revalidate
await admin.goto(`http://localhost:3100/w/${workspaceId}/members`, { waitUntil: "networkidle0" });
const hasPending = await admin.evaluate((email) => document.body.textContent?.includes(email), INVITE_EMAIL);
console.log("[5] pending invite visible:", hasPending);
if (!hasPending) throw new Error("Pending invite row not rendered after revalidate");
await shot(admin, "3-members-with-pending");

// --- Invitee context (fresh browser context = no cookies) ---
const inviteeCtx = await browser.createBrowserContext();
const invitee = await inviteeCtx.newPage();
await invitee.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

await invitee.goto(inviteUrl, { waitUntil: "networkidle0" });
await shot(invitee, "4-invite-landing");
console.log("[6] invitee landed on invite page");

await invitee.type('input[name="name"]', INVITE_NAME);
await invitee.type('input[name="password"]', INVITE_PASSWORD);

await Promise.all([
  invitee.waitForNavigation({ waitUntil: "networkidle0", timeout: 20000 }),
  invitee.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button[type=submit]")).find((x) =>
      x.textContent?.includes("Dołącz"),
    );
    b?.click();
  }),
]);
console.log("[7] invitee after submit →", invitee.url());
await shot(invitee, "5-invitee-after-accept");

if (!invitee.url().includes(`/w/${workspaceId}`)) {
  throw new Error(`Expected invitee to land at /w/${workspaceId}, got ${invitee.url()}`);
}

// Admin reloads members — invitee should now be in members list (not pending)
await admin.goto(`http://localhost:3100/w/${workspaceId}/members`, { waitUntil: "networkidle0" });
const hasMember = await admin.evaluate(
  (email) => document.body.textContent?.includes(email),
  INVITE_EMAIL,
);
console.log("[8] new member visible to admin:", hasMember);
if (!hasMember) throw new Error("Invitee not visible in admin member list");
await shot(admin, "6-members-after-accept");

// Cleanup — remove the smoke-test member
await admin.evaluate((email) => {
  const rows = Array.from(document.querySelectorAll("div")).filter((d) => {
    const t = d.textContent ?? "";
    return t.includes(email);
  });
  // Find the member row with "usuń" button visible
  for (const row of rows) {
    const usun = Array.from(row.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "usuń",
    );
    if (usun) {
      usun.click();
      return;
    }
  }
}, INVITE_EMAIL);
await new Promise((r) => setTimeout(r, 300));
// Confirm
await admin.evaluate(() => {
  const confirmBtn = Array.from(document.querySelectorAll("button[type=submit]")).find((b) =>
    b.textContent?.includes("potwierdź"),
  );
  confirmBtn?.click();
});
await new Promise((r) => setTimeout(r, 1500));
console.log("[9] smoke-test member removed (cleanup)");

await browser.close();
console.log("DONE — F1d smoke 9/9");
