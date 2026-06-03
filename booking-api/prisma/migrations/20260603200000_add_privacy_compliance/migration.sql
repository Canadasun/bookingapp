-- Privacy and Canadian compliance support.
-- Records explicit consent separately from the user row and provides a tracked
-- erasure/anonymization request workflow for support/ops processing.

CREATE TYPE "PrivacyConsentType" AS ENUM ('TERMS', 'PRIVACY_POLICY', 'MARKETING', 'TRACKING');
CREATE TYPE "DataErasureStatus" AS ENUM ('REQUESTED', 'VERIFYING', 'PROCESSING', 'COMPLETED', 'REJECTED');

CREATE TABLE "PrivacyConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessId" TEXT,
  "type" "PrivacyConsentType" NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "version" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'registration',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PrivacyConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataErasureRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessId" TEXT,
  "status" "DataErasureStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,

  CONSTRAINT "DataErasureRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivacyConsent_userId_type_createdAt_idx" ON "PrivacyConsent"("userId", "type", "createdAt");
CREATE INDEX "PrivacyConsent_businessId_type_createdAt_idx" ON "PrivacyConsent"("businessId", "type", "createdAt");
CREATE INDEX "DataErasureRequest_userId_status_idx" ON "DataErasureRequest"("userId", "status");
CREATE INDEX "DataErasureRequest_businessId_status_idx" ON "DataErasureRequest"("businessId", "status");
CREATE INDEX "DataErasureRequest_requestedAt_idx" ON "DataErasureRequest"("requestedAt");

ALTER TABLE "PrivacyConsent" ADD CONSTRAINT "PrivacyConsent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrivacyConsent" ADD CONSTRAINT "PrivacyConsent_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DataErasureRequest" ADD CONSTRAINT "DataErasureRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DataErasureRequest" ADD CONSTRAINT "DataErasureRequest_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
