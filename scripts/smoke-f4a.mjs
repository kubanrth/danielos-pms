// F4a: Tiptap rich text editor on task description.
// - Toolbar renders (bold, italic, list, link).
// - Typing with Bold active produces a <strong> node.
// - After Save + reload, the formatted content persists.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f4a-${tag}-${label}.png`), fullPage: true });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

// Login as admin (can edit)
await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', "admin@danielos.local");
await page.type('input[name="password"]', "danielos-demo-2026");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('button[type="submit"]'),
]);
console.log("[1] logged in as admin");

// Navigate to the seed task through the workspace
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
      x.textContent?.trim() === "Tabela →",
    );
    a?.click();
  }),
]);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("tbody tr a")).find((x) =>
      x.textContent?.includes("Zaprojektować logo"),
    );
    a?.click();
  }),
]);
console.log("[2] on task detail:", page.url());

// Verify Tiptap mounted + toolbar renders
await page.waitForSelector(".tiptap-content", { timeout: 5000 });
const toolbarButtons = await page.$$eval(
  'button[aria-label]',
  (btns) => btns.filter((b) => ["Pogrubienie", "Kursywa", "Lista punktowa", "Link"].includes(b.getAttribute("aria-label"))).length,
);
console.log("[3] toolbar buttons found:", toolbarButtons, "(expected >= 4)");
if (toolbarButtons < 4) throw new Error("toolbar missing expected buttons");
await shot(page, "1-editor-mounted");

// Clear any placeholder, activate Bold, type content, Enter, type plain
const editorBox = await page.$(".tiptap-content");
await editorBox.click();
// Select-all + delete to be safe (legacy data may exist)
await page.keyboard.down("Meta");
await page.keyboard.press("a");
await page.keyboard.up("Meta");
await page.keyboard.press("Backspace");

// Toggle Bold on via toolbar
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button[aria-label="Pogrubienie"]'))[0];
  btn?.click();
});
await page.keyboard.type("F4a bold", { delay: 10 });
// Turn Bold off
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button[aria-label="Pogrubienie"]'))[0];
  btn?.click();
});
await page.keyboard.press("Enter");
await page.keyboard.type("plain line", { delay: 10 });

const preSubmit = await page.evaluate(() => ({
  strongText: document.querySelector(".tiptap-content strong")?.textContent,
  fullText: document.querySelector(".tiptap-content")?.textContent,
  hiddenJson: document.querySelector('input[name="descriptionJson"]')?.value,
}));
console.log("[4] pre-submit:", preSubmit);
if (preSubmit.strongText !== "F4a bold") throw new Error("bold mark not applied");

// Save
await Promise.all([
  page.waitForResponse(
    (r) => r.url().includes("/t/") && r.request().method() === "POST",
    { timeout: 8000 },
  ).catch(() => null),
  page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Zapisz",
    );
    btn?.click();
  }),
]);
await new Promise((r) => setTimeout(r, 600));
await shot(page, "2-after-save");

// Reload to confirm persistence
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector(".tiptap-content", { timeout: 5000 });
const postReload = await page.evaluate(() => ({
  strongText: document.querySelector(".tiptap-content strong")?.textContent,
  fullText: document.querySelector(".tiptap-content")?.textContent,
  paragraphs: document.querySelectorAll(".tiptap-content p").length,
}));
console.log("[5] after reload:", postReload);
if (postReload.strongText !== "F4a bold") throw new Error("bold not persisted after reload");
if (!postReload.fullText?.includes("plain line")) throw new Error("second paragraph not persisted");
await shot(page, "3-after-reload");

await browser.close();
console.log("DONE — F4a tiptap rich text 5/5");
