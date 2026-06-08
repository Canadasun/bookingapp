-- AlterTable: add Stripe Connect Express fields to Business
ALTER TABLE "Business"
  ADD COLUMN "stripeConnectAccountId" TEXT,
  ADD COLUMN "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false;
