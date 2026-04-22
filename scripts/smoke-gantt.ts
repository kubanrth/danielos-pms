// Gantt smoke — new view renders, bars appear for scheduled tasks,
// "bez dat" section lists unscheduled ones.
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

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  const board = await db.board.findFirst({
    where: { workspaceId: demo!.id, deletedAt: null },
  });
  if (!demo || !board) throw new Error("seed missing");

  // Give the seed task dates so Gantt has something to draw.
  const seedTask = await db.task.findFirst({
    where: { boardId: board.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!seedTask) throw new Error("no seed task");
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  await db.task.update({
    where: { id: seedTask.id },
    data: { startAt: new Date(now - 2 * day), stopAt: new Date(now + 5 * day) },
  });

  // Create a second unscheduled task so the "bez dat" section has content.
  const admin = await db.user.findUnique({ where: { email: "admin@danielos.local" } });
  const existingUnscheduled = await db.task.findFirst({
    where: {
      boardId: board.id,
      deletedAt: null,
      title: "Gantt smoke — bez dat",
    },
  });
  if (!existingUnscheduled && admin) {
    await db.task.create({
      data: {
        workspaceId: demo.id,
        boardId: board.id,
        creatorId: admin.id,
        title: "Gantt smoke — bez dat",
        rowOrder: 100,
      },
    });
  }

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

  await page.goto(
    `http://localhost:3100/w/${demo.id}/b/${board.id}/gantt`,
    { waitUntil: "networkidle0" },
  );
  console.log("[1] gantt url:", page.url());

  // ViewSwitcher active pill
  const activePill = await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (t) => t.getAttribute("data-active") === "true",
    );
    return tab?.textContent?.trim();
  });
  console.log("[2] active pill:", activePill);
  if (!activePill?.includes("Gantt")) throw new Error("Gantt pill not active");

  // Bar for the scheduled task
  const hasBar = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Zaprojektować logo"),
    ),
  );
  console.log("[3] scheduled bar rendered:", hasBar);
  if (!hasBar) throw new Error("scheduled task bar missing");

  // "Bez dat" footer with unscheduled task
  const footerHasUnscheduled = await page.evaluate(() =>
    !!document.body.textContent?.includes("Gantt smoke — bez dat"),
  );
  console.log("[4] unscheduled footer:", footerHasUnscheduled);
  if (!footerHasUnscheduled) throw new Error("unscheduled task not listed");

  // Clicking bar navigates to intercepted task modal
  await Promise.all([
    page.waitForFunction(
      () =>
        document.querySelectorAll(".tiptap-content").length > 0 ||
        !!Array.from(document.querySelectorAll("*")).find(
          (e) => e.textContent?.trim() === "Szczegóły zadania",
        ),
      { timeout: 10000 },
    ),
    page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((x) =>
        x.textContent?.includes("Zaprojektować logo"),
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  console.log("[5] modal opened from Gantt bar");

  await page.screenshot({
    path: path.join(OUT_DIR, `gantt-${Date.now()}-final.png`),
    fullPage: true,
  });

  await browser.close();
  await db.$disconnect();
  console.log("DONE — Gantt 5/5");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
