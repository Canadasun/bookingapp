-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "staffId" TEXT,
    "clientName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");

-- CreateIndex
CREATE INDEX "Review_businessId_published_idx" ON "Review"("businessId", "published");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
