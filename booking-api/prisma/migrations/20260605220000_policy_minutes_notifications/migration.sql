ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "notificationSettings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "maxAdvanceMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "cancellationWindowMinutes" INTEGER;

UPDATE "Business"
SET
  "maxAdvanceMinutes" = COALESCE("maxAdvanceMinutes", "maxAdvanceDays" * 24 * 60),
  "cancellationWindowMinutes" = COALESCE("cancellationWindowMinutes", "cancellationWindowHours" * 60);

ALTER TABLE "Business"
  ALTER COLUMN "maxAdvanceMinutes" SET DEFAULT 86400,
  ALTER COLUMN "maxAdvanceMinutes" SET NOT NULL,
  ALTER COLUMN "cancellationWindowMinutes" SET DEFAULT 1440,
  ALTER COLUMN "cancellationWindowMinutes" SET NOT NULL;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "totalPriceCents" INTEGER;

UPDATE "Appointment" a
SET "totalPriceCents" = COALESCE(a."totalPriceCents", s."priceCents", 0)
FROM "Service" s
WHERE a."serviceId" = s."id";

ALTER TABLE "Appointment"
  ALTER COLUMN "totalPriceCents" SET DEFAULT 0,
  ALTER COLUMN "totalPriceCents" SET NOT NULL;
