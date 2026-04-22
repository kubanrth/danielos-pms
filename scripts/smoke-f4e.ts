// F4e: Activity log on task detail.
// - Baseline: capture audit entry count.
// - Admin updates title via the main task form (fires task.updated audit).
// - Admin posts a @mention comment (fires comment.created + mention).
// - Reload → Historia aktywności shows both new entries with Polish summaries.
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
    p.screenshot({ path: path.join(OUT_DIR, `f4e-${tag}-${label}.png`), fullPage: true });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  // Find seed task id (first task in demo workspace)
  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  if (!demo) throw new Error("demo workspace missing");
  const seedTask = await db.task.findFirst({
    where: { workspaceId: demo.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!seedTask) throw new Error("seed task missing");

  const baselineAudits = await db.auditLog.count({
    where: { workspaceId: demo.id, objectType: "Task", objectId: seedTask.id },
  });
  console.log("[0] baseline audit count:", baselineAudits);

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
  await page.goto(`http://localhost:3100/w/${demo.id}/t/${seedTask.id}`, {
    waitUntil: "networkidle0",
  });
  console.log("[1] admin on task detail");

  // Mutation 1 — title tweak via the task form (fires task.updated)
  await page.evaluate((origTitle: string) => {
    const input = document.querySelector<HTMLInputElement>('input[name="title"]');
    if (!input) throw new Error("title input missing");
    input.value = origTitle; // no-op but triggers update
  }, seedTask.title + " ");
  // Actually click Zapisz — the server action fires regardless of diff
  await page.evaluate(() => {
    const form = Array.from(document.querySelectorAll("form")).find((f) =>
      f.querySelector('input[name="title"]'),
    );
    form?.requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 1200));
  console.log("[2] admin saved task form");

  // Mutation 2 — post a comment mentioning Anna (fires comment.created)
  await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("form"));
    const newForm = forms.find((f) =>
      Array.from(f.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Dodaj komentarz"),
      ),
    );
    (newForm?.querySelector(".tiptap-content") as HTMLElement | null)?.focus();
  });
  await page.keyboard.down("Meta");
  await page.keyboard.press("a");
  await page.keyboard.up("Meta");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(`F4e activity ${tag} `, { delay: 10 });
  await page.keyboard.type("@Anna", { delay: 40 });
  await page.waitForSelector(".mention-popover", { timeout: 3000 });
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Dodaj komentarz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  console.log("[3] admin posted mention comment");

  await page.reload({ waitUntil: "networkidle0" });
  await shot(page, "1-after-mutations");

  const afterAudits = await db.auditLog.count({
    where: { workspaceId: demo.id, objectType: "Task", objectId: seedTask.id },
  });
  console.log("[4] audit count after:", afterAudits, "(delta", afterAudits - baselineAudits + ")");
  if (afterAudits - baselineAudits < 2) {
    throw new Error(`expected ≥2 new audit entries, got ${afterAudits - baselineAudits}`);
  }

  // UI assertions — the Historia aktywności section exists and shows the
  // latest actions translated into Polish.
  const uiState = await page.evaluate(() => ({
    hasHeader: document.body.textContent?.includes("Historia aktywności"),
    hasUpdatedSummary: document.body.textContent?.includes("zaktualizował(a) zadanie"),
    hasCommentSummary: document.body.textContent?.includes("komentarz"),
    rows: document.querySelectorAll("ol > li").length,
  }));
  console.log("[5] activity UI:", uiState);
  if (!uiState.hasHeader) throw new Error("Historia aktywności header missing");
  if (!uiState.hasUpdatedSummary) throw new Error("task update summary missing");
  if (!uiState.hasCommentSummary) throw new Error("comment summary missing");
  if (uiState.rows < 2) throw new Error(`expected ≥2 rows, got ${uiState.rows}`);

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F4e activity log 5/5");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
