// One-off: log in via UI and screenshot /workspaces.
// Usage: node scripts/screenshot-logged-in.mjs
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve to JARVIS-WEB/temporary screenshots regardless of CWD
const OUT_DIR = path.resolve(__dirname, "../../..", "temporary screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const EMAIL = "admin@danielos.local";
const PASSWORD = "danielos-demo-2026";

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

await page.goto("http://localhost:3100/secure-access-portal", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', EMAIL);
await page.type('input[name="password"]', PASSWORD);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click('button[type="submit"]'),
]);

const out = path.join(OUT_DIR, `screenshot-f1a-workspaces-${Date.now()}.png`);
await page.screenshot({ path: out, fullPage: true });
console.log("Saved:", out);
console.log("URL after login:", page.url());

await browser.close();
