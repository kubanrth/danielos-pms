// F8b: verify the RLS lockdown actually affects the anon role.
//
// Two phases:
//   Phase 1 — pre-migration baseline: publishable-key client does whatever
//             the DB currently allows.
//   Phase 2 — post-migration: same client should be denied. Prisma's
//             connection (postgres role, bypasses RLS) keeps working so
//             the admin panel smoke would still pass.
//
// Run this AFTER `npx prisma migrate deploy` (which applies the new
// migration) — it only verifies the post-state.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) throw new Error("Supabase env missing");

  // Anon client — same key the browser uses.
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Probe a handful of tables. After RLS lockdown every one should
  // either return an error or an empty array.
  const probes = ["Workspace", "Task", "User", "Comment", "ProcessCanvas"];
  const results: { table: string; rowsSeen: number; error: string | null }[] = [];
  for (const table of probes) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    results.push({
      table,
      rowsSeen: data?.length ?? 0,
      error: error?.message ?? null,
    });
  }
  console.log("[1] anon probes post-lockdown:");
  for (const r of results) console.log("   -", r);

  const stillLeaking = results.filter((r) => r.rowsSeen > 0);
  if (stillLeaking.length > 0) {
    throw new Error(
      `anon role can still SELECT from: ${stillLeaking.map((r) => r.table).join(", ")}`,
    );
  }

  // Sanity — Prisma (postgres role, BYPASSRLS) must still see data.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  const wsCount = await db.workspace.count({ where: { deletedAt: null } });
  const userCount = await db.user.count();
  console.log(
    "[2] prisma sees workspaces:",
    wsCount,
    "users:",
    userCount,
    "(both must be > 0)",
  );
  if (wsCount === 0 || userCount === 0) {
    throw new Error("Prisma query returned 0 — RLS may be blocking service role");
  }

  await db.$disconnect();
  console.log("DONE — F8b RLS lockdown 2/2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
