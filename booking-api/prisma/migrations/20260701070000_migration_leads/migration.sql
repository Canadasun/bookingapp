-- Public "concierge migration" leads from the marketing site (/migrate). Not
-- tied to a Business (prospects have no account yet), unlike MigrationRequest.
CREATE TABLE "MigrationLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MigrationLead_status_createdAt_idx" ON "MigrationLead"("status", "createdAt");
