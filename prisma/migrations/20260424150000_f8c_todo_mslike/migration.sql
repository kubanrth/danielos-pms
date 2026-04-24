-- F8c: TO DO module Microsoft-like feature parity.
-- Adds: TodoItem.important/myDayAt/notes/reminderAt/reminderSentAt
-- New:  TodoStep table

ALTER TABLE "TodoItem"
  ADD COLUMN IF NOT EXISTS "important"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "myDayAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes"          TEXT,
  ADD COLUMN IF NOT EXISTS "reminderAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TodoItem_userId_important_idx" ON "TodoItem"("userId", "important");
CREATE INDEX IF NOT EXISTS "TodoItem_userId_myDayAt_idx"   ON "TodoItem"("userId", "myDayAt");
CREATE INDEX IF NOT EXISTS "TodoItem_reminderAt_reminderSentAt_idx" ON "TodoItem"("reminderAt", "reminderSentAt");

CREATE TABLE IF NOT EXISTS "TodoStep" (
  "id"        TEXT PRIMARY KEY,
  "itemId"    TEXT NOT NULL REFERENCES "TodoItem"("id") ON DELETE CASCADE,
  "title"     TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "order"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TodoStep_itemId_order_idx" ON "TodoStep"("itemId", "order");
