-- Intake/consultation forms: owner-defined questions on the business, answers per appointment.
ALTER TABLE "Business" ADD COLUMN "intakeQuestions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Appointment" ADD COLUMN "intakeAnswers" JSONB;
