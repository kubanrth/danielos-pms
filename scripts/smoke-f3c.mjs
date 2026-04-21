// F3c smoke: /my-tasks renders assigned tasks for the logged-in user.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f3c-${tag}-${label}.png`), fullPage: true });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

// Login as member (they're assigned to seed task)
await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', "member@danielos.local");
await page.type('input[name="password"]', "danielos-demo-2026");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('button[type="submit"]'),
]);
console.log("[1] logged in as member");

// Navigate via sidebar
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('aside a[href="/my-tasks"]'),
]);
console.log("[2] my-tasks →", page.url());
await shot(page, "1-my-tasks");

// Verify at least the seed task appears ("Zaprojektować logo DANIELOS" — member is assignee)
const hasSeedTask = await page.evaluate(() =>
  document.body.textContent?.includes("Zaprojektować logo DANIELOS"),
);
console.log("[3] seed task visible:", hasSeedTask);
if (!hasSeedTask) throw new Error("Seed task not visible in my-tasks");

// Click a task — should open modal via intercept on the workspace layout
// Actually /my-tasks is OUTSIDE /w/[id] layout, so intercept won't fire.
// Clicking navigates to the full /w/[id]/t/[id] page.
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.includes("Zaprojektować logo"),
    );
    a?.click();
  }),
]);
console.log("[4] task detail →", page.url());
if (!/\/t\/[^/]+/.test(page.url())) throw new Error("Did not land on task page");
await shot(page, "2-task-detail");

await browser.close();
console.log("DONE — F3c smoke 4/4");
