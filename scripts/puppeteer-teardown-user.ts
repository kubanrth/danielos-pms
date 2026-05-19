// F12-K59: czyści tymczasowego usera + workspace'y stworzone przez
// puppeteer-setup-user.ts. Soft delete (deletedAt) — bezpieczniej niż
// destrukcyjny delete, w razie czego można cofnąć ręcznie w SQL.
//
// Run: npx tsx scripts/puppeteer-teardown-user.ts

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const TEST_EMAIL = "puppeteer-test@flovly.local";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const now = new Date();

  // Soft-delete workspaces (the user is owner of these).
  const wsResult = await db.workspace.updateMany({
    where: { slug: { in: ["puppeteer-sst", "puppeteer-asd"] } },
    data: { deletedAt: now },
  });
  console.log("workspaces soft-deleted:", wsResult.count);

  // Soft-delete user (don't hard-delete — audit trail, FK refs).
  const userResult = await db.user.updateMany({
    where: { email: TEST_EMAIL },
    data: { deletedAt: now },
  });
  console.log("users soft-deleted:", userResult.count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => db.$disconnect());
