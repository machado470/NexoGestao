import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../db";

export const expensesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allExpenses = await db.query.expenses.findMany({
        where: (expenses, { eq }) => eq(expenses.organizationId, orgId),
      });

      const total = allExpenses.length;
      const pages = Math.ceil(total / input.limit);
      const start = (input.page - 1) * input.limit;
      const data = allExpenses.slice(start, start + input.limit);

      return {
        data,
        pagination: { page: input.page, limit: input.limit, total, pages },
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1, "Descrição é obrigatória"),
        amount: z.number().min(0.01, "Valor deve ser maior que 0"),
        category: z.string().min(1, "Categoria é obrigatória"),
        date: z.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      return await db.expenses.create({
        data: {
          organizationId: orgId,
          description: input.description,
          amount: Math.round(input.amount * 100),
          category: input.category,
          date: input.date,
          notes: input.notes,
          createdBy: ctx.user?.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string().optional(),
        amount: z.number().optional(),
        category: z.string().optional(),
        date: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const { id, ...data } = input;

      return await db.expenses.update({
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
      return await db.expenses.delete({
        where: { id: input.id, organizationId: orgId },
      });
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user?.organizationId || 1;
    const allExpenses = await db.query.expenses.findMany({
      where: (expenses, { eq }) => eq(expenses.organizationId, orgId),
    });

    const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const byCategory: Record<string, number> = {};

    allExpenses.forEach((expense) => {
      byCategory[expense.category] = (byCategory[expense.category] || 0) + (expense.amount || 0);
    });

    return {
      totalExpenses,
      count: allExpenses.length,
      byCategory,
    };
  }),
});
