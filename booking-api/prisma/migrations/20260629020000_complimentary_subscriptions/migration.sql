ALTER TABLE "Business"
  ADD COLUMN "complimentaryPlanExpiresAt" TIMESTAMP(3),
  ADD COLUMN "complimentaryPreviousPlan" "PlanTier";

CREATE INDEX "Business_complimentaryPlanExpiresAt_idx"
  ON "Business" ("complimentaryPlanExpiresAt");
