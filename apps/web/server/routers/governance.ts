import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import { emitOperationalNotification } from "../_core/operationalNotifications";

/**
 * Governance router — conectado ao backend NestJS.
 * Leitura: GET /governance/summary, /governance/runs, /governance/runs/latest
 * Execução manual: POST /admin/enforcement/run-once (requer ALLOW_MANUAL_ENFORCEMENT=true)
 */

export const governanceRouter = router({
  status: protectedProcedure.query(async () => ({
    ok: true,
    message: "Governance router ativo",
  })),

  governance: router({
    /**
     * Resumo de governança (último run + tendência)
     * Nest: GET /governance/summary
     */
    summary: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/governance/summary`, { method: "GET" });
        return raw?.data ?? raw ?? {};
      } catch {
        return {};
      }
    }),

    /**
     * Último run de governança
     * Nest: GET /governance/runs/latest
     */
    latestRun: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/governance/runs/latest`, { method: "GET" });
        return raw?.data ?? raw ?? null;
      } catch {
        return null;
      }
    }),

    /**
     * Histórico de runs de governança
     * Nest: GET /governance/runs?limit=
     */
    runs: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
      .query(async ({ input, ctx }) => {
        try {
          const limit = input?.limit ?? 20;
          const raw = await nexoFetch<any>(ctx.req, `/governance/runs?limit=${limit}`, { method: "GET" });
          return raw?.data ?? raw ?? [];
        } catch {
          return [] as Array<Record<string, unknown>>;
        }
      }),

    /**
     * Score automático de governança
     * Nest: GET /governance/auto-score
     */
    autoScore: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/governance/auto-score`, { method: "GET" });
        return raw?.data ?? raw ?? {};
      } catch {
        return {};
      }
    }),

    /**
     * Execução manual do enforcement (requer ALLOW_MANUAL_ENFORCEMENT=true no backend)
     * Nest: POST /admin/enforcement/run-once
     */
    runEnforcement: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/admin/enforcement/run-once`, {
          method: "POST",
        });
        return raw?.data ?? raw;
      } catch (err: any) {
        throw new Error(err?.message ?? "Erro ao executar enforcement");
      }
    }),

    // Mantido para compatibilidade com testes de integração existentes
    list: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    riskSummary: protectedProcedure.query(async () => ({})),
    riskDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    complianceDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),

    /**
     * Mudança de nível de risco — emite notificação operacional
     */
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
  }),
});
