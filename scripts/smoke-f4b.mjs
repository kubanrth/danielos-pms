// F4b: Comments thread on task detail.
// - Create comment (member) → shows in list.
// - Edit own comment (author only) → "edytowane" appears.
// - Delete own comment → disappears from list.
// - Admin can delete another member's comment.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f4b-${tag}-${label}.png`), fullPage: true });

const browser = await puppeteer.launch({ headless: "new" });

async function login(page, email) {
  await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);
}

async function openSeedTask(page) {
  // /my-tasks is the fastest path for Anna; for admin use workspace.
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
}

async function typeComment(page, text) {
  // Target the "Nowy komentarz" form editor (the last RichTextEditor on the page).
  await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("form"));
    const newForm = forms.find((f) =>
      Array.from(f.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Dodaj komentarz"),
      ),
    );
    const editable = newForm?.querySelector(".tiptap-content");
    editable?.focus();
  });
  // Select-all + delete in case of prior state
  await page.keyboard.down("Meta");
  await page.keyboard.press("a");
  await page.keyboard.up("Meta");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text, { delay: 10 });
}

async function submitNewComment(page) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim().startsWith("Dodaj komentarz"),
    );
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 800));
}

// ─── Act 1: Anna (member) adds a comment ─────────────────────────────
const pageAnna = await browser.newPage();
await pageAnna.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await login(pageAnna, "member@danielos.local");
await openSeedTask(pageAnna);
await pageAnna.waitForSelector("section form", { timeout: 5000 });
console.log("[1] Anna on task:", pageAnna.url());

const annaText = `F4b komentarz Anny ${tag}`;
await typeComment(pageAnna, annaText);
await shot(pageAnna, "1-anna-typed");
await submitNewComment(pageAnna);
await pageAnna.reload({ waitUntil: "networkidle0" });
const annaSees = await pageAnna.evaluate((t) => document.body.textContent?.includes(t), annaText);
console.log("[2] comment visible after reload:", annaSees);
if (!annaSees) throw new Error("Anna's comment didn't persist");
await shot(pageAnna, "2-anna-after-post");

// ─── Act 2: Anna edits her comment ──────────────────────────────────
const editClicked = await pageAnna.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Edytuj"]');
  if (!btn) return false;
  btn.click();
  return true;
});
if (!editClicked) throw new Error("edit button missing for Anna");
await new Promise((r) => setTimeout(r, 300));
// The inline edit form is now visible; type additional text
await pageAnna.evaluate(() => {
  // Focus the editor inside the inline edit form (first form inside article)
  const article = document.querySelector("article");
  const editable = article?.querySelector("form .tiptap-content");
  editable?.focus();
  // Put caret at end
  const range = document.createRange();
  range.selectNodeContents(editable);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
});
await pageAnna.keyboard.type(" (edit)", { delay: 10 });
// Debug: inspect the edit form state before submit
const preSave = await pageAnna.evaluate(() => {
  const article = document.querySelector("article");
  const form = article?.querySelector("form");
  const hidden = form?.querySelector('input[name="bodyJson"]');
  const editorText = form?.querySelector(".tiptap-content")?.textContent;
  return { hiddenLen: hidden?.value?.length, editorText };
});
console.log("[3a] pre-save edit form:", preSave);
await pageAnna.evaluate(() => {
  const article = document.querySelector("article");
  const form = article?.querySelector("form");
  if (!form) return;
  form.requestSubmit();
});
await new Promise((r) => setTimeout(r, 900));
await pageAnna.reload({ waitUntil: "networkidle0" });
const annaEdited = await pageAnna.evaluate(() => ({
  hasEditText: document.body.textContent?.includes("(edit)"),
  hasEditedBadge: document.body.textContent?.includes("edytowane"),
}));
console.log("[3] after edit:", annaEdited);
if (!annaEdited.hasEditText) throw new Error("edit didn't persist");
if (!annaEdited.hasEditedBadge) throw new Error("edited badge missing");
await shot(pageAnna, "3-anna-after-edit");

// ─── Act 3: Admin opens same task, should see Anna's comment + can delete ──
// Fresh incognito context so admin's cookies don't collide with Anna's.
const adminCtx = await browser.createBrowserContext();
const pageAdmin = await adminCtx.newPage();
await pageAdmin.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await login(pageAdmin, "admin@danielos.local");
await pageAdmin.goto(pageAnna.url(), { waitUntil: "networkidle0" });
const adminSees = await pageAdmin.evaluate((t) => document.body.textContent?.includes(t), annaText);
console.log("[4] admin sees Anna's comment:", adminSees);
if (!adminSees) throw new Error("admin didn't load Anna's comment");
await shot(pageAdmin, "4-admin-view");

// Admin should NOT see an Edit button on Anna's comment (not author),
// but SHOULD see Delete (moderator).
const adminBtns = await pageAdmin.evaluate(() => ({
  edit: document.querySelectorAll('button[aria-label="Edytuj"]').length,
  del: document.querySelectorAll('button[aria-label="Usuń"]').length,
}));
console.log("[5] admin buttons:", adminBtns);
if (adminBtns.edit !== 0) throw new Error("admin shouldn't see Edit on other's comment");
if (adminBtns.del < 1) throw new Error("admin should have a Delete button");

// Admin deletes Anna's specific comment (scoped by matching text).
const deleted = await pageAdmin.evaluate((t) => {
  const article = Array.from(document.querySelectorAll("article")).find((a) =>
    a.textContent?.includes(t),
  );
  const form = article?.querySelector('form button[aria-label="Usuń"]')?.closest("form");
  if (!form) return false;
  form.requestSubmit();
  return true;
}, annaText);
if (!deleted) throw new Error("couldn't locate Anna's comment article");
await new Promise((r) => setTimeout(r, 900));
await pageAdmin.reload({ waitUntil: "networkidle0" });
const stillThere = await pageAdmin.evaluate((t) => document.body.textContent?.includes(t), annaText);
console.log("[6] after admin delete, comment still visible:", stillThere);
if (stillThere) throw new Error("admin delete failed");
await shot(pageAdmin, "5-admin-after-delete");

await browser.close();
console.log("DONE — F4b comments CRUD 6/6");
