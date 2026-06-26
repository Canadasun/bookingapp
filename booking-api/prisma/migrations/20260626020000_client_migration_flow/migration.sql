CREATE TABLE "MigrationRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SELF_SERVICE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approximateSize" INTEGER,
    "requestedHelp" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MigrationImportBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestId" TEXT,
    "sourcePlatform" TEXT NOT NULL,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MigrationImportRow" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "raw" JSONB NOT NULL,
    "normalized" JSONB NOT NULL DEFAULT '{}',
    "errors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "duplicateClientId" TEXT,
    "importedClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationImportRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MigrationRequest_businessId_status_idx" ON "MigrationRequest"("businessId", "status");
CREATE INDEX "MigrationRequest_sourcePlatform_idx" ON "MigrationRequest"("sourcePlatform");
CREATE INDEX "MigrationImportBatch_businessId_status_idx" ON "MigrationImportBatch"("businessId", "status");
CREATE INDEX "MigrationImportBatch_requestId_idx" ON "MigrationImportBatch"("requestId");
CREATE INDEX "MigrationImportRow_businessId_status_idx" ON "MigrationImportRow"("businessId", "status");
CREATE INDEX "MigrationImportRow_batchId_idx" ON "MigrationImportRow"("batchId");
CREATE INDEX "MigrationImportRow_duplicateClientId_idx" ON "MigrationImportRow"("duplicateClientId");

ALTER TABLE "MigrationRequest" ADD CONSTRAINT "MigrationRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MigrationImportBatch" ADD CONSTRAINT "MigrationImportBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MigrationImportBatch" ADD CONSTRAINT "MigrationImportBatch_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MigrationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MigrationImportRow" ADD CONSTRAINT "MigrationImportRow_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MigrationImportRow" ADD CONSTRAINT "MigrationImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MigrationImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MigrationImportRow" ADD CONSTRAINT "MigrationImportRow_duplicateClientId_fkey" FOREIGN KEY ("duplicateClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
