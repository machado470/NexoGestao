import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./trpc";
import { authedGet } from "./nexoTransport";
import { clientIpChainMetrics, selfDiagnostic } from "./clientIp";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  /**
   * C7.2c: platform operators only. The API decides (PlatformAdminGuard: verified session,
   * active ADMIN, id in PLATFORM_ADMIN_USER_IDS; deny by default). An organization ADMIN gets
   * FORBIDDEN. Returns the shape of the caller's own request and aggregated counters only.
   */
  clientIpDiagnostic: protectedProcedure.query(async ({ ctx }) => {
    await authedGet(ctx, "/admin/platform-access");
    return { self: selfDiagnostic(ctx.req), aggregate: clientIpChainMetrics.snapshot() };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
