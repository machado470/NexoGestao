import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  authedGet,
  authedPost,
  type NexoContext,
} from "../_core/nexoTransport";
import { nexoPublicFetch } from "../_core/nexoClient";
import { unwrapNexoApiResponse } from "../_core/nexoEnvelope";
import {
  acceptanceCreate,
  acceptanceToken,
  acceptanceResponse,
  acceptancePublic,
  acceptanceRecord,
} from "../../shared/service-acceptance";
const scope = z.object({ serviceOrderId: z.string().uuid() }).strict();
function privateResponse(ctx: any) {
  ctx.res?.setHeader?.("Cache-Control", "private, no-store");
}
export const serviceAcceptanceRouter = router({
  list: protectedProcedure
    .input(scope)
    .output(z.array(acceptanceRecord))
    .query(({ ctx, input }) => {
      privateResponse(ctx);
      return authedGet(
        ctx as NexoContext,
        `/service-orders/${input.serviceOrderId}/acceptances`
      );
    }),
  create: protectedProcedure
    .input(acceptanceCreate)
    .output(
      z.object({
        id: z.string().uuid(),
        token: acceptanceToken.shape.token,
        expiresAt: z.string().datetime(),
      })
    )
    .mutation(({ ctx, input }) => {
      privateResponse(ctx);
      const { serviceOrderId, ...body } = input;
      return authedPost(
        ctx as NexoContext,
        `/service-orders/${serviceOrderId}/acceptances`,
        body
      );
    }),
  revoke: protectedProcedure
    .input(scope.extend({ id: z.string().uuid() }).strict())
    .output(z.object({ revoked: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      authedPost(
        ctx as NexoContext,
        `/service-orders/${input.serviceOrderId}/acceptances/${input.id}/revoke`
      )
    ),
  // POST keeps bearer-link secrets out of URL/query logs. No identity or org is accepted.
  view: publicProcedure
    .input(acceptanceToken)
    .output(acceptancePublic)
    .mutation(async ({ ctx, input }) => {
      privateResponse(ctx);
      return unwrapNexoApiResponse(
        await nexoPublicFetch(ctx.req, "/service-acceptance/view", {
          method: "POST",
          body: JSON.stringify(input),
        })
      );
    }),
  respond: publicProcedure
    .input(acceptanceResponse)
    .output(acceptancePublic)
    .mutation(async ({ ctx, input }) => {
      privateResponse(ctx);
      return unwrapNexoApiResponse(
        await nexoPublicFetch(ctx.req, "/service-acceptance/respond", {
          method: "POST",
          body: JSON.stringify(input),
        })
      );
    }),
});
