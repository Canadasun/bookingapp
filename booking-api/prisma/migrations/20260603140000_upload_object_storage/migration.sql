-- Object-storage support for uploads: bytes can live in S3/R2 (storageKey) instead
-- of in the DB (data), so `data` becomes optional and we add the key column.
ALTER TABLE "UploadedFile" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "UploadedFile" ADD COLUMN "storageKey" TEXT;
