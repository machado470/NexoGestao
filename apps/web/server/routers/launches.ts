import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const launchesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional()
      })
    )
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
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
        date: z.date(),
        category: z.string().min(1),
        account: z.string().optional(),
        notes: z.string().optional()
      })
    )
    .mutation(async () => {
      return { ok: true };
    }),

  summary: protectedProcedure.query(async () => {
    return { income: 0, expense: 0, balance: 0 };
  })
});
