-- F11-22 (#22): workspace-level calendar events.

CREATE TABLE "WorkspaceEvent" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "creatorId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "startAt"     TIMESTAMP(3) NOT NULL,
  "endAt"       TIMESTAMP(3) NOT NULL,
  "allDay"      BOOLEAN NOT NULL DEFAULT false,
  "color"       TEXT NOT NULL DEFAULT '#7B68EE',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),

  CONSTRAINT "WorkspaceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceEvent_workspaceId_deletedAt_idx"
  ON "WorkspaceEvent"("workspaceId", "deletedAt");
CREATE INDEX "WorkspaceEvent_startAt_idx" ON "WorkspaceEvent"("startAt");

ALTER TABLE "WorkspaceEvent"
  ADD CONSTRAINT "WorkspaceEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceEvent"
  ADD CONSTRAINT "WorkspaceEvent_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
