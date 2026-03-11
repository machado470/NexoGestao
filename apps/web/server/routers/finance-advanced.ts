import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

/**
 * Finance Advanced Router
 * Endpoints avançados de finanças que complementam o financeRouter principal.
 * Todos os dados são provenientes do backend NestJS.
 */
export const financeAdvancedRouter = router({
  /**
   * Visão geral financeira da organização
   * Nest: GET /finance/overview
   */
  overview: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/finance/overview`, { method: "GET" });
    return raw?.data ?? raw;
  }),

  /**
   * Estatísticas de cobranças (totais por status)
   * Nest: GET /finance/charges/stats
   */
  chargeStats: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/finance/charges/stats`, { method: "GET" });
    return raw?.data ?? raw;
  }),

  /**
   * Receita por mês (histórico)
   * Nest: GET /finance/charges/revenue-by-month
   */
  revenueByMonth: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/finance/charges/revenue-by-month`, { method: "GET" });
    return raw?.data ?? raw ?? [];
  }),

  /**
   * Processar cobranças em atraso (automação)
   * Nest: POST /finance/charges/automation/overdue
   */
  processOverdue: protectedProcedure.mutation(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/finance/charges/automation/overdue`, {
      method: "POST",
    });
    return raw?.data ?? raw;
  }),

  /**
   * Previsão de receita (calculada a partir do histórico do backend)
   * Usa revenue-by-month para projetar os próximos meses com média móvel.
   */
  forecast: protectedProcedure
    .input(
      z.object({
        months: z.number().int().min(1).max(12).default(3),
      })
    )
    .query(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/finance/charges/revenue-by-month`, {
        method: "GET",
      });
      const history: Array<{ month: string; totalCents: number }> = raw?.data ?? raw ?? [];

      // Média dos últimos 6 meses disponíveis para projeção simples
      const last = history.slice(-6);
      const avg =
        last.length > 0
          ? last.reduce((sum, m) => sum + (m.totalCents ?? 0), 0) / last.length
          : 0;

      const projected = Array.from({ length: input.months }, (_, i) => ({
        month: `+${i + 1}m`,
        projectedCents: Math.round(avg),
      }));

      return {
        ok: true,
        data: {
          months: input.months,
          avgMonthlyCents: Math.round(avg),
          projected,
          history,
        },
      };
    }),
});
