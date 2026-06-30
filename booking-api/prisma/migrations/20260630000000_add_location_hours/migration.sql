-- Branch-specific schedules. NULL preserves the existing business-wide fallback.
ALTER TABLE "BusinessHours" ADD COLUMN "locationId" TEXT;
ALTER TABLE "BusinessClosure" ADD COLUMN "locationId" TEXT;
ALTER TABLE "WaitlistEntry" ADD COLUMN "locationId" TEXT;

ALTER TABLE "BusinessHours" DROP CONSTRAINT IF EXISTS "BusinessHours_businessId_dayOfWeek_key";
CREATE UNIQUE INDEX "BusinessHours_businessId_locationId_dayOfWeek_key"
  ON "BusinessHours"("businessId", "locationId", "dayOfWeek");
CREATE INDEX "BusinessHours_locationId_idx" ON "BusinessHours"("locationId");
CREATE INDEX "BusinessClosure_locationId_idx" ON "BusinessClosure"("locationId");
CREATE INDEX "WaitlistEntry_locationId_idx" ON "WaitlistEntry"("locationId");

ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessClosure" ADD CONSTRAINT "BusinessClosure_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
