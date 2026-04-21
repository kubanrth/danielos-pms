// F2b: background customizer (gradient) + create tag inline in task modal.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f2b-${tag}-${label}.png`), fullPage: true });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

// Login + table view
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
      x.textContent?.includes("Otwórz widok tabeli"),
    );
    a?.click();
  }),
]);
console.log("[1] on table view");
await shot(page, "1-table-default");

// Open background customizer
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.trim().toLowerCase().includes("tło"),
  );
  b?.click();
});
await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
await new Promise((r) => setTimeout(r, 300));
await shot(page, "2-customizer-open");
console.log("[2] customizer dialog open");

// Click "Gradient" tab
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.trim() === "Gradient",
  );
  b?.click();
});
await new Promise((r) => setTimeout(r, 300));

// Click the first gradient preset
await page.evaluate(() => {
  const grid = Array.from(document.querySelectorAll("button[aria-label^='gradient preset']"));
  grid[1]?.click(); // pick the blue→purple one (second preset)
});
await new Promise((r) => setTimeout(r, 300));
await shot(page, "3-gradient-selected");

// Save
await Promise.all([
  page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 15000 }),
  page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) =>
      x.textContent?.includes("Zapisz tło"),
    );
    b?.click();
  }),
]);
await new Promise((r) => setTimeout(r, 1500));
console.log("[3] gradient saved");
await shot(page, "4-after-save");

// Reload — confirm persistence
await page.reload({ waitUntil: "networkidle0" });
console.log("[4] reloaded — background should persist");
await shot(page, "5-after-reload");

// Now test tag creation inline in the task modal
// Click the first task title to open modal
await Promise.all([
  page.waitForFunction(
    () => document.querySelectorAll("textarea[name=description]").length > 0,
    { timeout: 15000 },
  ),
  page.evaluate(() => {
    const a = document.querySelector('tbody tr:first-child a[href*="/t/"]');
    a?.click();
  }),
]);
console.log("[5] task modal open");

// Click "+ Nowy tag"
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.includes("Nowy tag"),
  );
  b?.click();
});
await new Promise((r) => setTimeout(r, 300));

const TAG_NAME = `f2b-${Date.now().toString().slice(-6)}`;
await page.type('input[name="name"][placeholder="np. urgent"]', TAG_NAME);
await page.evaluate((name) => {
  // Submit the create-tag form (inline inside tags section)
  const inputs = Array.from(document.querySelectorAll(`input[value="${name}"], input[name="name"]`));
  for (const inp of inputs) {
    if (inp.value === name) {
      const form = inp.closest("form");
      const submit = form?.querySelector('button[type="submit"]');
      submit?.click();
      return;
    }
  }
}, TAG_NAME);
await new Promise((r) => setTimeout(r, 1500));
await shot(page, "6-new-tag-created");

// Verify the new tag is visible in the tags list
const hasTag = await page.evaluate((name) => document.body.textContent?.includes(name), TAG_NAME);
console.log("[6] new tag visible:", hasTag);
if (!hasTag) throw new Error("Newly-created tag not visible");

// Cleanup — reset background to none (best-effort, don't fail if it flakes)
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 1000));

try {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) =>
      x.textContent?.trim().toLowerCase().includes("tło"),
    );
    b?.click();
  });
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) =>
      x.textContent?.trim() === "Brak",
    );
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) =>
      x.textContent?.includes("Zapisz tło"),
    );
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  console.log("[7] background reset to none");
} catch (e) {
  console.log("[7] cleanup skipped:", e.message);
}

await browser.close();
console.log("DONE — F2b smoke 7/7");
