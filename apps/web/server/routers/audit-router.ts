import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { authedGet, type NexoContext } from "../_core/nexoTransport";

const auditFilterInput = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  actorPersonId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const auditRouter = router({
    listEvents: protectedProcedure
      .input(
        z.object({
          page: z.number().optional(),
          limit: z.number().optional(),
          ...auditFilterInput.shape,
        })
      )
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as NexoContext, "/audit/events", input);
      }),

    exportEvents: protectedProcedure
      .input(auditFilterInput)
      .output(z.object({ csv: z.string() }))
      .mutation(({ ctx, input }) => authedGet(ctx as NexoContext, "/audit/events/export", input)),

    getSummary: protectedProcedure
      .input(
        z.object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as NexoContext, "/audit/summary", input);
      }),
  })
