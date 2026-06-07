-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "duplicateReviewedAt" TIMESTAMP(3),
ADD COLUMN     "suspectedDuplicateOfId" TEXT;
