-- F8b: column editor prefs (BoardView.configJson), custom views (enabled
-- by F8 unique-drop), Whiteboard Whimsical-lite (STICKY/FRAME NodeShape
-- values, ProcessEdge.endStyle).

-- === NodeShape: extend enum ===
-- Postgres requires enum additions outside a txn when other DDL follows,
-- so we use ADD VALUE IF NOT EXISTS individually.
ALTER TYPE "NodeShape" ADD VALUE IF NOT EXISTS 'STICKY';
ALTER TYPE "NodeShape" ADD VALUE IF NOT EXISTS 'FRAME';

-- === ProcessEdge.endStyle ===
-- String column (not enum) so adding new connector endings later is a
-- code-only change.
ALTER TABLE "ProcessEdge"
  ADD COLUMN IF NOT EXISTS "endStyle" TEXT NOT NULL DEFAULT 'arrow';
