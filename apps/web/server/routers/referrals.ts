import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

export const referralsRouter = router({
  list: protectedProcedure
    .input(
      paginationInput
        .extend({
          status: z.enum(["PENDING", "CONFIRMED", "PAID"]).optional(),
          q: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (input?.status) params.set("status", input.status);
      if (input?.q) params.set("q", input.q);

      const raw = await nexoFetch<any>(ctx.req, `/referrals?${params.toString()}`, {
        method: "GET",
      });

      const payload = raw?.data ?? raw;
      const data = payload?.data ?? payload ?? [];
      const pagination =
        payload?.pagination ?? {
          page,
          limit,
          total: Array.isArray(data) ? data.length : 0,
          pages: 1,
        };

      return { data, pagination };
    }),

  create: protectedProcedure
    .input(
      z.object({
        referrerName: z.string().min(1, "Nome do indicador é obrigatório"),
        referrerEmail: z.string().email("Email inválido"),
        referrerPhone: z.string().optional(),
        referredName: z.string().min(1, "Nome do indicado é obrigatório"),
        referredEmail: z.string().email("Email inválido"),
        referredPhone: z.string().optional(),
        creditAmount: z.number().min(0, "Crédito não pode ser negativo").optional(),
        status: z.enum(["PENDING", "CONFIRMED", "PAID"]).default("PENDING"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/referrals`, {
        method: "POST",
        body: JSON.stringify(input),
      });

      return raw?.data ?? raw;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["PENDING", "CONFIRMED", "PAID"]).optional(),
        creditAmount: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;

      const raw = await nexoFetch<any>(ctx.req, `/referrals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });

      return raw?.data ?? raw;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/referrals/${input.id}`, {
        method: "DELETE",
      });

      return raw?.data ?? raw;
    }),

  summary: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/referrals/summary`, {
        method: "GET",
      });

      return raw?.data ?? raw;
    }),

  /**
   * O front antigo pedia isso:
   * trpc.referrals.generateCode.useMutation()
   *
   * Nest (esperado): POST /referrals/generate-code
   */
  generateCode: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/referrals/generate-code`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return raw?.data ?? raw;
    }),

  /**
   * O front antigo pedia:
   * trpc.referrals.stats.useQuery({ page, limit })
   *
   * Nest (esperado): GET /referrals/stats?page=&limit=
   */
  stats: protectedProcedure
    .input(paginationInput.optional())
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 100;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      const raw = await nexoFetch<any>(ctx.req, `/referrals/stats?${params.toString()}`, {
        method: "GET",
      });

      return raw?.data ?? raw;
    }),

  /**
   * O front antigo pedia:
   * trpc.referrals.getBalance.useQuery()
   *
   * Nest (esperado): GET /referrals/balance
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/referrals/balance`, {
      method: "GET",
    });

    return raw?.data ?? raw;
  }),
});
