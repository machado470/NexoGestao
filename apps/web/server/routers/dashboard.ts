import { router, protectedProcedure } from "../_core/trpc";

/**
 * Dashboard router (temporariamente desativado).
 * Antigo usava DB local (drizzle/in-memory).
 * Novo vai consumir o backend Nest (reports/dashboard endpoints).
 */

export const dashboardRouter = router({
  status: protectedProcedure.query(async () => ({
    ok: true,
    message: "Dashboard router placeholder",
  })),

  dashboard: router({
    kpis: protectedProcedure.query(async () => ({} as Record<string, unknown>)),
    revenueTrend: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    appointmentDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    chargeDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    performanceMetrics: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
  }),
});
