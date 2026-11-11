-- Shared monthly message admission counts only outbound records for one tenant.
CREATE INDEX "WhatsAppMessage_orgId_direction_createdAt_idx"
  ON "WhatsAppMessage"("orgId", "direction", "createdAt");
