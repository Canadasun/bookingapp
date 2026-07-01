-- Optional branch-level cancellation policy overrides. NULL values inherit the
-- business-level cancellation window and policy copy.
ALTER TABLE "Location" ADD COLUMN "cancellationWindowMinutes" INTEGER;
ALTER TABLE "Location" ADD COLUMN "cancellationPolicy" TEXT;
