-- F11-20 (#23): support tickets — internal helpdesk.

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "SupportTicket" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "reporterId"  TEXT NOT NULL,
  "assigneeId"  TEXT,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status"      "SupportTicketStatus"   NOT NULL DEFAULT 'OPEN',
  "priority"    "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "resolvedAt"  TIMESTAMP(3),

  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_workspaceId_status_idx" ON "SupportTicket"("workspaceId", "status");
CREATE INDEX "SupportTicket_reporterId_idx" ON "SupportTicket"("reporterId");

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
