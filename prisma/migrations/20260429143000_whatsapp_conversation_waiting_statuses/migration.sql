-- Add operational waiting statuses for WhatsApp conversations while keeping existing enum values.
ALTER TYPE "WhatsAppConversationStatus" ADD VALUE IF NOT EXISTS 'WAITING_CUSTOMER';
ALTER TYPE "WhatsAppConversationStatus" ADD VALUE IF NOT EXISTS 'WAITING_OPERATOR';
