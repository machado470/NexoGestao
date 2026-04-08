import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

export const analyticsRouter = router({
  track: protectedProcedure
    .input(
      z.object({
        eventName: z.enum([
          "cta_click",
          "create_customer",
          "create_service_order",
          "generate_charge",
          "send_whatsapp",
          "payment_registered",
          "upgrade_click",
          "checkout_started",
          "checkout_completed",
        ]),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await nexoFetch(ctx.req, "/analytics/track", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }),
});
