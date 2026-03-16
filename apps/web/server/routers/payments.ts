import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

export const paymentsRouter = router({
  checkout: protectedProcedure
    .input(
      z.object({
        chargeId: z.union([z.string(), z.number()]).transform((v) => String(v)),
        customerId: z.union([z.string(), z.number()]).transform((v) => String(v)),
        amount: z.number().int().min(1),
        description: z.string().min(1),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/payments/checkout`, {
        method: "POST",
        body: JSON.stringify({
          chargeId: input.chargeId,
          customerId: input.customerId,
          amount: input.amount,
          description: input.description,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        }),
      });

      return raw?.data ?? raw;
    }),

  listCharges: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/payments/charges`, {
      method: "GET",
    });

    return raw?.data ?? raw ?? [];
  }),

  markChargeAsPaid: protectedProcedure
    .input(
      z.object({
        chargeId: z.union([z.string(), z.number()]).transform((v) => String(v)),
        paymentMethod: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(
        ctx.req,
        `/payments/charges/${input.chargeId}/pay`,
        {
          method: "POST",
          body: JSON.stringify({
            paymentMethod: input.paymentMethod ?? "manual",
          }),
        },
      );

      return raw?.data ?? raw;
    }),
});
