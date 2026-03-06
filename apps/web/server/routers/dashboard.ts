import { router, protectedProcedure } from "../_core/trpc";

/**
 * Dashboard router (temporariamente desativado).
 * Antigo usava DB local (drizzle/in-memory).
 * Novo vai consumir o backend Nest (reports/dashboard endpoints).
 */

export const dashboardRouter = router({
  status: protectedProcedure.query(async () => {
    return {
      ok: true,
      message: "Dashboard router placeholder",
    };
  }),
});
