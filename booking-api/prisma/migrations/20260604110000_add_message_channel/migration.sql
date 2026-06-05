-- Track how a message arrived/was sent (in-app vs SMS) so 2-way texting works.
ALTER TABLE "Message" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'IN_APP';
