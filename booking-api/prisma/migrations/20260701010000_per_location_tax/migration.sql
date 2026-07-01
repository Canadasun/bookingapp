-- Per-location Canadian tax: a branch collects its own province's rate. NULL
-- falls back to the business-level tax, so single-province businesses are
-- unchanged.
ALTER TABLE "Location" ADD COLUMN "taxProvince" TEXT;
ALTER TABLE "Location" ADD COLUMN "taxRatePercent" DOUBLE PRECISION;

-- Invoices remember which branch they were issued for so the applied tax rate
-- (and later per-location tax reports) is correct.
ALTER TABLE "Invoice" ADD COLUMN "locationId" TEXT;
CREATE INDEX "Invoice_locationId_idx" ON "Invoice"("locationId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Canadian-first default for new businesses (America/New_York and America/Toronto
-- are the same Eastern offset/DST; existing rows are left untouched).
ALTER TABLE "Business" ALTER COLUMN "timezone" SET DEFAULT 'America/Toronto';
