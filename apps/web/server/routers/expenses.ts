import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const expensesRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return {
        data: [],
        pagination: { page: input.page, limit: input.limit, total: 0, pages: 1 }
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1),
        amount: z.number(),
        category: z.string().min(1),
        date: z.date(),
        notes: z.string().optional()
      })
    )
    .mutation(async () => {
      return { ok: true };
    }),

  summary: protectedProcedure.query(async () => {
    return { totalExpenses: 0, count: 0, byCategory: {} as Record<string, number> };
  })
});
