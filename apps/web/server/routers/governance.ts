import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import { emitOperationalNotification } from "../_core/operationalNotifications";

export const governanceRouter = router({
  status: protectedProcedure.query(async () => ({
    ok: true,
    message: "Governance router ativo",
  })),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/governance/summary`, {
      method: "GET",
    });

    return raw?.data ?? raw ?? {};
  }),

  latestRun: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/governance/runs/latest`, {
      method: "GET",
    });

    return raw?.data ?? raw ?? null;
  }),

  runs: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit ?? 20;

      const raw = await nexoFetch<any>(ctx.req, `/governance/runs?limit=${limit}`, {
        method: "GET",
      });

      return raw?.data ?? raw ?? [];
    }),

  autoScore: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/governance/auto-score`, {
      method: "GET",
    });

    return raw?.data ?? raw ?? {};
  }),

  runEnforcement: protectedProcedure.mutation(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/admin/enforcement/run-once`, {
      method: "POST",
    });

    return raw?.data ?? raw;
  }),

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
        await emitOperationalNotification({
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

  executeAction: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        type: z.enum(['charge', 'message', 'assignment', 'schedule']),
        label: z.string().min(1),
        description: z.string().min(1),
        requiresConfirmation: z.boolean().optional(),
        context: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const raw = await nexoFetch<any>(ctx.req, `/governance/actions/execute`, {
        method: 'POST',
        body: JSON.stringify(input),
      })

      return raw?.data ?? raw
    }),
});
