import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  countUnreadOperationalNotifications,
  listOperationalNotifications,
  listOperationalNotificationsPaginated,
  markNotificationAsRead,
} from "../_core/operationalNotifications";

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

  dashboard: router({
    kpis: protectedProcedure.query(async () => ({} as Record<string, unknown>)),
    revenueTrend: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    appointmentDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    chargeDistribution: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
    performanceMetrics: protectedProcedure.query(async () => [] as Array<Record<string, unknown>>),
  }),
});
