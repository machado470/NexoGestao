import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

export const expensesRouter = router({
  list: protectedProcedure
    .input(
      paginationInput
        .extend({
          category: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (input?.category) params.set("category", input.category);
      if (input?.from) params.set("from", input.from);
      if (input?.to) params.set("to", input.to);

      const raw = await nexoFetch<any>(ctx.req, `/expenses?${params.toString()}`, {
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
        description: z.string().min(1),
        amount: z.number().positive(),
        category: z.string().min(1),
        date: z.coerce.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: input.description,
          amountCents: Math.round(input.amount * 100),
          category: input.category,
          date: input.date.toISOString(),
          notes: input.notes,
        }),
      });
      return raw?.data ?? raw;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        description: z.string().optional(),
        amount: z.number().positive().optional(),
        category: z.string().optional(),
        date: z.coerce.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, amount, date, ...rest } = input;
      const raw = await nexoFetch<any>(ctx.req, `/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...rest,
          ...(amount !== undefined ? { amountCents: Math.round(amount * 100) } : {}),
          ...(date !== undefined ? { date: date.toISOString() } : {}),
        }),
      });
      return raw?.data ?? raw;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/expenses/${input.id}`, {
        method: "DELETE",
      });
      return raw?.data ?? raw;
    }),

  summary: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/expenses/summary`, {
        method: "GET",
      });
      return raw?.data ?? raw;
    }),
});
