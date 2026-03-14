import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

/**
 * Contact router
 * Mantém histórico de contato como placeholder local
 * e encaminha WhatsApp para o backend real do Nest.
 */

const customerIdSchema = z.string().uuid().or(z.string().min(1));
const genericIdSchema = z.string().uuid().or(z.string().min(1));

export const contactRouter = router({
  status: protectedProcedure.query(async () => ({
    ok: true,
    message: "Contact router ativo",
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
        contactType: z.enum([
          "phone",
          "email",
          "whatsapp",
          "in_person",
          "other",
        ]),
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
    .input(z.object({ id: genericIdSchema }))
    .mutation(async () => ({ success: true })),

  getWhatsappMessages: protectedProcedure
    .input(z.object({ customerId: customerIdSchema }))
    .query(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(
        ctx.req,
        `/whatsapp/messages/${input.customerId}`,
        {
          method: "GET",
        }
      );

      return raw?.data ?? raw ?? [];
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
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/whatsapp/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      });

      return raw?.data ?? raw;
    }),

  updateWhatsappMessageStatus: protectedProcedure
    .input(
      z.object({
        id: genericIdSchema,
        status: z.enum(["pending", "sent", "delivered", "read", "failed"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(
        ctx.req,
        `/whatsapp/messages/${input.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: input.status }),
        }
      );

      return raw?.data ?? raw;
    }),
});
