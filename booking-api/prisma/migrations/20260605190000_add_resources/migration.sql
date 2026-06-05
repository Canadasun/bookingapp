-- Shared bookable resources (rooms/equipment); a service can occupy one.
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Resource_businessId_idx" ON "Resource"("businessId");
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Service" ADD COLUMN "resourceId" TEXT;
CREATE INDEX "Service_resourceId_idx" ON "Service"("resourceId");
ALTER TABLE "Service" ADD CONSTRAINT "Service_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
