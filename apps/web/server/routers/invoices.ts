import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

export const invoicesRouter = router({
  list: protectedProcedure
    .input(
      paginationInput
        .extend({
          status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).optional(),
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

      const raw = await nexoFetch<any>(ctx.req, `/invoices?${params.toString()}`, {
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
        customerId: z.number().min(1),
        number: z.string().min(1, "Número da NF é obrigatório"),
        amount: z.number().min(0.01, "Valor deve ser maior que 0"),
        issueDate: z.coerce.date(),
        dueDate: z.coerce.date(),
        status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).default("DRAFT"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/invoices`, {
        method: "POST",
        body: JSON.stringify({
          ...input,
          issueDate: input.issueDate.toISOString(),
          dueDate: input.dueDate.toISOString(),
        }),
      });

      return raw?.data ?? raw;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).optional(),
        amount: z.number().optional(),
        dueDate: z.coerce.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;

      const raw = await nexoFetch<any>(ctx.req, `/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...rest,
          dueDate: rest.dueDate ? rest.dueDate.toISOString() : undefined,
        }),
      });

      return raw?.data ?? raw;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/invoices/${input.id}`, {
        method: "DELETE",
      });

      return raw?.data ?? raw;
    }),

  summary: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/invoices/summary`, {
        method: "GET",
      });

      return raw?.data ?? raw;
    }),
});
