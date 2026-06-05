-- Standalone invoices with a per-business sequential number.
ALTER TABLE "Business" ADD COLUMN "invoiceSeq" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Invoice_businessId_idx" ON "Invoice"("businessId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
