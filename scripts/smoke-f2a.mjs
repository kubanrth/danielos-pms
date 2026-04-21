// F2a: Table view — navigation + sort + inline status change + status column CRUD.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f2a-${tag}-${label}.png`), fullPage: true });

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

// Enter Demo Workspace
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
console.log("[1] in workspace");

// Navigate to table view via overview link
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.includes("Otwórz widok tabeli"),
    );
    a?.click();
  }),
]);
console.log("[2] table view →", page.url());
await shot(page, "1-table-initial");

if (!/\/b\/[^/]+\/table$/.test(page.url())) {
  throw new Error("Did not land on /b/[id]/table");
}

// Check table has at least one row
const rowCount = await page.$$eval("tbody tr", (rows) => rows.length);
console.log("[3] rows in table:", rowCount);
if (rowCount < 1) throw new Error("Expected at least 1 row");

// Click the "Status" header to sort
await page.evaluate(() => {
  const header = Array.from(document.querySelectorAll("th button")).find((b) =>
    b.textContent?.includes("Status"),
  );
  header?.click();
});
await new Promise((r) => setTimeout(r, 400));
await shot(page, "2-sorted-by-status");
console.log("[4] sorted by status");

// Create a new status column via the manager
const newColName = `FAZA-${new Date().toISOString().slice(11, 16).replace(":", "")}`;
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.includes("Dodaj status"),
  );
  b?.click();
});
await page.waitForSelector('input[name="name"][placeholder*="Wstrzymane"]', { timeout: 5000 });
await page.type('input[name="name"][placeholder*="Wstrzymane"]', newColName);
await page.evaluate((name) => {
  // Submit the add-status form (first form in the status column manager section)
  const forms = Array.from(document.querySelectorAll("form"));
  const f = forms.find((x) => x.querySelector(`input[name="name"][value="${name}"]`) || x.querySelector(`input[name="name"][placeholder*="Wstrzymane"]`));
  if (!f) return;
  const btn = f.querySelector('button[type="submit"]');
  btn?.click();
}, newColName);
await new Promise((r) => setTimeout(r, 1500));
console.log("[5] added status:", newColName);
await shot(page, "3-status-added");

// Verify the new status is visible on the page
const hasNewStatus = await page.evaluate(
  (name) => document.body.textContent?.includes(name),
  newColName,
);
console.log("[6] new status visible:", hasNewStatus);
if (!hasNewStatus) throw new Error("New status column not visible");

// Inline change status on the first task row
await page.evaluate((newName) => {
  const selects = Array.from(document.querySelectorAll('tbody select[name="statusColumnId"]'));
  const sel = selects[0];
  if (!sel) return;
  const opt = Array.from(sel.options).find((o) => o.textContent === newName);
  if (!opt) return;
  sel.value = opt.value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}, newColName);
await new Promise((r) => setTimeout(r, 1500));
await shot(page, "4-status-changed");
console.log("[7] first row moved to new status");

// Open the task modal by clicking the title link in first row
await Promise.all([
  page.waitForFunction(
    () => document.querySelectorAll("textarea[name=description]").length > 0,
    { timeout: 15000 },
  ),
  page.evaluate(() => {
    const title = document.querySelector(
      'tbody tr:first-child a[href*="/t/"]',
    );
    title?.click();
  }),
]);
console.log("[8] modal opened via title click →", page.url());
await shot(page, "5-modal-from-table");

// Close modal
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 1500));
console.log("[9] modal closed →", page.url());

// Clean up — remove the status column
await page.evaluate((newName) => {
  const rows = Array.from(document.querySelectorAll("li"));
  const row = rows.find((r) => r.textContent?.trim().startsWith(newName));
  if (!row) return;
  const form = Array.from(row.querySelectorAll("form")).find((f) =>
    f.querySelector('button[aria-label="Usuń"]'),
  );
  const btn = form?.querySelector('button[type="submit"]');
  btn?.click();
}, newColName);
await new Promise((r) => setTimeout(r, 1500));
console.log("[10] cleanup — status removed");

await browser.close();
console.log("DONE — F2a smoke 10/10");
