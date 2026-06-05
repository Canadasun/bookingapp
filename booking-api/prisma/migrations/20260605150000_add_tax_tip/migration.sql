-- Sales tax rate on the business; tip + tax breakdown recorded on payments.
ALTER TABLE "Business" ADD COLUMN "taxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "tipCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0;
