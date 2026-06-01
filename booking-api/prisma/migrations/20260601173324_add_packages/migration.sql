-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'VOID');

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceId" TEXT,
    "credits" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "packageId" TEXT,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceId" TEXT,
    "creditsTotal" INTEGER NOT NULL,
    "creditsRemaining" INTEGER NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRedemption" (
    "id" TEXT NOT NULL,
    "clientPackageId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Package_businessId_active_idx" ON "Package"("businessId", "active");

-- CreateIndex
CREATE INDEX "ClientPackage_businessId_status_idx" ON "ClientPackage"("businessId", "status");

-- CreateIndex
CREATE INDEX "ClientPackage_clientId_idx" ON "ClientPackage"("clientId");

-- CreateIndex
CREATE INDEX "PackageRedemption_clientPackageId_idx" ON "PackageRedemption"("clientPackageId");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_clientPackageId_fkey" FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
