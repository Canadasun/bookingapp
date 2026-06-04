-- Referral program: shareable per-business code + referral tracking.
ALTER TABLE "Business" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "Business_referralCode_key" ON "Business"("referralCode");

CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'REWARDED');

CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referrerBusinessId" TEXT NOT NULL,
    "referredBusinessId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardedAt" TIMESTAMP(3),
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_referredBusinessId_key" ON "Referral"("referredBusinessId");
CREATE INDEX "Referral_referrerBusinessId_idx" ON "Referral"("referrerBusinessId");

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerBusinessId_fkey" FOREIGN KEY ("referrerBusinessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredBusinessId_fkey" FOREIGN KEY ("referredBusinessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
