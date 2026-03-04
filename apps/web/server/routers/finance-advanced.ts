import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const financeAdvancedRouter = router({
  forecast: protectedProcedure
    .input(
      z.object({
        months: z.number().max(12).default(3)
      })
    )
    .query(async ({ input }) => {
      return { ok: true, data: { months: input.months } };
    })
});
