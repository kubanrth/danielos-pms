-- F11-21 (#25): Creative briefs — structured project documents per workspace.

CREATE TYPE "CreativeBriefStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

CREATE TABLE "CreativeBrief" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "creatorId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "contentJson" JSONB,
  "status"      "CreativeBriefStatus" NOT NULL DEFAULT 'DRAFT',
  "emoji"       TEXT,
  "headerColor" TEXT DEFAULT '#7B68EE',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),

  CONSTRAINT "CreativeBrief_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreativeBrief_workspaceId_deletedAt_idx"
  ON "CreativeBrief"("workspaceId", "deletedAt");
CREATE INDEX "CreativeBrief_creatorId_idx" ON "CreativeBrief"("creatorId");

ALTER TABLE "CreativeBrief"
  ADD CONSTRAINT "CreativeBrief_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreativeBrief"
  ADD CONSTRAINT "CreativeBrief_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
