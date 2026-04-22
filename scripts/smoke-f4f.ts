// F4f: Inbox + mark-as-read + sidebar badge.
// - Admin @mentions Anna in a comment.
// - Anna logs in → /inbox shows the notification in Nieprzeczytane bucket.
// - Sidebar "Powiadomienia" shows the unread badge count.
// - Anna marks it read → sidebar badge drops by 1, notification moves to Przeczytane.
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
    p.screenshot({ path: path.join(OUT_DIR, `f4f-${tag}-${label}.png`), fullPage: true });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const anna = await db.user.findUnique({ where: { email: "member@danielos.local" } });
  const admin = await db.user.findUnique({ where: { email: "admin@danielos.local" } });
  if (!anna || !admin) throw new Error("users missing");

  // Clear any noise in Anna's inbox for a predictable baseline
  await db.notification.deleteMany({ where: { userId: anna.id } });
  console.log("[0] cleared Anna's notifications");

  const browser = await puppeteer.launch({ headless: true });

  // ── Act 1: Admin mentions Anna ───────────────────────────────────
  const adminPage = await browser.newPage();
  await adminPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await adminPage.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await adminPage.type('input[name="email"]', "admin@danielos.local");
  await adminPage.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    adminPage.waitForNavigation({ waitUntil: "networkidle0" }),
    adminPage.click('button[type="submit"]'),
  ]);

  await Promise.all([
    adminPage.waitForNavigation({ waitUntil: "networkidle0" }),
    adminPage.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((x) =>
        x.textContent?.includes("Demo Workspace"),
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  await Promise.all([
    adminPage.waitForNavigation({ waitUntil: "networkidle0" }),
    adminPage.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((x) =>
        x.textContent?.trim() === "Tabela →",
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  await Promise.all([
    adminPage.waitForNavigation({ waitUntil: "networkidle0" }),
    adminPage.evaluate(() => {
      const a = Array.from(document.querySelectorAll("tbody tr a")).find((x) =>
        x.textContent?.includes("Zaprojektować logo"),
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);

  await adminPage.waitForSelector("section form", { timeout: 8000 });
  await adminPage.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("form"));
    const newForm = forms.find((f) =>
      Array.from(f.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Dodaj komentarz"),
      ),
    );
    (newForm?.querySelector(".tiptap-content") as HTMLElement | null)?.focus();
  });
  await adminPage.keyboard.down("Meta");
  await adminPage.keyboard.press("a");
  await adminPage.keyboard.up("Meta");
  await adminPage.keyboard.press("Backspace");
  const marker = `F4f inbox ${tag}`;
  await adminPage.keyboard.type(`${marker} `, { delay: 10 });
  await adminPage.keyboard.type("@Anna", { delay: 40 });
  await adminPage.waitForSelector(".mention-popover", { timeout: 3000 });
  await adminPage.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 250));
  await adminPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Dodaj komentarz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  console.log("[1] admin posted mention for Anna");
  const afterMention = await db.notification.count({
    where: { userId: anna.id, readAt: null },
  });
  if (afterMention !== 1) throw new Error(`expected 1 unread notif, got ${afterMention}`);

  // ── Act 2: Anna opens the app ────────────────────────────────────
  const annaCtx = await browser.createBrowserContext();
  const annaPage = await annaCtx.newPage();
  await annaPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await annaPage.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
  await annaPage.type('input[name="email"]', "member@danielos.local");
  await annaPage.type('input[name="password"]', "danielos-demo-2026");
  await Promise.all([
    annaPage.waitForNavigation({ waitUntil: "networkidle0" }),
    annaPage.click('button[type="submit"]'),
  ]);

  // Badge on sidebar should show "1" next to Powiadomienia
  const badgeText = await annaPage.evaluate(() => {
    const link = Array.from(document.querySelectorAll("aside a")).find(
      (a) => a.getAttribute("href") === "/inbox",
    );
    const badge = link?.querySelector("span.bg-primary");
    return badge?.textContent?.trim();
  });
  console.log("[2] Anna sidebar badge text:", badgeText);
  if (badgeText !== "1") throw new Error(`expected badge "1", got "${badgeText}"`);
  await shot(annaPage, "1-anna-sidebar-badge");

  // Navigate to /inbox via sidebar link
  await Promise.all([
    annaPage.waitForNavigation({ waitUntil: "networkidle0" }),
    annaPage.click('aside a[href="/inbox"]'),
  ]);
  console.log("[3] inbox url:", annaPage.url());
  const inboxCheck = await annaPage.evaluate((m) => ({
    hasMarker: document.body.textContent?.includes(m),
    unreadHeader: document.body.textContent?.includes("Nieprzeczytane"),
    unreadCount: document.querySelectorAll('div[data-unread="true"]').length,
  }), marker);
  console.log("[4] inbox state:", inboxCheck);
  if (!inboxCheck.hasMarker) throw new Error("inbox missing the marker text");
  if (!inboxCheck.unreadHeader) throw new Error("no Nieprzeczytane bucket");
  if (inboxCheck.unreadCount < 1) throw new Error("no unread row rendered");
  await shot(annaPage, "2-anna-inbox");

  // Mark the first unread as read
  await annaPage.evaluate(() => {
    const form = document
      .querySelector('button[aria-label="Oznacz jako przeczytane"]')
      ?.closest("form");
    form?.requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 900));
  await annaPage.reload({ waitUntil: "networkidle0" });
  const afterRead = await annaPage.evaluate(() => ({
    unreadCount: document.querySelectorAll('div[data-unread="true"]').length,
    readHeader: document.body.textContent?.includes("Przeczytane"),
    badge: (() => {
      const link = Array.from(document.querySelectorAll("aside a")).find(
        (a) => a.getAttribute("href") === "/inbox",
      );
      return link?.querySelector("span.bg-primary")?.textContent?.trim() ?? null;
    })(),
  }));
  console.log("[5] after mark-read:", afterRead);
  if (afterRead.unreadCount !== 0) throw new Error("unread row still present");
  if (!afterRead.readHeader) throw new Error("Przeczytane bucket missing");
  if (afterRead.badge !== null) throw new Error(`badge should clear, got "${afterRead.badge}"`);
  await shot(annaPage, "3-anna-after-read");

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F4f inbox 5/5");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
