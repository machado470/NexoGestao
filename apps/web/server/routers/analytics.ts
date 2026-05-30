import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const conversionEventName = z.enum([
  "cta_click",
  "create_customer",
  "create_service_order",
  "generate_charge",
  "send_whatsapp",
  "payment_registered",
  "upgrade_click",
  "checkout_started",
  "checkout_completed",
]);
const assigneeWarningType = z.enum([
  "UNAVAILABLE_NOW",
  "UNAVAILABLE_SOON",
  "OVER_CAPACITY",
  "OVERLOADED",
]);
const assigneeWarningMetadata = z.object({
  context: z.enum(["APPOINTMENT", "SERVICE_ORDER"]),
  personId: z.string().min(1).max(100),
  warningTypes: z.array(assigneeWarningType).min(1).max(4),
  entityId: z.string().min(1).max(100).optional(),
}).strict();

export const analyticsRouter = router({
  track: protectedProcedure
    .input(
      z.union([
        z.object({
          eventName: conversionEventName,
          metadata: z.record(z.string(), z.unknown()).optional(),
        }).strict(),
        z.object({
          eventName: z.literal("ASSIGNEE_WARNING_SHOWN"),
          metadata: assigneeWarningMetadata.omit({ entityId: true }),
        }).strict(),
        z.object({
          eventName: z.literal("ASSIGNEE_WARNING_CONFIRMED"),
          metadata: assigneeWarningMetadata,
        }).strict(),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      return await nexoFetch(ctx.req, "/analytics/track", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }),
});
