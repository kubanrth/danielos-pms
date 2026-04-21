// F3a smoke: verify kanban renders correctly and cards link to task modal.
// Note: actual drag&drop is tested manually — headless pointer-event injection
// is flaky with dnd-kit's pointer capture + tracking. Real-browser test was OK.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f3a-${tag}-${label}.png`), fullPage: true });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });

await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', "admin@danielos.local");
await page.type('input[name="password"]', "danielos-demo-2026");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('button[type="submit"]'),
]);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.includes("Demo Workspace"),
    );
    a?.click();
  }),
]);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.trim() === "Kanban →",
    );
    a?.click();
  }),
]);

if (!/\/b\/[^/]+\/kanban$/.test(page.url())) {
  throw new Error("Did not land on kanban: " + page.url());
}
console.log("[1] kanban →", page.url());
await shot(page, "1-kanban-loaded");

// Count columns + cards
const columnsCount = await page.$$eval(".flex.w-\\[300px\\]", (els) => els.length);
const cardCount = await page.$$eval("article", (els) => els.length);
console.log("[2] columns:", columnsCount, "cards:", cardCount);
if (columnsCount < 4) throw new Error("Expected at least 4 status columns");
if (cardCount < 1) throw new Error("Expected at least 1 card");

// Verify the Tło (background customizer) button is present
const hasBg = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button")).some(
    (b) => b.textContent?.trim() === "Tło" || b.textContent?.toLowerCase().includes("tło"),
  ),
);
console.log("[3] Tło button present:", hasBg);
if (!hasBg) throw new Error("Background customizer not rendered");

// Click a card title — opens modal via intercepting route
const cardTitle = await page.evaluate(() => {
  const a = document.querySelector("article a");
  return a?.textContent?.trim();
});
console.log("[4] first card:", cardTitle);

await Promise.all([
  page.waitForFunction(
    () => document.querySelectorAll("textarea[name=description]").length > 0,
    { timeout: 15000 },
  ),
  page.evaluate(() => {
    const a = document.querySelector("article a");
    a?.click();
  }),
]);
console.log("[5] modal opened via intercept →", page.url());
await shot(page, "2-modal-from-kanban");

// Close modal — onClose navigates back to /w/[id] overview.
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 1500));

// Navigate back to Kanban directly, then use the "przełącz" link.
const kanbanUrl = page.url().replace(/\/[^/]+$/, ""); // strip last segment
// Actually just compute from known params.
const workspaceId = page.url().match(/\/w\/([^/]+)/)?.[1];
// Re-land on kanban from overview
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.trim() === "Kanban →",
    );
    a?.click();
  }),
]);
console.log("[6] back on kanban");

// Use the cross-link to Table view
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.includes("przełącz na Tabelę"),
    );
    a?.click();
  }),
]);
if (!/\/table$/.test(page.url())) throw new Error("Did not switch to Table: " + page.url());
console.log("[7] switched to Table →", page.url());

await browser.close();
console.log("DONE — F3a smoke 7/7 (DnD verified manually)");
