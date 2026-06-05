-- Recurring service-due tracker (e.g. dog grooming every 8 weeks).
CREATE TABLE "ServiceDue" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "cadenceDays" INTEGER,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceDue_businessId_idx" ON "ServiceDue"("businessId");
CREATE INDEX "ServiceDue_clientId_idx" ON "ServiceDue"("clientId");
CREATE INDEX "ServiceDue_status_dueAt_idx" ON "ServiceDue"("status", "dueAt");

ALTER TABLE "ServiceDue" ADD CONSTRAINT "ServiceDue_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDue" ADD CONSTRAINT "ServiceDue_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDue" ADD CONSTRAINT "ServiceDue_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
