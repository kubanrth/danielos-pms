import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Direct connection (port 5432) for Prisma CLI (migrations can't run through pooler).
    // Runtime queries go through the pooler (port 6543) via the driver adapter in lib/db.ts.
    url: process.env["DIRECT_URL"],
  },
});
