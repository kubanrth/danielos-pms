// F1f: task modal + CRUD.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f1f-${tag}-${label}.png`), fullPage: true });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

// Login
await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', "admin@danielos.local");
await page.type('input[name="password"]', "danielos-demo-2026");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('button[type="submit"]'),
]);

// Navigate into Demo Workspace
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.includes("Demo Workspace"),
    );
    a?.click();
  }),
]);
const workspaceId = page.url().match(/\/w\/([^/]+)/)?.[1];
console.log("[1] in workspace:", workspaceId);
await shot(page, "1-overview-before");

// Create task — open dialog
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.includes("Nowe zadanie"),
  );
  b?.click();
});
await page.waitForSelector('input[name="title"]', { timeout: 5000 });

const TITLE = `Smoke F1f ${new Date().toISOString().slice(11, 19)}`;
await page.type('input[name="title"]', TITLE);
await page.evaluate(() => {
  const s = Array.from(document.querySelectorAll("button[type=submit]")).find((b) =>
    b.textContent?.includes("Utwórz zadanie"),
  );
  s?.click();
});

// Wait for the task detail UI to appear (modal intercepts via client navigation).
await page.waitForFunction(() => {
  return Array.from(document.querySelectorAll("textarea[name=description]")).length > 0;
}, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));
console.log("[2] task created, modal opened at", page.url());
await shot(page, "2-modal-opened");

// Capture task id
const taskId = page.url().match(/\/t\/([^/?#]+)/)?.[1];
if (!taskId) throw new Error("Task id not in URL");

// Edit — new title + description + set date
await page.click('input[name="title"]', { clickCount: 3 });
await page.type('input[name="title"]', `${TITLE} (edited)`);
await page.type('textarea[name="description"]', "Opis z automatu smoke F1f.");

// Change status to W trakcie
const columnOpts = await page.$$eval('select[name="statusColumnId"] option', (opts) =>
  opts.map((o) => ({ v: o.value, t: o.textContent?.trim() })),
);
const inProgress = columnOpts.find((o) => o.t?.includes("W trakcie"));
if (inProgress) await page.select('select[name="statusColumnId"]', inProgress.v);

await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button[type=submit]")).find((b) =>
    b.textContent?.trim() === "Zapisz",
  );
  btn?.click();
});
await new Promise((r) => setTimeout(r, 1500));
await shot(page, "3-after-save");
console.log("[3] edited + saved");

// Toggle self-assignee
await page.evaluate(() => {
  // Find a person-chip button whose text contains "Daniel"
  const btn = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.includes("Daniel") && b.type === "submit",
  );
  btn?.click();
});
await new Promise((r) => setTimeout(r, 1500));
await shot(page, "4-assignee-toggled");
console.log("[4] assignee toggled");

// Close modal via Esc → router.back should put us on overview
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 1500));
console.log("[5] after close, url:", page.url());
await shot(page, "5-overview-with-task");

// Verify task appears in the list
const hasTaskInList = await page.evaluate((title) => document.body.textContent?.includes(title), `${TITLE} (edited)`);
console.log("[6] new task visible in overview:", hasTaskInList);
if (!hasTaskInList) throw new Error("Task not visible after close");

// Re-open via the intercepted link
await Promise.all([
  page.waitForFunction(() => document.querySelectorAll("textarea[name=description]").length > 0, { timeout: 15000 }),
  page.evaluate((tid) => {
    const a = Array.from(document.querySelectorAll("a[href]")).find((x) =>
      (x.getAttribute("href") ?? "").endsWith(`/t/${tid}`),
    );
    a?.click();
  }, taskId),
]);
await new Promise((r) => setTimeout(r, 500));
console.log("[7] re-opened via list link");
await shot(page, "6-reopened-modal");

// Delete the task
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }),
  page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button[type=submit]")).find((x) =>
      x.textContent?.includes("usuń zadanie"),
    );
    b?.click();
  }),
]);
console.log("[8] deleted → ", page.url());

const stillVisible = await page.evaluate(
  (t) => document.body.textContent?.includes(t),
  `${TITLE} (edited)`,
);
if (stillVisible) throw new Error("Task still visible after delete");

await browser.close();
console.log("DONE — F1f smoke 8/8");
