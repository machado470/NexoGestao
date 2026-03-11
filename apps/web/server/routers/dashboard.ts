import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import {
  countUnreadOperationalNotifications,
  listOperationalNotifications,
  listOperationalNotificationsPaginated,
  markNotificationAsRead,
} from "../_core/operationalNotifications";

/**
 * Dashboard router — conectado ao backend NestJS.
 * KPIs e métricas operacionais vêm de GET /dashboard/*.
 */

export const dashboardRouter = router({
  status: protectedProcedure.query(async () => ({
    ok: true,
    message: "Dashboard router ativo",
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
      return await listOperationalNotifications(ctx.user.organizationId, input?.limit ?? 20);
    }),

  notificationCenter: router({
    list: protectedProcedure
      .input(
        z
          .object({
            page: z.number().int().min(1).default(1),
            limit: z.number().int().min(1).max(50).default(10),
            category: z.enum(["all", "appointments", "finance", "risk"]).default("all"),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        if (!ctx.user?.organizationId) {
          return {
            items: [],
            total: 0,
            page: 1,
            pages: 1,
            unreadCount: 0,
          };
        }

        return listOperationalNotificationsPaginated({
          orgId: ctx.user.organizationId,
          page: input?.page ?? 1,
          limit: input?.limit ?? 10,
          category: input?.category ?? "all",
        });
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.organizationId) return { unreadCount: 0 };

      const unreadCount = await countUnreadOperationalNotifications(ctx.user.organizationId);
      return { unreadCount };
    }),

    markAsRead: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.organizationId) return { success: false };

        return markNotificationAsRead({
          id: input.id,
          orgId: ctx.user.organizationId,
        });
      }),
  }),

  /**
   * Sub-router de dashboard — conectado ao backend NestJS.
   * Nest: GET /dashboard/metrics, /dashboard/alerts, /dashboard/revenue, etc.
   */
  dashboard: router({
    /**
     * KPIs operacionais: clientes ativos, agendamentos do dia, OS abertas, cobranças pendentes
     * Nest: GET /dashboard/metrics
     */
    kpis: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/dashboard/metrics`, { method: "GET" });
        return raw?.data ?? raw ?? {};
      } catch {
        return {} as Record<string, unknown>;
      }
    }),

    /**
     * Alertas operacionais: OS atrasadas, cobranças vencidas, serviços do dia
     * Nest: GET /dashboard/alerts
     */
    alerts: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/dashboard/alerts`, { method: "GET" });
        return raw?.data ?? raw ?? [];
      } catch {
        return [] as Array<Record<string, unknown>>;
      }
    }),

    /**
     * Tendência de receita (últimos 12 meses)
     * Nest: GET /dashboard/revenue
     */
    revenueTrend: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/dashboard/revenue`, { method: "GET" });
        return raw?.data ?? raw ?? [];
      } catch {
        return [] as Array<Record<string, unknown>>;
      }
    }),

    /**
     * Crescimento de clientes por mês
     * Nest: GET /dashboard/growth
     */
    customerGrowth: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/dashboard/growth`, { method: "GET" });
        return raw?.data ?? raw ?? [];
      } catch {
        return [] as Array<Record<string, unknown>>;
      }
    }),

    /**
     * Distribuição de agendamentos por status
     * Nest: GET /dashboard/service-orders-status (usado para OS)
     */
    appointmentDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),

    /**
     * Distribuição de cobranças por status
     * Nest: GET /dashboard/charges-status
     */
    chargeDistribution: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/dashboard/charges-status`, { method: "GET" });
        return raw?.data ?? raw ?? [];
      } catch {
        return [] as Array<Record<string, unknown>>;
      }
    }),

    /**
     * Status das ordens de serviço
     * Nest: GET /dashboard/service-orders-status
     */
    serviceOrdersStatus: protectedProcedure.query(async ({ ctx }) => {
      try {
        const raw = await nexoFetch<any>(ctx.req, `/dashboard/service-orders-status`, { method: "GET" });
        return raw?.data ?? raw ?? [];
      } catch {
        return [] as Array<Record<string, unknown>>;
      }
    }),

    performanceMetrics: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
  }),
});
