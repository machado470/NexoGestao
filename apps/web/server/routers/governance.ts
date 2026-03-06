import { router, protectedProcedure } from "../_core/trpc";

/**
 * Governance router (temporariamente desativado).
 * O portal antigo usava DB local.
 * O novo fluxo usa o backend NestJS.
 */

export const governanceRouter = router({
  status: protectedProcedure.query(async () => {
    return {
      ok: true,
      message: "Governance router placeholder",
    };
  }),
});
