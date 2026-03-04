import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const aiRouter = router({
  analyze: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        data: z.record(z.string(), z.any()).optional()
      })
    )
    .mutation(async ({ input }) => {
      return {
        ok: true,
        data: {
          echo: input.prompt,
          payload: input.data ?? {}
        }
      };
    })
});
