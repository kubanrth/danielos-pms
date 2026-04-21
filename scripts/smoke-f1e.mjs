// F1e: verify sidebar renders across routes + collapse + workspace switch.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({
    path: path.join(OUT_DIR, `f1e-${tag}-${label}.png`),
    fullPage: true,
  });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', "admin@danielos.local");
await page.type('input[name="password"]', "danielos-demo-2026");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('button[type="submit"]'),
]);
console.log("[1] logged in →", page.url());
await shot(page, "1-grid-with-sidebar");

// Verify sidebar is rendered
const sidebarCount = await page.$$eval("aside", (els) => els.length);
console.log("[2] <aside> count:", sidebarCount);
if (sidebarCount !== 1) throw new Error("Expected exactly 1 sidebar");

// Navigate into Demo Workspace from sidebar
await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll("aside a")).find((x) =>
    x.textContent?.includes("Demo Workspace"),
  );
  a?.click();
});
await page.waitForNavigation({ waitUntil: "networkidle0" });
console.log("[3] clicked Demo Workspace →", page.url());
await shot(page, "2-workspace-via-sidebar");

// Check active-state indicator
const active = await page.$eval('aside a[href^="/w/"]', (el) =>
  el.closest('[data-active="true"]')?.getAttribute("data-active"),
);
console.log("[4] active workspace marker:", active);

// Toggle collapse
await page.click('aside button[aria-label="Zwiń panel"]');
await new Promise((r) => setTimeout(r, 300));
const collapsedW = await page.$eval("aside", (el) => el.getBoundingClientRect().width);
console.log("[5] collapsed width:", collapsedW);
await shot(page, "3-workspace-collapsed");

if (collapsedW > 80) throw new Error("Expected collapsed width ≤ 80px, got " + collapsedW);

// Navigate to profile via sidebar — text is hidden when collapsed, click by href
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('aside a[href="/profile"]'),
]);
console.log("[6] profile →", page.url());
await shot(page, "4-profile-collapsed");

// Re-expand
await page.click('aside button[aria-label="Rozwiń panel"]');
await new Promise((r) => setTimeout(r, 300));
await shot(page, "5-profile-expanded");

await browser.close();
console.log("DONE — F1e smoke 6/6");
