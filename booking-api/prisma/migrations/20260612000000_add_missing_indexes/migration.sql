-- AddIndex: Appointment(businessId, status) — speeds up filtered appointment queries
CREATE INDEX "Appointment_businessId_status_idx" ON "Appointment"("businessId", "status");

-- AddIndex: OtpChallenge(expiresAt) — speeds up pruning of expired OTP challenges
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");
