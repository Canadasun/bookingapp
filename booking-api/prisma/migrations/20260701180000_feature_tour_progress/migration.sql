CREATE TABLE "FeatureTourProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "tourKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureTourProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureTourProgress_userId_businessId_tourKey_version_key"
ON "FeatureTourProgress"("userId", "businessId", "tourKey", "version");

CREATE INDEX "FeatureTourProgress_businessId_tourKey_status_idx"
ON "FeatureTourProgress"("businessId", "tourKey", "status");

ALTER TABLE "FeatureTourProgress"
ADD CONSTRAINT "FeatureTourProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeatureTourProgress"
ADD CONSTRAINT "FeatureTourProgress_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
