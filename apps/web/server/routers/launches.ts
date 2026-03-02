import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../db";

export const launchesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(20),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allLaunches = await db.query.launches.findMany({
        where: (launches, { eq, and }) => {
          const conditions = [eq(launches.organizationId, orgId)];
          if (input.type) {
            conditions.push(eq(launches.type, input.type));
          }
          return and(...conditions);
        },
      });

      const total = allLaunches.length;
      const pages = Math.ceil(total / input.limit);
      const start = (input.page - 1) * input.limit;
      const data = allLaunches.slice(start, start + input.limit);

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
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
        date: z.date(),
        category: z.string().min(1, "Categoria é obrigatória"),
        account: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      return await db.launches.create({
        data: {
          organizationId: orgId,
          description: input.description,
          amount: Math.round(input.amount * 100),
          type: input.type,
          date: input.date,
          category: input.category,
          account: input.account,
          notes: input.notes,
          createdBy: ctx.user?.id,
          status: "PENDING",
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
        amount: z.number().optional(),
        date: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const { id, ...data } = input;

      return await db.launches.update({
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
      return await db.launches.delete({
        where: { id: input.id, organizationId: orgId },
      });
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user?.organizationId || 1;
    const allLaunches = await db.query.launches.findMany({
      where: (launches, { eq }) => eq(launches.organizationId, orgId),
    });

    const income = allLaunches
      .filter((l) => l.type === "INCOME")
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const expense = allLaunches
      .filter((l) => l.type === "EXPENSE")
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const balance = income - expense;

    return {
      income,
      expense,
      balance,
      count: allLaunches.length,
    };
  }),
});
