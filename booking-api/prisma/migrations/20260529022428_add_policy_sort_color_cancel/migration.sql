-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "allowClientReschedule" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "depositPercent" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "minNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "noShowFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requireDeposit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#6366f1',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;
