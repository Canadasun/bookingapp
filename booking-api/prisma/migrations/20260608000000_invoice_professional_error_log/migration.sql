-- Add taxNumber to Business (for invoices)
ALTER TABLE "Business"
  ADD COLUMN "taxNumber" TEXT;

-- Add professional invoice fields
ALTER TABLE "Invoice"
  ADD COLUMN "discountCents"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountLabel"  TEXT,
  ADD COLUMN "paymentTerms"   TEXT,
  ADD COLUMN "poNumber"       TEXT,
  ADD COLUMN "billingAddress" TEXT;

-- System error log (platform + per-business errors)
CREATE TABLE "SystemError" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT,
  "category"   TEXT NOT NULL,
  "severity"   TEXT NOT NULL DEFAULT 'ERROR',
  "message"    TEXT NOT NULL,
  "stack"      TEXT,
  "context"    JSONB NOT NULL DEFAULT '{}',
  "resolved"   BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemError_businessId_idx" ON "SystemError"("businessId");
CREATE INDEX "SystemError_category_idx"   ON "SystemError"("category");
CREATE INDEX "SystemError_resolved_idx"   ON "SystemError"("resolved");
CREATE INDEX "SystemError_createdAt_idx"  ON "SystemError"("createdAt");
