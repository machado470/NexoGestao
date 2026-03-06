import { router, protectedProcedure } from "../_core/trpc";

/**
 * Governance router (temporariamente desativado).
 * O portal antigo usava DB local.
 * O novo fluxo usa o backend NestJS.
 */

export const governanceRouter = router({
  status: protectedProcedure.query(async () => ({
    ok: true,
    message: "Governance router placeholder",
  })),

  governance: router({
    list: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    riskSummary: protectedProcedure.query(async () => ({})),
    riskDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    complianceDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
  }),
});
