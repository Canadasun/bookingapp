-- Per-branch service override: enable/disable a service at a branch and/or set a
-- branch-specific price. No row = offered at the base price (backward compatible).
CREATE TABLE "LocationService" (
    "locationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priceCents" INTEGER,

    CONSTRAINT "LocationService_pkey" PRIMARY KEY ("locationId", "serviceId")
);

CREATE INDEX "LocationService_serviceId_idx" ON "LocationService"("serviceId");

ALTER TABLE "LocationService" ADD CONSTRAINT "LocationService_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationService" ADD CONSTRAINT "LocationService_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
