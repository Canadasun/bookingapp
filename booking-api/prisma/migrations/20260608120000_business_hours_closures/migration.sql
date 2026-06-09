-- Add UNLIMITED to PlanTier enum
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'UNLIMITED';

-- BusinessHours: business-level operating schedule (sole-proprietor default)
CREATE TABLE "BusinessHours" (
    "id"         TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dayOfWeek"  INTEGER NOT NULL,
    "startTime"  TEXT NOT NULL,
    "endTime"    TEXT NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessHours_businessId_dayOfWeek_key" ON "BusinessHours"("businessId", "dayOfWeek");
CREATE INDEX "BusinessHours_businessId_idx" ON "BusinessHours"("businessId");

ALTER TABLE "BusinessHours"
    ADD CONSTRAINT "BusinessHours_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BusinessClosure: date-range blocks (holidays, vacations)
CREATE TABLE "BusinessClosure" (
    "id"         TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "startsAt"   TIMESTAMP(3) NOT NULL,
    "endsAt"     TIMESTAMP(3) NOT NULL,
    "reason"     TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessClosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessClosure_businessId_idx" ON "BusinessClosure"("businessId");
CREATE INDEX "BusinessClosure_startsAt_endsAt_idx" ON "BusinessClosure"("startsAt", "endsAt");

ALTER TABLE "BusinessClosure"
    ADD CONSTRAINT "BusinessClosure_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
