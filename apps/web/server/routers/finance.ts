import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

const wrappedDataSchema = z.object({ data: z.unknown() });
const wrappedListSchema = z.object({
  data: z.object({
    items: z.array(z.unknown()),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      pages: z.number(),
    }),
  }),
});

export const financeRouter = router({
  payments: router({
    getById: protectedProcedure
      .input(
        z.object({
          id: z.union([z.string(), z.number()]).transform((v) => String(v)),
        })
      )
      .query(async ({ input, ctx }) => {
        const raw = await nexoFetch<unknown>(ctx, `/finance/payments/${input.id}`, {
          method: "GET",
        });

        return wrappedDataSchema.parse(raw).data;
      }),
  }),

  charges: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: z.union([z.string(), z.number()]).transform((v) => String(v)),
          amount: z.number().min(0.01, "Valor deve ser maior que 0").optional(),
          amountCents: z.number().int().min(1).optional(),
          dueDate: z.coerce.date(),
          notes: z.string().optional(),
          serviceOrderId: z.string().optional(),
          idempotencyKey: z.string().min(8).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const amountCents =
          input.amountCents ??
          (input.amount ? Math.round(input.amount * 100) : undefined);

        if (!amountCents || amountCents < 1) {
          throw new Error("Valor da cobrança é obrigatório e deve ser maior que 0");
        }

        const raw = await nexoFetch<unknown>(ctx, `/finance/charges`, {
          method: "POST",
          body: JSON.stringify({
            customerId: input.customerId,
            amountCents,
            dueDate: input.dueDate.toISOString(),
            notes: input.notes,
            serviceOrderId: input.serviceOrderId,
            idempotencyKey: input.idempotencyKey,
          }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        });

        return wrappedDataSchema.parse(raw).data;
      }),

    list: protectedProcedure
      .input(
        paginationInput
          .extend({
            status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
            q: z.string().optional(),
            serviceOrderId: z.string().optional(),
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
        if (input?.serviceOrderId) params.set("serviceOrderId", input.serviceOrderId);

        const raw = await nexoFetch<unknown>(
          ctx,
          `/finance/charges?${params.toString()}`,
          { method: "GET" }
        );

        const payload = wrappedListSchema.parse(raw).data;

        return {
          data: payload.items,
          pagination: payload.meta,
        };
      }),

    getById: protectedProcedure
      .input(
        z.object({
          id: z.union([z.string(), z.number()]).transform((v) => String(v)),
        })
      )
      .query(async ({ input, ctx }) => {
        const raw = await nexoFetch<unknown>(ctx, `/finance/charges/${input.id}`, {
          method: "GET",
        });

        return wrappedDataSchema.parse(raw).data;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.union([z.string(), z.number()]).transform((v) => String(v)),
          amount: z.number().min(0.01).optional(),
          amountCents: z.number().int().min(1).optional(),
          dueDate: z.coerce.date().optional(),
          status: z.enum(["PENDING", "OVERDUE", "CANCELED"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, amount, amountCents: amountCentsInput, ...rest } = input;

        const amountCents =
          amountCentsInput ??
          (amount ? Math.round(amount * 100) : undefined);

        const raw = await nexoFetch<unknown>(ctx, `/finance/charges/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...rest,
            amountCents,
            dueDate: rest.dueDate ? rest.dueDate.toISOString() : undefined,
          }),
        });

        return wrappedDataSchema.parse(raw).data;
      }),

    delete: protectedProcedure
      .input(
        z.object({
          id: z.union([z.string(), z.number()]).transform((v) => String(v)),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const raw = await nexoFetch<unknown>(ctx, `/finance/charges/${input.id}`, {
          method: "DELETE",
        });

        return wrappedDataSchema.parse(raw).data;
      }),

    stats: protectedProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }) => {
        const raw = await nexoFetch<unknown>(ctx, `/finance/charges/stats`, {
          method: "GET",
        });

        return wrappedDataSchema.parse(raw).data;
      }),

    revenueByMonth: protectedProcedure.query(async ({ ctx }) => {
      const raw = await nexoFetch<unknown>(ctx, `/finance/charges/revenue-by-month`, {
        method: "GET",
      });

      return wrappedDataSchema.parse(raw).data ?? [];
    }),

    pay: protectedProcedure
      .input(
        z.object({
          chargeId: z.union([z.string(), z.number()]).transform((v) => String(v)),
          method: z.enum(["PIX", "CASH", "CARD", "TRANSFER", "OTHER"]).default("PIX"),
          amountCents: z.number().int().min(1),
          idempotencyKey: z.string().min(8).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const raw = await nexoFetch<unknown>(
          ctx,
          `/finance/charges/${input.chargeId}/pay`,
          {
            method: "POST",
            body: JSON.stringify({
              method: input.method,
              amountCents: input.amountCents,
              idempotencyKey: input.idempotencyKey,
            }),
            headers: input.idempotencyKey
              ? { "Idempotency-Key": input.idempotencyKey }
              : undefined,
          }
        );

        return wrappedDataSchema.parse(raw).data;
      }),
  }),
});
