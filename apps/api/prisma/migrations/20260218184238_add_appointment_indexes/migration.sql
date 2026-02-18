-- CreateIndex
CREATE INDEX "Appointment_orgId_startsAt_endsAt_idx" ON "Appointment"("orgId", "startsAt", "endsAt");
