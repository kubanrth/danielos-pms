-- F12-K34: dzienne snapshoty całego workspace'u. Cron-driven JSON dump
-- wszystkich workspace-scoped tabel; storageKey wskazuje plik w Supabase
-- Storage. Ten model jest tylko indexem (modelCounts = quick-stats).

CREATE TABLE "WorkspaceBackup" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "dayKey"      TEXT NOT NULL,
  "storageKey"  TEXT NOT NULL,
  "sizeBytes"   INTEGER NOT NULL,
  "modelCounts" JSONB NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceBackup_workspaceId_dayKey_key"
  ON "WorkspaceBackup"("workspaceId", "dayKey");

CREATE INDEX "WorkspaceBackup_workspaceId_createdAt_idx"
  ON "WorkspaceBackup"("workspaceId", "createdAt" DESC);

ALTER TABLE "WorkspaceBackup" ADD CONSTRAINT "WorkspaceBackup_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
