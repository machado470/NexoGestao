import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

// Helpers
const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

export const financeRouter = router({
  charges: router({
    /**
     * create charge
     * Nest (esperado): POST /finance/charges
     */
    create: protectedProcedure
      .input(
        z.object({
          customerId: z.number().min(1, "Cliente é obrigatório"),
          description: z.string().min(1, "Descrição é obrigatória"),
          amount: z.number().min(0.01, "Valor deve ser maior que 0"),
          dueDate: z.coerce.date(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // envia como o front manda (Nest decide se converte pra centavos)
        const res = await nexoFetch<any>(ctx.req, `/finance/charges`, {
          method: "POST",
          body: JSON.stringify({
            ...input,
            dueDate: input.dueDate.toISOString(),
          }),
        });

        // se sem token, nexoFetch retorna null
        return res;
      }),

    /**
     * list charges (front usa page/limit em vários pontos)
     * Nest (esperado): GET /finance/charges?page=&limit=&status=
     * Retorno esperado do Nest pode ser:
     * - { ok, data: Charge[], pagination? }
     * - ou { data, pagination }
     *
     * A gente normaliza pro shape do front:
     * { data, pagination }
     */
    list: protectedProcedure
      .input(
        paginationInput
          .extend({
            status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
            customerId: z.number().optional(),
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
        if (input?.customerId) params.set("customerId", String(input.customerId));
        if (input?.q) params.set("q", input.q);

        const raw = await nexoFetch<any>(ctx.req, `/finance/charges?${params.toString()}`, {
          method: "GET",
        });

        // Se o Nest já devolve { ok, data, pagination }:
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

    /**
     * getById
     * Nest (esperado): GET /finance/charges/:id
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/${input.id}`, {
          method: "GET",
        });

        return raw?.data ?? raw;
      }),

    /**
     * update
     * Nest (esperado): PATCH /finance/charges/:id
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          description: z.string().min(1).optional(),
          amount: z.number().min(0.01).optional(),
          dueDate: z.coerce.date().optional(),
          paidDate: z.coerce.date().optional(),
          status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...rest } = input;

        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...rest,
            dueDate: rest.dueDate ? rest.dueDate.toISOString() : undefined,
            paidDate: rest.paidDate ? rest.paidDate.toISOString() : undefined,
          }),
        });

        return raw?.data ?? raw;
      }),

    /**
     * delete
     * Nest (esperado): DELETE /finance/charges/:id
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/${input.id}`, {
          method: "DELETE",
        });

        return raw?.data ?? raw;
      }),

    /**
     * stats
     * Front antigo chamava stats.useQuery({})
     * então a gente aceita input opcional (ou {}).
     *
     * Nest (esperado): GET /finance/charges/stats
     */
    stats: protectedProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }) => {
        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/stats`, {
          method: "GET",
        });

        return raw?.data ?? raw;
      }),

    /**
     * revenueByMonth
     * Nest (esperado): GET /finance/charges/revenue-by-month
     */
    revenueByMonth: protectedProcedure.query(async ({ ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/finance/charges/revenue-by-month`, {
        method: "GET",
      });

      return raw?.data ?? raw ?? [];
    }),
  }),
});
