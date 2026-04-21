// F1b: profile edit + avatar upload via UI.
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
    path: path.join(OUT_DIR, `f1b-${tag}-${label}.png`),
    fullPage: true,
  });

// Generate a tiny 64x64 PNG (solid terracotta) on the fly, using zlib for the IDAT.
// Simple 2x2 PNG via base64 instead — keeps test self-contained.
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAHElEQVQI12P4z8DwHwAFAAH/rZpD1QAAAABJRU5ErkJggg==",
  "base64",
);
const fixturePath = path.join(OUT_DIR, `f1b-${tag}-avatar-fixture.png`);
fs.writeFileSync(fixturePath, tinyPng);

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

await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('aside a[href="/profile"]'),
]);
console.log("[1] profile page loaded:", page.url());
await shot(page, "1-profile-initial");

// Change name
await page.click('input[name="name"]', { clickCount: 3 });
await page.type('input[name="name"]', "Daniel Admin (Updated)");

// Select a different timezone
await page.select('select[name="timezone"]', "Europe/Berlin");

// Attach avatar
const fileInput = await page.$('input[name="avatar"]');
await fileInput.uploadFile(fixturePath);
await new Promise((r) => setTimeout(r, 300));
console.log("[2] form filled + avatar attached");
await shot(page, "2-form-before-submit");

// Submit
await Promise.all([
  page.waitForResponse((res) => res.url().includes("/profile") && res.status() === 200, { timeout: 15000 }),
  page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll("button[type=submit]")).find((b) =>
      b.textContent?.includes("Zapisz"),
    );
    submit?.click();
  }),
]);
// Wait a tick for server action + revalidatePath to settle
await new Promise((r) => setTimeout(r, 1500));
console.log("[3] submitted");
await shot(page, "3-after-submit");

// Reload and verify persistence
await page.goto("http://localhost:3100/profile", { waitUntil: "networkidle0" });
const persistedName = await page.$eval('input[name="name"]', (el) => el.value);
const persistedTz = await page.$eval('select[name="timezone"]', (el) => el.value);
const avatarImg = await page.$('button[aria-label="Zmień awatar"] img');
console.log("[4] after reload — name:", persistedName, "· tz:", persistedTz, "· avatar present:", !!avatarImg);

if (persistedName !== "Daniel Admin (Updated)") throw new Error("Name did not persist");
if (persistedTz !== "Europe/Berlin") throw new Error("Timezone did not persist");
if (!avatarImg) throw new Error("Avatar image did not render after upload");

await shot(page, "4-reload-verify");

// Restore original name so future tests aren't confused
await page.click('input[name="name"]', { clickCount: 3 });
await page.type('input[name="name"]', "Daniel Admin");
await page.select('select[name="timezone"]', "Europe/Warsaw");
await page.evaluate(() => {
  const s = Array.from(document.querySelectorAll("button[type=submit]")).find((b) =>
    b.textContent?.includes("Zapisz"),
  );
  s?.click();
});
await new Promise((r) => setTimeout(r, 1500));
console.log("[5] restored original values");

await browser.close();
console.log("DONE — F1b smoke 5/5");
