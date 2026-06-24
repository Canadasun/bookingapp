-- Add booking approval mode to Business (AUTO = instant confirm, MANUAL = pending queue)
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "bookingApprovalMode" TEXT NOT NULL DEFAULT 'MANUAL';

-- Add per-business toggle to allow/disable client self-cancel
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "allowClientCancel" BOOLEAN NOT NULL DEFAULT true;

-- Add client blocklist fields
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;
