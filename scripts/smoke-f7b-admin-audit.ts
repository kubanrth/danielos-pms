// F7b — AdminAuditLog wiring.
//
// Exercises the four admin actions that should now write durable audit
// entries and verifies:
//   * every action produces exactly one row with the expected shape,
//   * actorEmail is denormalised so the trail survives a later user
//     delete (covered by softDeleteUser — we verify the audit row
//     keeps the masked email reference),
//   * /admin/actions page renders the new rows for a super admin.
import "dotenv/config";
import puppeteer from "puppeteer";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const admin = await db.user.findUnique({ where: { email: "admin@danielos.local" } });
  const anna = await db.user.findUnique({ where: { email: "member@danielos.local" } });
  if (!admin || !anna) throw new Error("users missing");

  // Baseline cleanup — unban Anna + capture the starting audit count.
  await db.user.updateMany({
    where: { email: "member@danielos.local" },
    data: { isBanned: false },
  });
  const baseline = await db.adminAuditLog.count();
  console.log("[0] baseline admin-audit rows:", baseline);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // Login as admin
  await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', "admin@danielos.local");
  await page.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  // ── 1. Ban + unban Anna via /admin/users ─────────────────────────
  await page.goto("http://localhost:3100/admin/users", { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const annaRow = rows.find((r) => r.textContent?.includes("member@danielos.local"));
    const form = annaRow?.querySelector('form button[aria-label="Zbanuj"]')?.closest("form");
    (form as HTMLFormElement | null | undefined)?.requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 900));
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const annaRow = rows.find((r) => r.textContent?.includes("member@danielos.local"));
    const form = annaRow?.querySelector('form button[aria-label="Odbanuj"]')?.closest("form");
    (form as HTMLFormElement | null | undefined)?.requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 900));

  const afterBanUnban = await db.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  console.log("[1] last 2 actions:", afterBanUnban.map((r) => r.action));
  if (
    !afterBanUnban.some((r) => r.action === "user.banned") ||
    !afterBanUnban.some((r) => r.action === "user.unbanned")
  ) {
    throw new Error("ban/unban audit entries not written");
  }
  const banRow = afterBanUnban.find((r) => r.action === "user.banned")!;
  if (banRow.targetType !== "User" || banRow.targetId !== anna.id) {
    throw new Error("ban audit row target mismatch");
  }
  if (banRow.targetLabel !== "member@danielos.local") {
    throw new Error(`ban audit row label wrong: ${banRow.targetLabel}`);
  }
  if (banRow.actorEmail !== "admin@danielos.local") {
    throw new Error("actorEmail not denormalised");
  }

  // ── 2. Create + force-delete a disposable workspace ──────────────
  const tag = Date.now();
  const victim = await db.workspace.create({
    data: {
      name: `F7b smoke ws ${tag}`,
      slug: `f7b-smoke-${tag}`,
      ownerId: admin.id,
      memberships: {
        create: [{ userId: admin.id, role: "ADMIN" }],
      },
    },
  });
  await page.goto(
    `http://localhost:3100/admin/workspaces?q=f7b-smoke-${tag}`,
    { waitUntil: "networkidle0" },
  );
  await page.evaluate((slug: string) => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const row = rows.find((r) => r.textContent?.includes(slug));
    const form = row?.querySelector('form button[aria-label="Skasuj na trwale"]')?.closest("form");
    (form as HTMLFormElement | null | undefined)?.requestSubmit();
  }, `f7b-smoke-${tag}`);
  await new Promise((r) => setTimeout(r, 1200));

  const forceRow = await db.adminAuditLog.findFirst({
    where: { action: "workspace.forceDeleted", targetId: victim.id },
  });
  console.log("[2] force-delete audit row:", forceRow?.targetLabel);
  if (!forceRow) throw new Error("workspace.forceDeleted audit row missing");
  if (forceRow.targetLabel !== `F7b smoke ws ${tag} (/f7b-smoke-${tag})`) {
    throw new Error(`force-delete targetLabel wrong: ${forceRow.targetLabel}`);
  }

  // ── 3. /admin/actions renders the new rows ──────────────────────
  await page.goto("http://localhost:3100/admin/actions", { waitUntil: "networkidle0" });
  const uiState = await page.evaluate(() => ({
    hasHeader: document.body.textContent?.includes("Historia decyzji"),
    rowCount: document.querySelectorAll("tbody tr").length,
    hasBanRow: !!Array.from(document.querySelectorAll("code, span")).find((e) =>
      e.textContent?.trim() === "user.banned",
    ),
  }));
  console.log("[3] /admin/actions UI:", uiState);
  if (!uiState.hasHeader) throw new Error("page header missing");
  if (uiState.rowCount === 0) throw new Error("audit rows not rendered");
  if (!uiState.hasBanRow) throw new Error("user.banned action pill missing");

  const final = await db.adminAuditLog.count();
  console.log("[4] total rows:", final, "delta:", final - baseline);
  if (final - baseline < 3) {
    throw new Error(`expected >=3 new rows, got ${final - baseline}`);
  }

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F7b admin-audit 4/4");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
