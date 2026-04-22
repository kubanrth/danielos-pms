// F6b: Yjs + Supabase Realtime collab.
// Two browser contexts open the SAME canvas simultaneously. Tab A adds
// a node → Tab B sees it appear without reload. Tab B adds one in
// reply → Tab A sees both. After Tab A saves, both node rows are in DB.
import "dotenv/config";
import puppeteer, { type Browser, type Page } from "puppeteer";
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

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  const admin = await db.user.findUnique({ where: { email: "admin@danielos.local" } });
  if (!demo || !admin) throw new Error("seed state missing");

  // Create the canvas fresh in DB so both tabs land on the same id.
  const canvas = await db.processCanvas.create({
    data: {
      workspaceId: demo.id,
      creatorId: admin.id,
      name: `F6b collab ${tag}`,
    },
  });
  console.log("[0] canvas created:", canvas.id);

  const browser = await puppeteer.launch({ headless: true });

  const login = async (page: Page) => {
    await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
    await page.type('input[name="email"]', "admin@danielos.local");
    await page.type('input[name="password"]', "danielos-demo-2026");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);
  };

  const openEditor = async (browser: Browser) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await login(page);
    await page.goto(`http://localhost:3100/w/${demo.id}/c/${canvas.id}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector(".react-flow", { timeout: 6000 });
    // Wait for the "live" indicator to confirm the realtime channel is up.
    await page.waitForFunction(
      () => !!Array.from(document.querySelectorAll("span")).find((s) => s.textContent === "live"),
      { timeout: 6000 },
    );
    return { ctx, page };
  };

  const tabA = await openEditor(browser);
  const tabB = await openEditor(browser);
  console.log("[1] both tabs connected");
  // Small warm-up so the request-state broadcast has time to land before
  // the first mutation fires.
  await new Promise((r) => setTimeout(r, 500));

  const addRect = async (page: Page) => {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.getAttribute("aria-label") === "Prostokąt",
      );
      (btn as HTMLButtonElement | undefined)?.click();
    });
  };

  const nodeCount = (page: Page) =>
    page.$$eval(".react-flow__node", (els) => els.length);

  // Tab A: add a rectangle → Tab B should see count go from 0 → 1 within 2s
  await addRect(tabA.page);
  const startA = Date.now();
  let syncedB = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if ((await nodeCount(tabB.page)) >= 1) {
      syncedB = true;
      console.log(`[2] Tab B picked up Tab A's node after ${Date.now() - startA}ms`);
      break;
    }
  }
  if (!syncedB) throw new Error("Tab B didn't see Tab A's node within 2s");

  // Tab B adds another → Tab A should see 2 total
  await addRect(tabB.page);
  const startB = Date.now();
  let syncedA = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if ((await nodeCount(tabA.page)) >= 2) {
      syncedA = true;
      console.log(`[3] Tab A picked up Tab B's node after ${Date.now() - startB}ms`);
      break;
    }
  }
  if (!syncedA) throw new Error("Tab A didn't see Tab B's node within 2s");

  // Both tabs should converge on 2 nodes total
  const finalA = await nodeCount(tabA.page);
  const finalB = await nodeCount(tabB.page);
  console.log("[4] final counts — A:", finalA, "B:", finalB);
  if (finalA !== 2 || finalB !== 2) {
    throw new Error(`expected both tabs at 2 nodes, got A=${finalA} B=${finalB}`);
  }

  // Save from Tab A → DB should end up with both nodes.
  await tabA.page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Zapisz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1800));
  const persisted = await db.processNode.count({ where: { canvasId: canvas.id } });
  console.log("[5] persisted node rows:", persisted);
  if (persisted !== 2) throw new Error(`expected 2 persisted, got ${persisted}`);

  // Screenshots for visual confirmation
  await tabA.page.screenshot({
    path: path.join(OUT_DIR, `f6b-${tag}-tabA.png`),
    fullPage: true,
  });
  await tabB.page.screenshot({
    path: path.join(OUT_DIR, `f6b-${tag}-tabB.png`),
    fullPage: true,
  });

  // Cleanup: soft-delete the test canvas so repeated runs don't litter
  // the /canvases list. Prisma cascades take care of nodes/edges.
  await db.processCanvas.update({
    where: { id: canvas.id },
    data: { deletedAt: new Date() },
  });

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F6b Yjs collab 5/5");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
