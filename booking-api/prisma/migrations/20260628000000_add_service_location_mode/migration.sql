-- Per-service delivery mode + optional default virtual meeting link.
ALTER TABLE "Service" ADD COLUMN "locationMode" TEXT NOT NULL DEFAULT 'IN_PERSON';
ALTER TABLE "Service" ADD COLUMN "virtualMeetingUrl" TEXT;

-- Per-appointment snapshot of the mode at booking time, the virtual link, and
-- the customer's address for at-customer (mobile) appointments.
ALTER TABLE "Appointment" ADD COLUMN "locationMode" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "meetingUrl" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "customerAddress" TEXT;
