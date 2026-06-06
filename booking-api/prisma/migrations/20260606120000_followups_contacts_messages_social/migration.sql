ALTER TABLE "Business"
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "facebookUrl" TEXT,
  ADD COLUMN "tiktokUrl" TEXT,
  ADD COLUMN "postVisitMessage" TEXT;

ALTER TABLE "Client" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "NotificationDelivery" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "NotificationDelivery_dedupeKey_key" ON "NotificationDelivery"("dedupeKey");

CREATE TABLE "FollowUpPolicy" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "serviceId" TEXT,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL DEFAULT 'COMPLETED',
  "delayDays" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FollowUpPolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FollowUpPolicy_businessId_enabled_idx" ON "FollowUpPolicy"("businessId", "enabled");
CREATE INDEX "FollowUpPolicy_serviceId_idx" ON "FollowUpPolicy"("serviceId");
ALTER TABLE "FollowUpPolicy" ADD CONSTRAINT "FollowUpPolicy_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUpPolicy" ADD CONSTRAINT "FollowUpPolicy_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceDue"
  ADD COLUMN "policyId" TEXT,
  ADD COLUMN "messageSubject" TEXT,
  ADD COLUMN "messageBody" TEXT;
ALTER TABLE "ServiceDue" ADD CONSTRAINT "ServiceDue_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "FollowUpPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MessageThreadState" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageThreadState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MessageThreadState_businessId_clientId_userId_key" ON "MessageThreadState"("businessId", "clientId", "userId");
CREATE INDEX "MessageThreadState_businessId_userId_archivedAt_idx" ON "MessageThreadState"("businessId", "userId", "archivedAt");
ALTER TABLE "MessageThreadState" ADD CONSTRAINT "MessageThreadState_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageThreadState" ADD CONSTRAINT "MessageThreadState_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageThreadState" ADD CONSTRAINT "MessageThreadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
