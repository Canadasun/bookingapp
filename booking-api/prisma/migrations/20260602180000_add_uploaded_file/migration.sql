-- In-DB image uploads (logos, avatars, covers).
CREATE TYPE "UploadKind" AS ENUM ('LOGO', 'AVATAR', 'COVER', 'OTHER');

CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "UploadKind" NOT NULL DEFAULT 'OTHER',
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UploadedFile_businessId_idx" ON "UploadedFile"("businessId");

ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
