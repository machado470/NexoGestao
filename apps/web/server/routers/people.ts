import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const peopleRouter = router({
  list: protectedProcedure.query(async () => {
    return [];
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        role: z.string().optional()
      })
    )
    .mutation(async ({ input }) => {
      return { ok: true, person: { id: "mock", name: input.name, role: input.role ?? null } };
    })
});
