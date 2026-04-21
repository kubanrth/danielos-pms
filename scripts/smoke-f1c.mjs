// F1c smoke: login → create workspace via dialog → verify /w/[id] + /settings render.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const EMAIL = "admin@danielos.local";
const PASSWORD = "danielos-demo-2026";
const WS_NAME = `Smoke F1c ${new Date().toISOString().slice(11, 19)}`;

const shot = (page, label) =>
  page.screenshot({
    path: path.join(OUT_DIR, `f1c-${tag}-${label}.png`),
    fullPage: true,
  });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

// Login
await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', EMAIL);
await page.type('input[name="password"]', PASSWORD);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('button[type="submit"]'),
]);
console.log("[1] logged in →", page.url());
await shot(page, "1-grid");

// Open create dialog
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.includes("+ Utwórz workspace"),
  );
  b?.click();
});
await page.waitForSelector('input[name="name"]', { timeout: 5000 });
console.log("[2] dialog open");
await shot(page, "2-dialog");

// Fill + submit (server redirect navigates us to /w/[id])
await page.type('input[name="name"]', WS_NAME);
await page.type('textarea[name="description"]', "Auto-created by smoke test.");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }),
  page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll("button[type=submit]")).find((b) =>
      b.textContent?.includes("Utwórz"),
    );
    submit?.click();
  }),
]);
const overviewUrl = page.url();
const matchedId = overviewUrl.match(/\/w\/([^/]+)/);
if (!matchedId) throw new Error("Did not land on /w/[id]. URL=" + overviewUrl);
const workspaceId = matchedId[1];
console.log("[3] created + navigated to", overviewUrl);
await shot(page, "3-overview");

// Go to settings via direct URL
await page.goto(`http://localhost:3100/w/${workspaceId}/settings`, { waitUntil: "networkidle0" });
console.log("[4] settings →", page.url());
await shot(page, "4-settings");

// Reveal delete form, confirm and submit
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.trim() === "Usuń przestrzeń",
  );
  b?.click();
});
await page.waitForSelector('input[name="confirmName"]', { timeout: 5000 });
await page.type('input[name="confirmName"]', WS_NAME);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }),
  page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button[type=submit]")).find((x) =>
      x.textContent?.includes("Tak, usuń"),
    );
    b?.click();
  }),
]);
console.log("[5] deleted → back at", page.url());
await shot(page, "5-after-delete");

await browser.close();
console.log("DONE — all 5 steps passed");
