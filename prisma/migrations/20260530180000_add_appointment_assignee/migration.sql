-- Persist the operational owner of an appointment.
ALTER TABLE "Appointment" ADD COLUMN "assignedToPersonId" TEXT;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_assignedToPersonId_fkey"
FOREIGN KEY ("assignedToPersonId") REFERENCES "Person"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Appointment_orgId_assignedToPersonId_startsAt_idx"
ON "Appointment"("orgId", "assignedToPersonId", "startsAt");

-- Capacity is per responsible person, not per organization. Unassigned appointments
-- remain schedulable so they can enter the operational triage queue.
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_no_overlap_per_org";

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_no_overlap_per_responsible"
EXCLUDE USING gist (
  "orgId" WITH =,
  "assignedToPersonId" WITH =,
  tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE (status <> 'CANCELED' AND "assignedToPersonId" IS NOT NULL);
