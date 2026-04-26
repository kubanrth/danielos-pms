-- F11-23 (#14): Notatnik iOS-parity. Rich text contentJson + soft-delete.

ALTER TABLE "Note"
  ADD COLUMN IF NOT EXISTS "contentJson" JSONB,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Note_deletedAt_idx" ON "Note"("deletedAt");
