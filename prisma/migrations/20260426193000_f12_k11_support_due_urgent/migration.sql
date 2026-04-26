-- F12-K11: support tickets get optional deadline + "NATYCHMIAST" flag.

ALTER TABLE "SupportTicket" ADD COLUMN "dueAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "isUrgent" BOOLEAN NOT NULL DEFAULT false;
