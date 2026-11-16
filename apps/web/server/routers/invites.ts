import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  authedGet,
  authedPost,
  authedPatch,
  type NexoContext,
} from "../_core/nexoTransport";

export const invitesRouter = router({
  invite: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return authedPost(ctx as NexoContext, "/auth/invite", input);
    }),

  resend: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      authedPost(
        ctx as NexoContext,
        `/auth/invites/${encodeURIComponent(input.id)}/resend`
      )
    ),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      authedPost(
        ctx as NexoContext,
        `/auth/invites/${encodeURIComponent(input.id)}/revoke`
      )
    ),

  updateMember: protectedProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]).optional(),
          active: z.boolean().optional(),
          expectedUpdatedAt: z.string().datetime(),
        })
        .refine(
          input => input.role !== undefined || input.active !== undefined,
          "Informe um papel ou estado de acesso."
        )
    )
    .mutation(async ({ ctx, input: { id, ...input } }) =>
      authedPatch(
        ctx as NexoContext,
        `/auth/organization/members/${encodeURIComponent(id)}`,
        input
      )
    ),

  members: protectedProcedure.query(async ({ ctx }) => {
    return authedGet(ctx as NexoContext, "/auth/organization/members");
  }),
});
