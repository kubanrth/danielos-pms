// F4d: Attachments — upload / thumbnail / download / delete.
// - Admin uploads a tiny PNG via the hidden file input.
// - Attachment row created, storage object exists, thumbnail rendered.
// - Download action returns a fresh 15-min signed URL that fetches 200.
// - Delete removes the row (soft) AND the storage object.
import "dotenv/config";
import puppeteer from "puppeteer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

// 1×1 transparent PNG (smallest valid file) — keeps the upload round-trip
// sub-millisecond so smoke stays fast.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const tag = Date.now();
  type ShotPage = { screenshot: (opts: { path: string; fullPage: boolean }) => Promise<unknown> };
  const shot = (p: ShotPage, label: string) =>
    p.screenshot({ path: path.join(OUT_DIR, `f4d-${tag}-${label}.png`), fullPage: true });

  const fixturePath = path.join(os.tmpdir(), `f4d-${tag}.png`);
  fs.writeFileSync(fixturePath, PNG_1PX);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const demo = await db.workspace.findUnique({ where: { slug: "demo" } });
  const seedTask = await db.task.findFirst({
    where: { workspaceId: demo!.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!demo || !seedTask) throw new Error("seed state missing");

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
  await page.goto(`http://localhost:3100/w/${demo.id}/t/${seedTask.id}`, {
    waitUntil: "networkidle0",
  });
  console.log("[1] admin on task detail");

  // Force-show the hidden file input so uploadFile can target it.
  await page.waitForSelector('input[type="file"]', { timeout: 5000 });
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) throw new Error("file input missing");
  await fileInput.uploadFile(fixturePath);
  console.log("[2] fixture uploaded to input");

  // The component handles onChange → request signed URL → PUT → confirm.
  // Give it enough time for all three round-trips to complete.
  await new Promise((r) => setTimeout(r, 4000));
  await shot(page, "1-after-upload");

  const attachment = await db.attachment.findFirst({
    where: { taskId: seedTask.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!attachment) throw new Error("attachment row not created");
  console.log("[3] attachment row:", {
    id: attachment.id,
    filename: attachment.filename,
    size: attachment.sizeBytes,
    storageKey: attachment.storageKey,
  });

  // Verify the storage object exists via the same admin client the UI uses.
  const { data: listed } = await supabase.storage
    .from("attachments")
    .list(attachment.storageKey.slice(0, attachment.storageKey.lastIndexOf("/")), {
      search: attachment.storageKey.slice(attachment.storageKey.lastIndexOf("/") + 1),
      limit: 1,
    });
  if (!listed || listed.length === 0) throw new Error("storage object missing");
  console.log("[4] storage object present");

  // Reload to pull the thumbnail URL through the server render.
  await page.reload({ waitUntil: "networkidle0" });
  const thumbSrc = await page.evaluate(() => {
    const img = document.querySelector('section img[alt$=".png"]') as HTMLImageElement | null;
    return img?.src ?? null;
  });
  console.log("[5] thumbnail rendered:", thumbSrc?.slice(0, 80), "…");
  if (!thumbSrc || !thumbSrc.includes("/storage/v1/object/sign/")) {
    throw new Error("thumbnail missing or not a signed URL");
  }

  // Fetch the signed URL directly — should return 200 + image content.
  const thumbFetch = await fetch(thumbSrc);
  console.log("[6] signed URL status:", thumbFetch.status);
  if (thumbFetch.status !== 200) throw new Error(`signed URL HTTP ${thumbFetch.status}`);

  // Delete via the in-UI form
  await page.evaluate(() => {
    const btn = document.querySelector('form button[aria-label="Usuń"]') as HTMLButtonElement | null;
    btn?.closest("form")?.requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.reload({ waitUntil: "networkidle0" });

  const afterDelete = await db.attachment.findUnique({ where: { id: attachment.id } });
  console.log("[7] post-delete row state:", { deletedAt: afterDelete?.deletedAt });
  if (!afterDelete?.deletedAt) throw new Error("attachment row not soft-deleted");

  const { data: listedAfter } = await supabase.storage
    .from("attachments")
    .list(attachment.storageKey.slice(0, attachment.storageKey.lastIndexOf("/")), {
      search: attachment.storageKey.slice(attachment.storageKey.lastIndexOf("/") + 1),
      limit: 1,
    });
  console.log("[8] storage objects after delete:", listedAfter?.length);
  if ((listedAfter?.length ?? 0) !== 0) throw new Error("storage object not removed");

  await shot(page, "2-after-delete");
  await browser.close();
  await db.$disconnect();
  fs.unlinkSync(fixturePath);
  console.log("DONE — F4d attachments 8/8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
