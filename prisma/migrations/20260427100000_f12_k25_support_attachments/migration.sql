-- F12-K25: SupportTicketAttachment table.

CREATE TABLE "SupportTicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketAttachment_ticketId_idx" ON "SupportTicketAttachment"("ticketId");

ALTER TABLE "SupportTicketAttachment"
    ADD CONSTRAINT "SupportTicketAttachment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicketAttachment"
    ADD CONSTRAINT "SupportTicketAttachment_uploaderId_fkey"
    FOREIGN KEY ("uploaderId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
