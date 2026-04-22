// F4c: @mentions in comments.
// - Type "@" → popover opens with members.
// - Enter picks highlighted → mention chip inserted.
// - Submit → CommentMention row + Notification row for mentioned user.
// - Mention chip renders after reload.
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
    p.screenshot({ path: path.join(OUT_DIR, `f4c-${tag}-${label}.png`), fullPage: true });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // Login as admin (will mention Anna)
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
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((x) =>
        x.textContent?.trim() === "Tabela →",
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("tbody tr a")).find((x) =>
        x.textContent?.includes("Zaprojektować logo"),
      );
      (a as HTMLAnchorElement | undefined)?.click();
    }),
  ]);
  console.log("[1] admin on task:", page.url());

  const anna = await db.user.findUnique({ where: { email: "member@danielos.local" } });
  const admin = await db.user.findUnique({ where: { email: "admin@danielos.local" } });
  if (!anna || !admin) throw new Error("users missing");
  const baselineNotifs = await db.notification.count({
    where: { userId: anna.id, type: "comment.mention" },
  });
  console.log("[2] baseline Anna notif count:", baselineNotifs);

  await page.waitForSelector("section form", { timeout: 5000 });
  await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("form"));
    const newForm = forms.find((f) =>
      Array.from(f.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Dodaj komentarz"),
      ),
    );
    (newForm?.querySelector(".tiptap-content") as HTMLElement | null)?.focus();
  });
  await page.keyboard.down("Meta");
  await page.keyboard.press("a");
  await page.keyboard.up("Meta");
  await page.keyboard.press("Backspace");

  const commentMarker = `F4c mention ${tag}`;
  await page.keyboard.type(commentMarker + " ", { delay: 10 });
  await page.keyboard.type("@Anna", { delay: 40 });
  await page.waitForSelector(".mention-popover", { timeout: 3000 });
  await shot(page, "1-popover-open");
  const popoverItems = await page.$$eval(".mention-popover button", (btns) =>
    btns.map((b) => b.textContent?.trim()),
  );
  console.log("[3] popover items:", popoverItems);
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 250));
  const chipText = await page.evaluate(
    () => document.querySelector("form .tiptap-content .mention-chip")?.textContent,
  );
  console.log("[4] mention chip text:", chipText);
  if (!chipText) throw new Error("mention chip not inserted");

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim().startsWith("Dodaj komentarz"),
    );
    (btn as HTMLButtonElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1100));
  await page.reload({ waitUntil: "networkidle0" });
  await shot(page, "2-after-save");

  // Most recent admin comment → has mention row for Anna
  const newComment = await db.comment.findFirst({
    where: { authorId: admin.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { mentions: true },
  });
  if (!newComment) throw new Error("comment not found in DB");
  console.log(
    "[5] latest admin comment mentions:",
    newComment.mentions.length,
    "→",
    newComment.mentions.map((m) => m.mentionedUserId),
  );
  if (!newComment.mentions.some((m) => m.mentionedUserId === anna.id)) {
    throw new Error("CommentMention row for Anna missing");
  }

  const afterNotifs = await db.notification.count({
    where: { userId: anna.id, type: "comment.mention" },
  });
  console.log("[6] Anna notif count after:", afterNotifs, "(was", baselineNotifs + ")");
  if (afterNotifs !== baselineNotifs + 1) {
    throw new Error(`expected +1 notification, got +${afterNotifs - baselineNotifs}`);
  }

  const chipsAfterReload = await page.$$eval(".mention-chip", (els) =>
    els.map((e) => e.textContent?.trim()),
  );
  console.log("[7] rendered chips after reload:", chipsAfterReload);
  if (chipsAfterReload.length === 0) throw new Error("no chips rendered after reload");

  await browser.close();
  await db.$disconnect();
  console.log("DONE — F4c mentions 7/7");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
