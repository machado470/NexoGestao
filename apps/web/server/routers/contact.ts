import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const contactRouter = router({
  // Contact History
  createContactHistory: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        contactType: z.enum(["phone", "email", "whatsapp", "in_person", "other"]),
        subject: z.string().min(1),
        description: z.string().optional(),
        notes: z.string().optional(),
        contactedBy: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.createContactHistory({
        organizationId: ctx.user.id,
        customerId: input.customerId,
        contactType: input.contactType,
        subject: input.subject,
        description: input.description,
        notes: input.notes,
        contactedBy: input.contactedBy,
      });
    }),

  getContactHistory: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      return await db.getContactHistoryByCustomer(input.customerId);
    }),

  deleteContactHistory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.deleteContactHistory(input.id);
    }),

  // WhatsApp Messages
  createWhatsappMessage: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        direction: z.enum(["inbound", "outbound"]),
        content: z.string().min(1),
        senderNumber: z.string().optional(),
        receiverNumber: z.string().optional(),
        mediaUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.createWhatsappMessage({
        organizationId: ctx.user.id,
        customerId: input.customerId,
        direction: input.direction,
        content: input.content,
        status: "pending",
        senderNumber: input.senderNumber,
        receiverNumber: input.receiverNumber,
        mediaUrl: input.mediaUrl,
      });
    }),

  getWhatsappMessages: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      return await db.getWhatsappMessagesByCustomer(input.customerId);
    }),

  updateWhatsappMessageStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(async ({ input }) => {
      return await db.updateWhatsappMessageStatus(input.id, input.status);
    }),

  deleteWhatsappMessage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.deleteWhatsappMessage(input.id);
    }),
});
