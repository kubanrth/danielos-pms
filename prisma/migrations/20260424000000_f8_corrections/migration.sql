-- F8: druga runda poprawek
-- Zmiany: enabledViews na Workspace, rozszerzony ViewType, BoardLink,
-- Subtask, Poll (3 tabele), TodoFolder/List/Item, WikiPage, reminders
-- na Task, FirefliesIntegration, per-board canvas.
-- Safe to apply on Supabase (all additive / nullable / default-backed).

-- === Workspace.enabledViews ===
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "enabledViews" JSONB NOT NULL DEFAULT '["TABLE","KANBAN","ROADMAP","GANTT","WHITEBOARD"]'::jsonb;

-- === Extend ViewType enum ===
-- Postgres doesn't allow removing a UNIQUE in the same txn as adding enum
-- values; run them sequentially.
ALTER TYPE "ViewType" ADD VALUE IF NOT EXISTS 'GANTT';
ALTER TYPE "ViewType" ADD VALUE IF NOT EXISTS 'WHITEBOARD';

-- === BoardView: add name, drop unique(boardId,type) ===
ALTER TABLE "BoardView" ADD COLUMN IF NOT EXISTS "name" TEXT;
DO $$ BEGIN
  ALTER TABLE "BoardView" DROP CONSTRAINT IF EXISTS "BoardView_boardId_type_key";
EXCEPTION WHEN others THEN NULL;
END $$;
DROP INDEX IF EXISTS "BoardView_boardId_type_key";
CREATE INDEX IF NOT EXISTS "BoardView_boardId_type_idx" ON "BoardView"("boardId","type");

-- === BoardLinkKind enum + BoardLink table ===
DO $$ BEGIN
  CREATE TYPE "BoardLinkKind" AS ENUM ('DRIVE','SHEETS','DOCS','SLIDES','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BoardLink" (
  "id"         TEXT PRIMARY KEY,
  "boardId"    TEXT NOT NULL REFERENCES "Board"("id") ON DELETE CASCADE,
  "kind"       "BoardLinkKind" NOT NULL,
  "url"        TEXT NOT NULL,
  "label"      TEXT,
  "order"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BoardLink_boardId_order_idx" ON "BoardLink"("boardId","order");

-- === Task: reminderAt, reminderSentAt ===
ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "reminderAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Task_reminderAt_reminderSentAt_idx" ON "Task"("reminderAt","reminderSentAt");

-- === Subtask ===
CREATE TABLE IF NOT EXISTS "Subtask" (
  "id"         TEXT PRIMARY KEY,
  "taskId"     TEXT NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
  "title"      TEXT NOT NULL,
  "completed"  BOOLEAN NOT NULL DEFAULT false,
  "order"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Subtask_taskId_order_idx" ON "Subtask"("taskId","order");

-- === Poll (3 tables) ===
CREATE TABLE IF NOT EXISTS "TaskPoll" (
  "id"         TEXT PRIMARY KEY,
  "taskId"     TEXT NOT NULL UNIQUE REFERENCES "Task"("id") ON DELETE CASCADE,
  "question"   TEXT NOT NULL,
  "authorId"   TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"   TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "TaskPoll_taskId_idx" ON "TaskPoll"("taskId");

CREATE TABLE IF NOT EXISTS "TaskPollOption" (
  "id"     TEXT PRIMARY KEY,
  "pollId" TEXT NOT NULL REFERENCES "TaskPoll"("id") ON DELETE CASCADE,
  "label"  TEXT NOT NULL,
  "order"  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "TaskPollOption_pollId_order_idx" ON "TaskPollOption"("pollId","order");

CREATE TABLE IF NOT EXISTS "TaskPollVote" (
  "pollId"    TEXT NOT NULL REFERENCES "TaskPoll"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "optionId"  TEXT NOT NULL REFERENCES "TaskPollOption"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("pollId","userId")
);
CREATE INDEX IF NOT EXISTS "TaskPollVote_optionId_idx" ON "TaskPollVote"("optionId");
CREATE INDEX IF NOT EXISTS "TaskPollVote_userId_idx" ON "TaskPollVote"("userId");

-- === ProcessCanvas: nullable boardId for per-board whiteboard ===
ALTER TABLE "ProcessCanvas" ADD COLUMN IF NOT EXISTS "boardId" TEXT;
DO $$ BEGIN
  ALTER TABLE "ProcessCanvas"
    ADD CONSTRAINT "ProcessCanvas_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE;
EXCEPTION WHEN others THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessCanvas_boardId_key" ON "ProcessCanvas"("boardId");

-- === TODO (private per-user) ===
CREATE TABLE IF NOT EXISTS "TodoFolder" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "parentId"   TEXT REFERENCES "TodoFolder"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "order"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TodoFolder_userId_parentId_order_idx" ON "TodoFolder"("userId","parentId","order");

CREATE TABLE IF NOT EXISTS "TodoList" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "folderId"   TEXT REFERENCES "TodoFolder"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "order"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TodoList_userId_folderId_order_idx" ON "TodoList"("userId","folderId","order");

CREATE TABLE IF NOT EXISTS "TodoItem" (
  "id"         TEXT PRIMARY KEY,
  "listId"     TEXT NOT NULL REFERENCES "TodoList"("id") ON DELETE CASCADE,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "content"    TEXT NOT NULL,
  "completed"  BOOLEAN NOT NULL DEFAULT false,
  "dueDate"    TIMESTAMP(3),
  "order"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TodoItem_listId_order_idx" ON "TodoItem"("listId","order");
CREATE INDEX IF NOT EXISTS "TodoItem_userId_dueDate_idx" ON "TodoItem"("userId","dueDate");

-- === WikiPage (1 per workspace) ===
CREATE TABLE IF NOT EXISTS "WikiPage" (
  "id"           TEXT PRIMARY KEY,
  "workspaceId"  TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "title"        TEXT NOT NULL DEFAULT 'O projekcie',
  "contentJson"  JSONB,
  "updatedById"  TEXT REFERENCES "User"("id"),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- === FireFlies integration ===
CREATE TABLE IF NOT EXISTS "FirefliesIntegration" (
  "id"             TEXT PRIMARY KEY,
  "workspaceId"    TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "apiKey"         TEXT NOT NULL,
  "webhookSecret"  TEXT NOT NULL,
  "defaultBoardId" TEXT,
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- === Backfill: ensure every existing workspace has a WikiPage ===
INSERT INTO "WikiPage" ("id","workspaceId","title","contentJson","createdAt","updatedAt")
SELECT
  'cuid_' || substr(md5(w."id" || '-wiki'), 1, 24),
  w."id",
  'O projekcie',
  jsonb_build_object(
    'type','doc',
    'content', jsonb_build_array(
      jsonb_build_object(
        'type','heading',
        'attrs', jsonb_build_object('level', 1),
        'content', jsonb_build_array(jsonb_build_object('type','text','text', w."name"))
      ),
      jsonb_build_object(
        'type','paragraph',
        'content', jsonb_build_array(jsonb_build_object('type','text','text','Opisz tutaj cel projektu, kluczowych ludzi, kamienie milowe i wszystko, co powinno być pod ręką.'))
      )
    )
  ),
  NOW(), NOW()
FROM "Workspace" w
WHERE w."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "WikiPage" wp WHERE wp."workspaceId" = w."id");
