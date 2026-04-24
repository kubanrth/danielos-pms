-- F9-16: Personal reminders — user creates a reminder, assigns it to
-- someone (or themselves), it pops up for that person at dueAt.

CREATE TABLE IF NOT EXISTS "PersonalReminder" (
  "id"          TEXT PRIMARY KEY,
  "creatorId"   TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "recipientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title"       TEXT NOT NULL,
  "body"        TEXT,
  "dueAt"       TIMESTAMP(3) NOT NULL,
  "dismissedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PersonalReminder_recipientId_dismissedAt_dueAt_idx"
  ON "PersonalReminder"("recipientId","dismissedAt","dueAt");
CREATE INDEX IF NOT EXISTS "PersonalReminder_creatorId_idx"
  ON "PersonalReminder"("creatorId");
