import { readFileSync } from "node:fs";
import pg from "pg";

// Load .env manually
const env = Object.fromEntries(
  readFileSync(".env", "utf-8").split("\n").filter(Boolean).filter(l => !l.startsWith("#")).map(l => {
    const eq = l.indexOf("=");
    let v = l.slice(eq + 1);
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return [l.slice(0, eq), v];
  }),
);
const url = env.DIRECT_URL || env.DATABASE_URL;
const client = new pg.Client({ connectionString: url });
await client.connect();

console.log("=== BoardView columns ===");
const cols = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'BoardView'
  ORDER BY ordinal_position;
`);
console.log(cols.rows);

console.log("\n=== Workspace.enabledViews ===");
const ws = await client.query(`
  SELECT id, name, "enabledViews" FROM "Workspace" WHERE "deletedAt" IS NULL LIMIT 3;
`);
console.log(ws.rows);

console.log("\n=== BoardLink ===");
const bl = await client.query(`SELECT COUNT(*) FROM "BoardLink";`);
console.log(bl.rows);

console.log("\n=== WikiPage ===");
const wp = await client.query(`SELECT COUNT(*) FROM "WikiPage";`);
console.log(wp.rows);

console.log("\n=== ProcessEdge.endStyle ===");
const pe = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='ProcessEdge' AND column_name='endStyle';
`);
console.log(pe.rows);

await client.end();
