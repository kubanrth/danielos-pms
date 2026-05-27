import { db } from "@/lib/db";

async function main() {
  console.log("=== Workspace.enabledViews ===");
  const ws = await db.workspace.findMany({ select: { id: true, name: true, enabledViews: true }, take: 3 });
  console.log(JSON.stringify(ws, null, 2));

  console.log("\n=== BoardView.name column ===");
  const bv = await db.boardView.findMany({ select: { id: true, boardId: true, type: true, name: true }, take: 3 });
  console.log(JSON.stringify(bv, null, 2));

  console.log("\n=== BoardLink ===");
  const bl = await db.boardLink.findMany({ take: 3 });
  console.log("rows:", bl.length);

  console.log("\n=== BoardHeaderServer custom-view query ===");
  const firstBoard = await db.board.findFirst({ select: { id: true, name: true } });
  if (firstBoard) {
    const custom = await db.boardView.findMany({ where: { boardId: firstBoard.id, name: { not: null } } });
    console.log(`board ${firstBoard.name}: ${custom.length} custom views`);
  }

  await db.$disconnect();
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
