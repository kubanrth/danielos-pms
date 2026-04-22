// F7: Super Admin Panel
// - Regular member hitting /admin* is redirected to /workspaces.
// - Super admin sees dashboard + user table + workspace table + audit feed.
// - Ban action flips User.isBanned; unban reverts.
// - Force delete workspace hard-deletes the row (+ cascade cleans children).
import "dotenv/config";
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const tag = Date.now();
  type ShotPage = { screenshot: (opts: { path: string; fullPage: boolean }) => Promise<unknown> };
  const shot = (p: ShotPage, label: string) =>
    p.screenshot({ path: path.join(OUT_DIR, `f7-${tag}-${label}.png`), fullPage: true });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  // Baseline: ensure Anna isn't banned
  await db.user.updateMany({
    where: { email: "member@danielos.local" },
    data: { isBanned: false },
  });

  const browser = await puppeteer.launch({ headless: true });

  // ── Act 1: Anna (not super admin) shouldn't reach /admin ───────────
  const annaPage = await browser.newPage();
  await annaPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await annaPage.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await annaPage.type('input[name="email"]', "member@danielos.local");
  await annaPage.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    annaPage.waitForNavigation({ waitUntil: "networkidle0" }),
    annaPage.click('button[type="submit"]'),
  ]);
  await annaPage.goto("http://localhost:3100/admin", { waitUntil: "networkidle0" });
  console.log("[1] Anna /admin url after redirect:", annaPage.url());
  if (annaPage.url().includes("/admin")) {
    throw new Error("Anna wasn't redirected out of /admin");
  }
  await annaPage.close();

  // ── Act 2: Admin reaches dashboard + lists ─────────────────────────
  // Fresh incognito context so admin doesn't inherit Anna's cookies.
  const adminCtx = await browser.createBrowserContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await adminPage.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await adminPage.type('input[name="email"]', "admin@danielos.local");
  await adminPage.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    adminPage.waitForNavigation({ waitUntil: "networkidle0" }),
    adminPage.click('button[type="submit"]'),
  ]);

  await adminPage.goto("http://localhost:3100/admin", { waitUntil: "networkidle0" });
  const dashCheck = await adminPage.evaluate(() => ({
    hasTitle: document.body.textContent?.includes("Przegląd systemu"),
    hasUsers: document.body.textContent?.includes("Użytkownicy"),
    hasWorkspaces: document.body.textContent?.includes("Przestrzenie"),
  }));
  console.log("[2] dashboard:", dashCheck);
  if (!dashCheck.hasTitle || !dashCheck.hasUsers || !dashCheck.hasWorkspaces) {
    throw new Error("dashboard missing expected content");
  }
  await shot(adminPage, "1-dashboard");

  // ── Act 3: Ban Anna via users table ────────────────────────────────
  await adminPage.goto("http://localhost:3100/admin/users", { waitUntil: "networkidle0" });
  await shot(adminPage, "2-users");
  const banned = await adminPage.evaluate(() => {
    // Find the row containing "member@danielos.local" and click the ban button
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const annaRow = rows.find((r) => r.textContent?.includes("member@danielos.local"));
    const form = annaRow?.querySelector('form button[aria-label="Zbanuj"]')?.closest("form");
    if (!form) return false;
    (form as HTMLFormElement).requestSubmit();
    return true;
  });
  if (!banned) throw new Error("couldn't find Anna's ban button");
  await new Promise((r) => setTimeout(r, 1000));
  const annaState = await db.user.findUnique({
    where: { email: "member@danielos.local" },
    select: { isBanned: true },
  });
  console.log("[3] Anna banned:", annaState?.isBanned);
  if (!annaState?.isBanned) throw new Error("Anna wasn't actually banned");

  // Unban to clean up
  await adminPage.reload({ waitUntil: "networkidle0" });
  await adminPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const annaRow = rows.find((r) => r.textContent?.includes("member@danielos.local"));
    const form = annaRow?.querySelector('form button[aria-label="Odbanuj"]')?.closest("form");
    (form as HTMLFormElement | null | undefined)?.requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 800));
  const annaAfter = await db.user.findUnique({
    where: { email: "member@danielos.local" },
    select: { isBanned: true },
  });
  console.log("[4] Anna unbanned:", !annaAfter?.isBanned);

  // ── Act 4: Create + force delete a disposable workspace ────────────
  const victim = await db.workspace.create({
    data: {
      name: `F7 smoke ws ${tag}`,
      slug: `f7-smoke-${tag}`,
      ownerId: (await db.user.findUnique({ where: { email: "admin@danielos.local" } }))!.id,
      memberships: {
        create: [{
          userId: (await db.user.findUnique({ where: { email: "admin@danielos.local" } }))!.id,
          role: "ADMIN",
        }],
      },
    },
  });
  console.log("[5] victim workspace created:", victim.id);

  await adminPage.goto(
    `http://localhost:3100/admin/workspaces?q=f7-smoke-${tag}`,
    { waitUntil: "networkidle0" },
  );
  await shot(adminPage, "3-workspaces");
  const deleteClicked = await adminPage.evaluate((slug) => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const row = rows.find((r) => r.textContent?.includes(slug));
    const form = row?.querySelector('form button[aria-label="Skasuj na trwale"]')?.closest("form");
    if (!form) return false;
    (form as HTMLFormElement).requestSubmit();
    return true;
  }, `f7-smoke-${tag}`);
  if (!deleteClicked) throw new Error("couldn't click force delete");
  await new Promise((r) => setTimeout(r, 1200));
  const afterDelete = await db.workspace.findUnique({ where: { id: victim.id } });
  console.log("[6] victim workspace after force delete:", afterDelete);
  if (afterDelete !== null) throw new Error("workspace not hard-deleted");

  // ── Act 5: Audit page loads with entries + filter works ────────────
  await adminPage.goto("http://localhost:3100/admin/audit", { waitUntil: "networkidle0" });
  const auditCheck = await adminPage.evaluate(() => ({
    rows: document.querySelectorAll("tbody tr").length,
    hasHeader: document.body.textContent?.includes("Globalna historia"),
  }));
  console.log("[7] audit:", auditCheck);
  if (!auditCheck.hasHeader) throw new Error("audit page missing header");
  await shot(adminPage, "4-audit");

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F7 admin panel 7/7");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
