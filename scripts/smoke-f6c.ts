// F6c: Node ↔ task binding.
// 1. Create a canvas + add a node.
// 2. Select node, link existing workspace task via picker.
// 3. Reload — chip renders on node.
// 4. Save canvas (moving the node) — link survives the upsert save.
// 5. Create-and-link via prompt — new task + link persisted.
// 6. Unlink — link row removed.
import "dotenv/config";
import puppeteer from "puppeteer";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  const seedTask = await db.task.findFirst({
    where: { workspaceId: demo!.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!demo || !seedTask) throw new Error("seed state missing");

  const tag = Date.now();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  page.on("dialog", async (d) => {
    // Auto-accept prompts with a canned title for create-from-node.
    if (d.type() === "prompt") await d.accept(`F6c node task ${tag}`);
    else await d.accept();
  });

  // Login
  await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', "admin@danielos.local");
  await page.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  // Create a fresh canvas
  await page.goto(`http://localhost:3100/w/${demo.id}/canvases`, { waitUntil: "networkidle0" });
  const canvasName = `F6c smoke ${tag}`;
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
  const canvas = await db.processCanvas.findFirst({
    where: { workspaceId: demo.id, name: canvasName, deletedAt: null },
  });
  if (!canvas) throw new Error("canvas not created");
  console.log("[1] canvas created:", canvas.id);

  await page.waitForSelector(".react-flow", { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 500));

  // Add a rectangle
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label") === "Prostokąt",
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  // Save so the node exists in DB
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Zapisz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const rows = await db.processNode.findMany({ where: { canvasId: canvas.id } });
  if (rows.length !== 1) throw new Error(`expected 1 node, got ${rows.length}`);
  const nodeId = rows[0].id;
  console.log("[2] node persisted:", nodeId);

  // Click the node to select it
  await page.evaluate(() => {
    const n = document.querySelector(".react-flow__node");
    (n as HTMLElement | null)?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  // Task-links panel should appear
  const panelOpen = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll("*")).find((e) => e.textContent === "Zadania na węźle"),
  );
  if (!panelOpen) throw new Error("task-links panel didn't open");
  console.log("[3] panel opened");

  // Type into the task search and click the first match (the seed task
  // title is "Zaprojektować logo DANIELOS").
  await page.type('input[placeholder="szukaj zadania…"]', "logo");
  await new Promise((r) => setTimeout(r, 300));
  const linkClicked = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll("ul > li > button"));
    const hit = opts.find((b) => b.textContent?.includes("logo"));
    (hit as HTMLButtonElement | undefined)?.click();
    return !!hit;
  });
  if (!linkClicked) throw new Error("couldn't click a link suggestion");
  await new Promise((r) => setTimeout(r, 900));

  const linkAfter = await db.processNodeTaskLink.findMany({ where: { nodeId } });
  console.log("[4] links after link-action:", linkAfter.length);
  if (linkAfter.length !== 1 || linkAfter[0].taskId !== seedTask.id) {
    throw new Error("link not stored correctly");
  }

  // Reload — chip should render
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".react-flow__node", { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 500));
  const chipVisible = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll("a[href*='/t/']")).find((a) =>
      a.textContent?.includes("logo"),
    ),
  );
  if (!chipVisible) throw new Error("chip not visible after reload");
  console.log("[5] chip visible on node after reload");

  // Save again (should use upsert path and preserve the link)
  await page.evaluate(() => {
    const n = document.querySelector(".react-flow__node");
    (n as HTMLElement | null)?.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Zapisz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const afterSave = await db.processNodeTaskLink.findMany({ where: { nodeId } });
  console.log("[6] links after second save:", afterSave.length);
  if (afterSave.length !== 1) throw new Error("link didn't survive upsert save");

  // Click "Utwórz zadanie z węzła" — dialog handler accepts with canned title.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Utwórz zadanie z węzła"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  const afterCreate = await db.processNodeTaskLink.findMany({
    where: { nodeId },
    include: { task: { select: { title: true } } },
  });
  console.log("[7] links after create-and-link:", afterCreate.map((l) => l.task.title));
  if (afterCreate.length !== 2) throw new Error(`expected 2 links, got ${afterCreate.length}`);
  const hasNewTask = afterCreate.some((l) => l.task.title === `F6c node task ${tag}`);
  if (!hasNewTask) throw new Error("new task not linked");

  // Unlink the original seed task via the panel's X button
  await page.goto(`http://localhost:3100/w/${demo.id}/c/${canvas.id}`, {
    waitUntil: "networkidle0",
  });
  await page.waitForSelector(".react-flow__node", { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => {
    const n = document.querySelector(".react-flow__node");
    (n as HTMLElement | null)?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    // Find the panel's linked-task list and click the first Odepnij
    const panel = Array.from(document.querySelectorAll("div")).find(
      (d) => d.children.length > 0 && d.textContent?.startsWith("Zadania na węźle"),
    );
    const btn = panel?.querySelector('button[aria-label="Odepnij"]');
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 900));

  const afterUnlink = await db.processNodeTaskLink.findMany({ where: { nodeId } });
  console.log("[8] links after unlink:", afterUnlink.length);
  if (afterUnlink.length !== 1) throw new Error(`expected 1 after unlink, got ${afterUnlink.length}`);

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F6c node↔task binding 8/8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
