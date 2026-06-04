import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import { unwrapNexoApiResponse } from "../_core/nexoEnvelope";

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

const assigneeWarningSummaryPeriod = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
}).strict().refine(
  ({ from, to }) => !from || !to || new Date(from).getTime() <= new Date(to).getTime(),
  { message: "O início do período deve ser anterior ao fim" }
);

export const analyticsRouter = router({
  assigneeWarningSummary: protectedProcedure
    .input(assigneeWarningSummaryPeriod.optional())
    .query(async ({ ctx, input }) => {
      const search = new URLSearchParams();
      if (input?.from) search.set("from", input.from);
      if (input?.to) search.set("to", input.to);
      const query = search.toString();
      const raw = await nexoFetch(ctx.req, `/analytics/assignee-warning-summary${query ? `?${query}` : ""}`);
      return unwrapNexoApiResponse(raw);
    }),
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
