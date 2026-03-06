import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

/**
 * Contact router (placeholder).
 * O portal antigo salvava contatos no DB local.
 * Futuro: enviar via backend Nest ou serviço externo.
 */

const customerIdSchema = z.string().uuid().or(z.string().min(1));

export const contactRouter = router({
  status: protectedProcedure.query(async () => ({
    ok: true,
    message: "Contact router placeholder",
  })),

  getContactHistory: protectedProcedure
    .input(z.object({ customerId: customerIdSchema }))
    .query(async () => {
      return [] as Array<{
        id: string;
        customerId: string;
        contactType: "phone" | "email" | "whatsapp" | "in_person" | "other";
        subject: string;
        description?: string;
        notes?: string;
        contactedBy?: string;
        createdAt: string;
      }>;
    }),

  createContactHistory: protectedProcedure
    .input(
      z.object({
        customerId: customerIdSchema,
        contactType: z.enum(["phone", "email", "whatsapp", "in_person", "other"]),
        subject: z.string().min(1),
        description: z.string().optional(),
        notes: z.string().optional(),
        contactedBy: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      };
    }),

  deleteContactHistory: protectedProcedure
    .input(z.object({ id: z.string().uuid().or(z.string().min(1)) }))
    .mutation(async () => ({ success: true })),

  getWhatsappMessages: protectedProcedure
    .input(z.object({ customerId: customerIdSchema }))
    .query(async () => {
      return [] as Array<{
        id: string;
        customerId: string;
        direction: "inbound" | "outbound";
        content: string;
        status: "pending" | "sent" | "delivered" | "read" | "failed";
        createdAt: string;
        mediaUrl?: string;
      }>;
    }),

  createWhatsappMessage: protectedProcedure
    .input(
      z.object({
        customerId: customerIdSchema,
        direction: z.enum(["inbound", "outbound"]),
        content: z.string().min(1),
        senderNumber: z.string().optional(),
        receiverNumber: z.string().optional(),
        mediaUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => ({
      id: crypto.randomUUID(),
      ...input,
      status: "sent" as const,
      createdAt: new Date().toISOString(),
    })),

  updateWhatsappMessageStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().or(z.string().min(1)),
        status: z.enum(["pending", "sent", "delivered", "read", "failed"]),
      })
    )
    .mutation(async ({ input }) => ({ success: true, ...input })),
});
