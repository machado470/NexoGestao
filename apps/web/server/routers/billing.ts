import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

export const billingRouter = router({
  plans: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, "/billing/plans", {
      method: "GET",
    });

    return raw?.data ?? raw ?? [];
  }),

  status: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, "/billing/status", {
      method: "GET",
    });

    return raw?.data ?? raw ?? null;
  }),

  limits: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, "/billing/limits", {
      method: "GET",
    });

    return raw?.data ?? raw ?? null;
  }),

  checkout: protectedProcedure
    .input(
      z.object({
        priceId: z.string().min(1),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, "/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify(input),
      });

      return raw?.data ?? raw;
    }),

  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, "/billing/cancel", {
      method: "POST",
    });

    return raw?.data ?? raw;
  }),
});
