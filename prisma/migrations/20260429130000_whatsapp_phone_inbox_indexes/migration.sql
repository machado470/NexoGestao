-- Harden WhatsApp inbox query and phone lookup indexes
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_phone_idx" ON "WhatsAppConversation"("orgId", "phone");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_customerId_lastMessageAt_idx" ON "WhatsAppConversation"("orgId", "customerId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_priority_lastMessageAt_idx" ON "WhatsAppConversation"("orgId", "priority", "lastMessageAt");
