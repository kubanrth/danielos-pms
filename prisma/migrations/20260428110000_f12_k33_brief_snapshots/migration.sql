-- F12-K33: dzienne snapshoty Creative Brief'ów. updateBriefAction
-- upsertuje BriefSnapshot keyowany po (briefId, dayKey) — 1 snapshot/dzień.

CREATE TABLE "BriefSnapshot" (
  "id"          TEXT NOT NULL,
  "briefId"     TEXT NOT NULL,
  "dayKey"      TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "contentJson" JSONB,
  "status"      "CreativeBriefStatus" NOT NULL,
  "emoji"       TEXT,
  "headerColor" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BriefSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BriefSnapshot_briefId_dayKey_key" ON "BriefSnapshot"("briefId", "dayKey");
CREATE INDEX "BriefSnapshot_briefId_idx" ON "BriefSnapshot"("briefId");

ALTER TABLE "BriefSnapshot" ADD CONSTRAINT "BriefSnapshot_briefId_fkey"
  FOREIGN KEY ("briefId") REFERENCES "CreativeBrief"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
