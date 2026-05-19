// F12-K59: one-off — tworzy / aktualizuje tymczasowego usera + 2
// workspace'y do screenshotów sidebar redesign w puppeteer'ze.
// Po zrobieniu screenshotów wywołaj scripts/puppeteer-teardown-user.ts.
//
// Run: npx tsx scripts/puppeteer-setup-user.ts
//
// Test creds:
//   email: puppeteer-test@flovly.local
//   password: temp-puppeteer-2026

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { Role } from "../lib/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const TEST_EMAIL = "puppeteer-test@flovly.local";
const TEST_PASSWORD = "temp-puppeteer-2026";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await db.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, name: "Kuba", emailVerified: new Date(), isSuperAdmin: true },
    create: {
      email: TEST_EMAIL,
      name: "Kuba",
      passwordHash,
      isSuperAdmin: true,
      emailVerified: new Date(),
    },
  });
  console.log("user:", user.email, user.id);

  // 2 workspace'y żeby było widać oba swatche w sidebarze.
  for (const [slug, name] of [
    ["puppeteer-sst", "SideSideTwo"],
    ["puppeteer-asd", "asdfdasf"],
  ] as const) {
    const ws = await db.workspace.upsert({
      where: { slug },
      update: { ownerId: user.id, deletedAt: null },
      create: { name, slug, ownerId: user.id },
    });
    await db.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
      update: { role: Role.ADMIN },
      create: { workspaceId: ws.id, userId: user.id, role: Role.ADMIN },
    });
    console.log("workspace:", slug, ws.id);
  }

  console.log("\nDone. Login with:");
  console.log("  email:", TEST_EMAIL);
  console.log("  pw:   ", TEST_PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => db.$disconnect());
