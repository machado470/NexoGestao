import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../db";

export const invoicesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allInvoices = await db.query.invoices.findMany({
        where: (invoices, { eq }) => eq(invoices.organizationId, orgId),
      });

      const total = allInvoices.length;
      const pages = Math.ceil(total / input.limit);
      const start = (input.page - 1) * input.limit;
      const data = allInvoices.slice(start, start + input.limit);

      return {
        data,
        pagination: { page: input.page, limit: input.limit, total, pages },
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        number: z.string().min(1, "Número da NF é obrigatório"),
        amount: z.number().min(0.01, "Valor deve ser maior que 0"),
        issueDate: z.date(),
        dueDate: z.date(),
        status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).default("DRAFT"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      return await db.invoices.create({
        data: {
          organizationId: orgId,
          customerId: input.customerId,
          number: input.number,
          amount: Math.round(input.amount * 100),
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          status: input.status,
          notes: input.notes,
          createdBy: ctx.user?.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).optional(),
        amount: z.number().optional(),
        dueDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const { id, ...data } = input;

      return await db.invoices.update({
        where: { id, organizationId: orgId },
        data: {
          ...data,
          amount: data.amount ? Math.round(data.amount * 100) : undefined,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      return await db.invoices.delete({
        where: { id: input.id, organizationId: orgId },
      });
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user?.organizationId || 1;
    const allInvoices = await db.query.invoices.findMany({
      where: (invoices, { eq }) => eq(invoices.organizationId, orgId),
    });

    const totalIssued = allInvoices
      .filter((i) => i.status !== "DRAFT")
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalPaid = allInvoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const pending = allInvoices.filter((i) => i.status === "ISSUED").length;

    return {
      totalIssued,
      totalPaid,
      pending,
      count: allInvoices.length,
    };
  }),
});
