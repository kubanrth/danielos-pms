-- F9-15: Notatnik — private per-user Apple-Notes-style module.

CREATE TABLE IF NOT EXISTS "NoteFolder" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "order"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NoteFolder_userId_order_idx" ON "NoteFolder"("userId","order");

CREATE TABLE IF NOT EXISTS "Note" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "folderId"  TEXT REFERENCES "NoteFolder"("id") ON DELETE SET NULL,
  "title"     TEXT NOT NULL DEFAULT 'Nowa notatka',
  "content"   TEXT NOT NULL DEFAULT '',
  "pinned"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Note_userId_updatedAt_idx" ON "Note"("userId","updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Note_folderId_idx" ON "Note"("folderId");
