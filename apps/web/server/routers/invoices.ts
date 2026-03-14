import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

function normalizeInvoice(item: any) {
  return {
    ...item,
    amount: Number(item?.amountCents ?? 0) / 100,
  };
}

export const invoicesRouter = router({
  list: protectedProcedure
    .input(
      paginationInput
        .extend({
          status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).optional(),
          customerId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
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
      const items = payload?.data ?? payload ?? [];
      const data = Array.isArray(items) ? items.map(normalizeInvoice) : [];

      const pagination =
        payload?.pagination ?? {
          page,
          limit,
          total: data.length,
          pages: 1,
        };

      return { data, pagination };
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
        number: z.string().min(1, "Número da fatura é obrigatório"),
        amount: z.number().min(0.01, "Valor deve ser maior que 0"),
        issueDate: z.coerce.date().optional(),
        dueDate: z.coerce.date().optional(),
        status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).default("DRAFT"),
        notes: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/invoices`, {
        method: "POST",
        body: JSON.stringify({
          customerId: input.customerId ? String(input.customerId) : undefined,
          number: input.number,
          amountCents: Math.round(input.amount * 100),
          issuedAt: input.issueDate ? input.issueDate.toISOString() : undefined,
          dueDate: input.dueDate ? input.dueDate.toISOString() : undefined,
          status: input.status,
          notes: input.notes,
          description: input.description,
        }),
      });

      const payload = raw?.data ?? raw;
      return normalizeInvoice(payload);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.union([z.number().int().positive(), z.string().min(1)]),
        status: z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]).optional(),
        amount: z.number().optional(),
        dueDate: z.coerce.date().optional(),
        issueDate: z.coerce.date().optional(),
        notes: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, amount, dueDate, issueDate, ...rest } = input;

      const raw = await nexoFetch<any>(ctx.req, `/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...rest,
          ...(amount !== undefined ? { amountCents: Math.round(amount * 100) } : {}),
          ...(dueDate ? { dueDate: dueDate.toISOString() } : {}),
          ...(issueDate ? { issuedAt: issueDate.toISOString() } : {}),
        }),
      });

      const payload = raw?.data ?? raw;
      return normalizeInvoice(payload);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.union([z.number().int().positive(), z.string().min(1)]) }))
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

      const payload = raw?.data ?? raw ?? {};

      return {
        ...payload,
        total: Number(payload?.total ?? 0),
        totalIssued: Number(payload?.totalIssued ?? 0),
        totalPaid: Number(payload?.totalPaid ?? 0),
        pending: Number(payload?.pending ?? 0),
      };
    }),
});
