-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "stripePaymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "stripeCustomerId" TEXT;
