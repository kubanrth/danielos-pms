-- F9-12: "Folder linków" with user-defined column tables.
-- Four new tables. Original BoardLink stays (old chips keep working).

CREATE TABLE IF NOT EXISTS "LinkFolder" (
  "id"        TEXT PRIMARY KEY,
  "boardId"   TEXT NOT NULL REFERENCES "Board"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LinkFolder_boardId_order_idx" ON "LinkFolder"("boardId","order");

CREATE TABLE IF NOT EXISTS "LinkFolderColumn" (
  "id"        TEXT PRIMARY KEY,
  "folderId"  TEXT NOT NULL REFERENCES "LinkFolder"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LinkFolderColumn_folderId_order_idx" ON "LinkFolderColumn"("folderId","order");

CREATE TABLE IF NOT EXISTS "LinkFolderRow" (
  "id"        TEXT PRIMARY KEY,
  "folderId"  TEXT NOT NULL REFERENCES "LinkFolder"("id") ON DELETE CASCADE,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LinkFolderRow_folderId_order_idx" ON "LinkFolderRow"("folderId","order");

CREATE TABLE IF NOT EXISTS "LinkFolderCellValue" (
  "rowId"     TEXT NOT NULL REFERENCES "LinkFolderRow"("id")    ON DELETE CASCADE,
  "columnId"  TEXT NOT NULL REFERENCES "LinkFolderColumn"("id") ON DELETE CASCADE,
  "valueText" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("rowId","columnId")
);
CREATE INDEX IF NOT EXISTS "LinkFolderCellValue_columnId_idx" ON "LinkFolderCellValue"("columnId");
