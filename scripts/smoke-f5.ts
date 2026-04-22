// F5: Roadmap + Milestones
// - Open /roadmap → "Nowy milestone" dialog.
// - Create a new milestone with a unique title.
// - Verify it renders as a bar on the timeline and a row in the list.
// - Open the seed task modal → change milestone dropdown to the new one.
// - Back on roadmap → the new milestone's task count went up by 1.
// - Delete the milestone → row disappears and task is detached (milestoneId null).
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
    p.screenshot({ path: path.join(OUT_DIR, `f5-${tag}-${label}.png`), fullPage: true });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  const board = await db.board.findFirst({ where: { workspaceId: demo!.id, deletedAt: null } });
  const seedTask = await db.task.findFirst({
    where: { boardId: board!.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!demo || !board || !seedTask) throw new Error("seed state missing");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', "admin@danielos.local");
  await page.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  const roadmapUrl = `http://localhost:3100/w/${demo.id}/b/${board.id}/roadmap`;
  await page.goto(roadmapUrl, { waitUntil: "networkidle0" });
  console.log("[1] roadmap url:", page.url());
  await shot(page, "1-roadmap-initial");

  // Open "Nowy milestone" dialog
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Nowy milestone"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await page.waitForSelector('input[name="title"]', { timeout: 3000 });
  const milestoneTitle = `F5 test ${tag}`;
  await page.type('input[name="title"]', milestoneTitle);
  // Keep default dates (today → +14d)

  // Submit dialog
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button[type='submit']")).find((b) =>
      b.textContent?.includes("Utwórz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.reload({ waitUntil: "networkidle0" });
  await shot(page, "2-after-create");

  const created = await db.milestone.findFirst({
    where: { boardId: board.id, title: milestoneTitle, deletedAt: null },
  });
  if (!created) throw new Error("milestone not created in DB");
  console.log("[2] milestone created:", created.id);

  // Check bar rendered with title + count = 0
  const barState = await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const bar = buttons.find((b) => b.textContent?.includes(t));
    if (!bar) return { hasBar: false, text: "" };
    return { hasBar: true, text: bar.textContent?.trim() };
  }, milestoneTitle);
  console.log("[3] timeline bar:", barState);
  if (!barState.hasBar) throw new Error("new milestone bar not rendered");

  // Open the seed task modal via soft-nav from the table
  await page.goto(`http://localhost:3100/w/${demo.id}/b/${board.id}/table`, {
    waitUntil: "networkidle0",
  });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("tbody tr a")).find((x) =>
        x.textContent?.includes("Zaprojektować logo"),
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  await page.waitForSelector('select[name="milestoneId"]', { timeout: 5000 });

  // Change milestone dropdown
  await page.evaluate((milestoneId) => {
    const select = document.querySelector<HTMLSelectElement>('select[name="milestoneId"]');
    if (!select) throw new Error("milestone select missing");
    select.value = milestoneId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, created.id);
  await new Promise((r) => setTimeout(r, 1200));
  console.log("[4] changed task milestone via modal");

  // Verify DB: task.milestoneId is set
  const refreshedTask = await db.task.findUnique({ where: { id: seedTask.id } });
  if (refreshedTask?.milestoneId !== created.id) {
    throw new Error(`expected task.milestoneId=${created.id}, got ${refreshedTask?.milestoneId}`);
  }

  // Back to roadmap: new milestone's count should be >= 1
  await page.goto(roadmapUrl, { waitUntil: "networkidle0" });
  const countAfter = await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const bar = buttons.find((b) => b.textContent?.includes(t));
    const pill = bar?.querySelector("span.rounded-full");
    return pill?.textContent?.trim();
  }, milestoneTitle);
  console.log("[5] task count pill on milestone bar:", countAfter);
  if (countAfter !== "1") throw new Error(`expected 1, got ${countAfter}`);

  await shot(page, "3-after-assign");

  // Delete the milestone via its card's trash button
  const deleted = await page.evaluate((t) => {
    const articles = Array.from(document.querySelectorAll("li"));
    const row = articles.find((li) => li.textContent?.includes(t));
    const form = row?.querySelector('form button[aria-label="Usuń"]')?.closest("form");
    if (!form) return false;
    (form as HTMLFormElement).requestSubmit();
    return true;
  }, milestoneTitle);
  if (!deleted) throw new Error("couldn't click delete on milestone card");
  await new Promise((r) => setTimeout(r, 1200));
  await page.reload({ waitUntil: "networkidle0" });

  const afterDelete = await db.milestone.findUnique({ where: { id: created.id } });
  console.log("[6] milestone deletedAt:", afterDelete?.deletedAt);
  if (!afterDelete?.deletedAt) throw new Error("milestone not soft-deleted");

  const taskAfter = await db.task.findUnique({ where: { id: seedTask.id } });
  if (taskAfter?.milestoneId !== null) {
    throw new Error("task not detached from deleted milestone");
  }

  await shot(page, "4-after-delete");
  await browser.close();
  await db.$disconnect();
  console.log("DONE — F5 roadmap 6/6");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
