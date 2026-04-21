// F3b: Realtime sync between two tabs on the same workspace.
// Tab A changes a task's status via the table's inline select.
// Tab B — on the Kanban — should see the card move columns within ~1 s.
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const tag = Date.now();
const shot = (page, label) =>
  page.screenshot({ path: path.join(OUT_DIR, `f3b-${tag}-${label}.png`), fullPage: true });

const browser = await puppeteer.launch({ headless: "new" });

async function login(page) {
  await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', "admin@danielos.local");
  await page.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);
}

async function goToDemoWorkspace(page) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((x) =>
        x.textContent?.includes("Demo Workspace"),
      );
      a?.click();
    }),
  ]);
}

// Tab A — Table view (will change task status)
const pageA = await browser.newPage();
await pageA.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await login(pageA);
await goToDemoWorkspace(pageA);
await Promise.all([
  pageA.waitForNavigation({ waitUntil: "networkidle0" }),
  pageA.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) =>
      x.textContent?.trim() === "Tabela →",
    );
    a?.click();
  }),
]);
console.log("[1] Tab A on Table:", pageA.url());

// Tab B — Kanban (will observe). Session cookies are shared with Tab A.
const boardMatch = pageA.url().match(/\/w\/([^/]+)\/b\/([^/]+)/);
const pageB = await browser.newPage();
await pageB.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await pageB.goto(
  `http://localhost:3100/w/${boardMatch[1]}/b/${boardMatch[2]}/kanban`,
  { waitUntil: "networkidle0" },
);
console.log("[2] Tab B on Kanban:", pageB.url());
await shot(pageB, "1-kanban-before");

// Record which column each task is in on B before the change
const before = await pageB.evaluate(() => {
  const cols = Array.from(document.querySelectorAll(".flex.w-\\[300px\\]"));
  return cols.map((c) => ({
    name: c.querySelector("span")?.textContent?.trim() ?? "",
    cards: Array.from(c.querySelectorAll("article a")).map((a) => a.textContent?.trim() ?? ""),
  }));
});
console.log("[3] B before — columns:");
for (const c of before) console.log("   -", c.name, "→", c.cards);

// On Tab A, change the first task's status via the table select.
// Pick a status that's different from the current one.
const result = await pageA.evaluate(() => {
  const row = document.querySelector("tbody tr");
  if (!row) return { error: "no row" };
  const title = row.querySelector("a")?.textContent?.trim();
  const select = row.querySelector('select[name="statusColumnId"]');
  if (!select) return { error: "no select" };
  const current = select.value;
  const options = Array.from(select.options);
  const different = options.find((o) => o.value && o.value !== current);
  if (!different) return { error: "no alt option" };
  select.value = different.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return { title, from: current, to: different.value, toName: different.textContent?.trim() };
});
console.log("[4] Tab A changed status:", result);
if (result.error) throw new Error("Tab A: " + result.error);
await new Promise((r) => setTimeout(r, 500));
await shot(pageA, "2-table-after-change");

// Give realtime broadcast time to propagate + router.refresh to complete.
const startWait = Date.now();
let synced = false;
for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const after = await pageB.evaluate((tTitle) => {
    const cols = Array.from(document.querySelectorAll(".flex.w-\\[300px\\]"));
    for (let i = 0; i < cols.length; i++) {
      const cards = Array.from(cols[i].querySelectorAll("article a")).map(
        (a) => a.textContent?.trim(),
      );
      if (cards.includes(tTitle)) {
        return {
          colIndex: i,
          colName: cols[i].querySelector("span")?.textContent?.trim(),
          cards,
        };
      }
    }
    return null;
  }, result.title);
  if (after && after.colName !== before.find((b) => b.cards.includes(result.title))?.name) {
    console.log(
      `[5] Tab B synced after ${Date.now() - startWait}ms — card now in:`,
      after.colName,
    );
    synced = true;
    break;
  }
}
if (!synced) throw new Error("Tab B did not pick up the change within 7.5s");
await shot(pageB, "3-kanban-after-sync");

await browser.close();
console.log("DONE — F3b realtime sync 5/5");
