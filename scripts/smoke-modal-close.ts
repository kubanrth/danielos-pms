// Quick verification that the task modal's X button actually closes the modal.
// Reproduces the user-reported bug: click X → nothing happens.
import "dotenv/config";
import puppeteer from "puppeteer";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  if (!demo) throw new Error("demo workspace missing");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', "admin@danielos.local");
  await page.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  // Land on the workspace table (so the modal is reachable via soft-nav)
  await page.goto(`http://localhost:3100/w/${demo.id}`, { waitUntil: "networkidle0" });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find(
        (x) => x.textContent?.trim() === "Tabela →",
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  console.log("[1] on board table:", page.url());

  // Soft-nav to task → intercepting modal opens
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("tbody tr a")).find((x) =>
        x.textContent?.includes("Zaprojektować logo"),
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  // Wait for dialog title to appear
  await page.waitForFunction(
    () => !!Array.from(document.querySelectorAll("*")).find((e) => e.textContent?.trim() === "Szczegóły zadania"),
    { timeout: 4000 },
  );
  console.log("[2] modal open, url:", page.url());

  const urlBeforeClose = page.url();

  // Click the X close button
  const closeClicked = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Zamknij"]') as HTMLButtonElement | null;
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!closeClicked) throw new Error("close button not found");

  // Give the route change time
  await new Promise((r) => setTimeout(r, 800));

  const urlAfter = page.url();
  const modalStillOpen = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll("*")).find((e) => e.textContent?.trim() === "Szczegóły zadania"),
  );
  console.log("[3] url after close:", urlAfter);
  console.log("[4] modal still open?", modalStillOpen);

  if (urlAfter === urlBeforeClose) throw new Error("URL didn't change after close");
  if (modalStillOpen) throw new Error("modal still visible after close");
  if (urlAfter.includes("/t/")) throw new Error("still on task URL after close");

  await browser.close();
  await db.$disconnect();
  console.log("DONE — modal close 4/4");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
