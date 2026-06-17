-- Add opt-out flag to Client so one-click unsubscribe from campaign emails
-- is persisted and respected on the next campaign send.
ALTER TABLE "Client" ADD COLUMN "marketingOptOut" BOOLEAN NOT NULL DEFAULT false;
