-- Link occurrences of a recurring appointment series via a shared group id.
ALTER TABLE "Appointment" ADD COLUMN "recurringGroupId" TEXT;
CREATE INDEX "Appointment_recurringGroupId_idx" ON "Appointment"("recurringGroupId");
