-- A provider can work at multiple branches. StaffLocation is the source of truth
-- for "which locations a staff member serves"; Staff.locationId stays the
-- primary/home branch (default timezone, single-location fallback).
CREATE TABLE "StaffLocation" (
    "staffId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "StaffLocation_pkey" PRIMARY KEY ("staffId", "locationId")
);

CREATE INDEX "StaffLocation_locationId_idx" ON "StaffLocation"("locationId");

ALTER TABLE "StaffLocation" ADD CONSTRAINT "StaffLocation_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLocation" ADD CONSTRAINT "StaffLocation_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every provider currently pinned to a single branch keeps serving it.
-- Single-location businesses (locationId NULL) get no rows and continue to use
-- the NULL-location fallback paths unchanged.
INSERT INTO "StaffLocation" ("staffId", "locationId")
SELECT "id", "locationId" FROM "Staff" WHERE "locationId" IS NOT NULL
ON CONFLICT DO NOTHING;
