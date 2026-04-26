-- F11-17 (#24): recurring tasks. Template task carries recurrenceRule;
-- cron spawns instances with recurrenceParentId pointing back.

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "recurrenceRule" JSONB,
  ADD COLUMN IF NOT EXISTS "recurrenceParentId" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceLastSpawnAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Task_recurrenceLastSpawnAt_idx"
  ON "Task"("recurrenceLastSpawnAt");
