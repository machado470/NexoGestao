-- Preserve historical types, defaults, keys and index names; add only the missing query indexes.
BEGIN;
CREATE INDEX "OperationalActionExecution_orgId_actionType_entityType_enti_idx"
  ON "OperationalActionExecution"("orgId", "actionType", "entityType", "entityId", "sourceSignalId", "createdAt");
CREATE INDEX "WhatsAppMessage_orgId_status_createdAt_idx"
  ON "WhatsAppMessage"("orgId", "status", "createdAt");
COMMIT;
