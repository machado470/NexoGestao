import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../db";

export const referralsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allReferrals = await db.query.referrals.findMany({
        where: (referrals, { eq }) => eq(referrals.organizationId, orgId),
      });

      const total = allReferrals.length;
      const pages = Math.ceil(total / input.limit);
      const start = (input.page - 1) * input.limit;
      const data = allReferrals.slice(start, start + input.limit);

      return {
        data,
        pagination: { page: input.page, limit: input.limit, total, pages },
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        referrerName: z.string().min(1, "Nome do indicador é obrigatório"),
        referrerEmail: z.string().email("Email inválido"),
        referrerPhone: z.string().optional(),
        referredName: z.string().min(1, "Nome do indicado é obrigatório"),
        referredEmail: z.string().email("Email inválido"),
        referredPhone: z.string().optional(),
        creditAmount: z.number().min(0, "Crédito não pode ser negativo").optional(),
        status: z.enum(["PENDING", "CONFIRMED", "PAID"]).default("PENDING"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      return await db.referrals.create({
        data: {
          organizationId: orgId,
          referrerName: input.referrerName,
          referrerEmail: input.referrerEmail,
          referrerPhone: input.referrerPhone,
          referredName: input.referredName,
          referredEmail: input.referredEmail,
          referredPhone: input.referredPhone,
          creditAmount: input.creditAmount ? Math.round(input.creditAmount * 100) : 0,
          status: input.status,
          createdBy: ctx.user?.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["PENDING", "CONFIRMED", "PAID"]).optional(),
        creditAmount: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const { id, ...data } = input;

      return await db.referrals.update({
        where: { id, organizationId: orgId },
        data: {
          ...data,
          creditAmount: data.creditAmount ? Math.round(data.creditAmount * 100) : undefined,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      return await db.referrals.delete({
        where: { id: input.id, organizationId: orgId },
      });
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user?.organizationId || 1;
    const allReferrals = await db.query.referrals.findMany({
      where: (referrals, { eq }) => eq(referrals.organizationId, orgId),
    });

    const totalCredit = allReferrals.reduce((sum, r) => sum + (r.creditAmount || 0), 0);
    const confirmed = allReferrals.filter((r) => r.status === "CONFIRMED").length;
    const paid = allReferrals.filter((r) => r.status === "PAID").length;

    return {
      totalCredit,
      count: allReferrals.length,
      confirmed,
      paid,
    };
  }),
});
