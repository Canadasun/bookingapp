-- Stripe → Square migration (additive). Stripe columns are retained until cutover.
ALTER TABLE "Client"       ADD COLUMN IF NOT EXISTS "squareCustomerId" TEXT;
ALTER TABLE "Client"       ADD COLUMN IF NOT EXISTS "squareCardId" TEXT;
ALTER TABLE "Appointment"  ADD COLUMN IF NOT EXISTS "squarePaymentId" TEXT;
ALTER TABLE "Appointment"  ADD COLUMN IF NOT EXISTS "squareCardId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "squareCustomerId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "squareSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "squarePlanVariationId" TEXT;
ALTER TABLE "Payment"      ADD COLUMN IF NOT EXISTS "squarePaymentId" TEXT;
ALTER TABLE "Refund"       ADD COLUMN IF NOT EXISTS "squareRefundId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_squareSubscriptionId_key" ON "Subscription"("squareSubscriptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_squarePaymentId_key" ON "Payment"("squarePaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_squareRefundId_key" ON "Refund"("squareRefundId");

CREATE TABLE IF NOT EXISTS "SquareConnection" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "locationId" TEXT,
  "merchantName" TEXT,
  "scopes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SquareConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SquareConnection_businessId_key" ON "SquareConnection"("businessId");
DO $$ BEGIN
  ALTER TABLE "SquareConnection" ADD CONSTRAINT "SquareConnection_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
