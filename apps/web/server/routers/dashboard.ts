import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { listOperationalNotifications } from "../_core/operationalNotifications";

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

  notifications: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(100).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.organizationId) return [];
      return listOperationalNotifications(ctx.user.organizationId, input?.limit ?? 20);
    }),

  dashboard: router({
    kpis: protectedProcedure.query(async () => ({} as Record<string, unknown>)),
    revenueTrend: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    appointmentDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    chargeDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    performanceMetrics: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
  }),
});
