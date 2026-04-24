-- F9-07: custom user-defined columns in the Tabela view.
-- TableColumn = per-board column definition (name + type).
-- TaskCustomValue = (task, column) → string value, one row per cell.

CREATE TABLE IF NOT EXISTS "TableColumn" (
  "id"        TEXT PRIMARY KEY,
  "boardId"   TEXT NOT NULL REFERENCES "Board"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'TEXT',
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TableColumn_boardId_order_idx" ON "TableColumn"("boardId","order");

CREATE TABLE IF NOT EXISTS "TaskCustomValue" (
  "taskId"    TEXT NOT NULL REFERENCES "Task"("id")       ON DELETE CASCADE,
  "columnId"  TEXT NOT NULL REFERENCES "TableColumn"("id") ON DELETE CASCADE,
  "valueText" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("taskId","columnId")
);
CREATE INDEX IF NOT EXISTS "TaskCustomValue_columnId_idx" ON "TaskCustomValue"("columnId");
