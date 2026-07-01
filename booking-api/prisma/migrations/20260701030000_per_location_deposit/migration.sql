-- Per-location deposit policy: a branch can require (or waive) a deposit and set
-- its own percentage. NULL falls back to the business-level deposit settings.
ALTER TABLE "Location" ADD COLUMN "requireDeposit" BOOLEAN;
ALTER TABLE "Location" ADD COLUMN "depositPercent" INTEGER;
