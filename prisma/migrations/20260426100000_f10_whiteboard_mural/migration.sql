-- F10-W (Mural-feel whiteboard): TEXT shape kind + free-draw strokes.
-- TEXT renders as borderless text in shape-node.tsx; ProcessStroke
-- stores pen-tool drawings as JSON arrays of {x,y} points.

ALTER TYPE "NodeShape" ADD VALUE IF NOT EXISTS 'TEXT';

CREATE TABLE IF NOT EXISTS "ProcessStroke" (
  "id"        TEXT NOT NULL,
  "canvasId"  TEXT NOT NULL,
  "colorHex"  TEXT NOT NULL DEFAULT '#1F2937',
  "size"      INTEGER NOT NULL DEFAULT 2,
  "points"    JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcessStroke_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcessStroke_canvasId_idx" ON "ProcessStroke"("canvasId");

ALTER TABLE "ProcessStroke"
  ADD CONSTRAINT "ProcessStroke_canvasId_fkey"
  FOREIGN KEY ("canvasId") REFERENCES "ProcessCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
