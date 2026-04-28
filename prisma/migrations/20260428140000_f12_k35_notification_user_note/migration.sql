-- F12-K35: notatka usera doklejona do notyfikacji w inbox'ie. Treść
-- powiadomienia jest auto-generowana z payloadu; user może dopisać
-- własną adnotację.

ALTER TABLE "Notification" ADD COLUMN "userNote" TEXT;
