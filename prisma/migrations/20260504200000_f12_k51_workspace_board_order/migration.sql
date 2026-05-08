-- F12-K51: kolejność workspace'ów + tablic (drag-and-drop reorder).
-- Float order pozwala wstawić między 2 sąsiadów bez rewrite całej kolumny.

-- Workspace
ALTER TABLE "Workspace" ADD COLUMN "order" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: existing workspaces dostają order = epoch ms ich createdAt
-- (czyli najnowszy ma największy order, najstarszy najmniejszy).
-- Klient może później zmienić kolejność drag-and-drop'em.
UPDATE "Workspace"
SET "order" = EXTRACT(EPOCH FROM "createdAt") * 1000;

-- Board
ALTER TABLE "Board" ADD COLUMN "order" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Board"
SET "order" = EXTRACT(EPOCH FROM "createdAt") * 1000;
