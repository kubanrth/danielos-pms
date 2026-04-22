// F6a: Whiteboard skeleton (React Flow + snapshot save, no Yjs yet).
// - /canvases list + create form renders.
// - Create canvas from UI → land in editor.
// - Click "+ Prostokąt" twice → 2 nodes in React Flow state.
// - Click "Zapisz" → ProcessNode rows persist.
// - Reload → nodes are still there.
// - Delete canvas from list → soft-deleted in DB.
import "dotenv/config";
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const tag = Date.now();
  type ShotPage = { screenshot: (opts: { path: string; fullPage: boolean }) => Promise<unknown> };
  const shot = (p: ShotPage, label: string) =>
    p.screenshot({ path: path.join(OUT_DIR, `f6a-${tag}-${label}.png`), fullPage: true });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  if (!demo) throw new Error("demo workspace missing");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // Login as admin
  await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', "admin@danielos.local");
  await page.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  // /canvases — create a fresh canvas
  await page.goto(`http://localhost:3100/w/${demo.id}/canvases`, { waitUntil: "networkidle0" });
  console.log("[1] canvases url:", page.url());
  await shot(page, "1-list");

  const canvasName = `F6a smoke ${tag}`;
  await page.type('input[name="name"]', canvasName);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Nowa kanwa"),
      );
      (btn as HTMLButtonElement | undefined)?.click();
    }),
  ]);
  console.log("[2] editor url:", page.url());

  const created = await db.processCanvas.findFirst({
    where: { workspaceId: demo.id, name: canvasName, deletedAt: null },
  });
  if (!created) throw new Error("canvas not created in DB");

  // Wait for React Flow to mount
  await page.waitForSelector(".react-flow", { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 600));

  // Add 2 rectangle nodes via toolbar
  const addRect = async () => {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.getAttribute("aria-label") === "Prostokąt",
      );
      (btn as HTMLButtonElement | undefined)?.click();
    });
    await new Promise((r) => setTimeout(r, 150));
  };
  await addRect();
  await addRect();
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label") === "Romb",
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  const nodeCount = await page.$$eval(".react-flow__node", (els) => els.length);
  console.log("[3] RF node count after toolbar:", nodeCount);
  if (nodeCount !== 3) throw new Error(`expected 3 RF nodes, got ${nodeCount}`);
  await shot(page, "2-added-nodes");

  // Click Zapisz
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Zapisz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1800));

  const persistedNodes = await db.processNode.count({ where: { canvasId: created.id } });
  console.log("[4] persisted nodes:", persistedNodes);
  if (persistedNodes !== 3) throw new Error(`expected 3 persisted nodes, got ${persistedNodes}`);

  // Reload → nodes should hydrate
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".react-flow", { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 800));
  const reloadedNodeCount = await page.$$eval(".react-flow__node", (els) => els.length);
  console.log("[5] RF nodes after reload:", reloadedNodeCount);
  if (reloadedNodeCount !== 3) throw new Error(`expected 3 after reload, got ${reloadedNodeCount}`);
  await shot(page, "3-after-reload");

  // Go back to /canvases and delete via card button
  await page.goto(`http://localhost:3100/w/${demo.id}/canvases`, { waitUntil: "networkidle0" });
  // Auto-confirm the window.confirm prompt
  page.on("dialog", (d) => d.accept());
  const deleteClicked = await page.evaluate((name) => {
    const cards = Array.from(document.querySelectorAll("article"));
    const card = cards.find((a) => a.textContent?.includes(name));
    const form = card?.querySelector('form button[aria-label="Usuń kanwę"]')?.closest("form");
    if (!form) return false;
    (form as HTMLFormElement).requestSubmit();
    return true;
  }, canvasName);
  if (!deleteClicked) throw new Error("couldn't click delete on canvas card");
  await new Promise((r) => setTimeout(r, 1200));
  const afterDelete = await db.processCanvas.findUnique({ where: { id: created.id } });
  console.log("[6] canvas after delete:", afterDelete?.deletedAt);
  if (!afterDelete?.deletedAt) throw new Error("canvas not soft-deleted");

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F6a whiteboard 6/6");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
