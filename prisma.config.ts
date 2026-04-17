import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Pooler URL for runtime queries (serverless-friendly).
    url: process.env["DATABASE_URL"],
    // Direct connection for migrations (pooler can't run DDL).
    directUrl: process.env["DIRECT_URL"],
  },
});
