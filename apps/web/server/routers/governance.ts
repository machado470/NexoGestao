import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { emitOperationalNotification } from "../_core/operationalNotifications";

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
    changeRiskLevel: protectedProcedure
      .input(
        z.object({
          entityId: z.union([z.string(), z.number()]).transform((v) => String(v)),
          previousLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          newLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.organizationId && input.previousLevel !== input.newLevel) {
          emitOperationalNotification({
            orgId: ctx.user.organizationId,
            type: "RISK_LEVEL_CHANGED",
            metadata: {
              entityId: input.entityId,
              previousLevel: input.previousLevel,
              newLevel: input.newLevel,
            },
          });
        }

        return {
          ok: true,
          ...input,
        };
      }),
  }),
});
