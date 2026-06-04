-- Business verification: upload a registration doc → admin approves.
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "Business" ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "Business" ADD COLUMN "verificationDocUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "verificationNote" TEXT;
ALTER TABLE "Business" ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "verifiedAt" TIMESTAMP(3);
