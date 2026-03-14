import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import { emitOperationalNotification } from "../_core/operationalNotifications";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

export const financeRouter = router({
  charges: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: z.union([z.string(), z.number()]).transform((v) => String(v)),
          description: z.string().optional(),
          amount: z.number().min(0.01, "Valor deve ser maior que 0").optional(),
          amountCents: z.number().int().min(1).optional(),
          dueDate: z.coerce.date(),
          notes: z.string().optional(),
          serviceOrderId: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const amountCents =
          input.amountCents ??
          (input.amount ? Math.round(input.amount * 100) : undefined);

        if (!amountCents || amountCents < 1) {
          throw new Error("Valor da cobrança é obrigatório e deve ser maior que 0");
        }

        const res = await nexoFetch<any>(ctx.req, `/finance/charges`, {
          method: "POST",
          body: JSON.stringify({
            customerId: input.customerId,
            amountCents,
            dueDate: input.dueDate.toISOString(),
            notes: input.notes,
            serviceOrderId: input.serviceOrderId,
          }),
        });

        return res?.data ?? res;
      }),

    list: protectedProcedure
      .input(
        paginationInput
          .extend({
            status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
            q: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ input, ctx }) => {
        const page = input?.page ?? 1;
        const limit = input?.limit ?? 20;

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (input?.status) params.set("status", input.status);
        if (input?.q) params.set("q", input.q);

        const raw = await nexoFetch<any>(
          ctx.req,
          `/finance/charges?${params.toString()}`,
          { method: "GET" },
        );

        const payload = raw?.data ?? raw;

        return {
          data: payload?.items ?? [],
          pagination: payload?.meta ?? {
            page,
            limit,
            total: 0,
            pages: 1,
          },
        };
      }),

    getById: protectedProcedure
      .input(
        z.object({
          id: z.union([z.string(), z.number()]).transform((v) => String(v)),
        }),
      )
      .query(async ({ input, ctx }) => {
        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/${input.id}`, {
          method: "GET",
        });

        return raw?.data ?? raw;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.union([z.string(), z.number()]).transform((v) => String(v)),
          description: z.string().min(1).optional(),
          amount: z.number().min(0.01).optional(),
          amountCents: z.number().int().min(1).optional(),
          dueDate: z.coerce.date().optional(),
          paidAt: z.coerce.date().optional(),
          paidDate: z.coerce.date().optional(),
          status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { id, amount, amountCents: amountCentsInput, paidDate, ...rest } = input;

        const amountCents =
          amountCentsInput ??
          (amount ? Math.round(amount * 100) : undefined);

        const paidAt = rest.paidAt ?? paidDate;

        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...rest,
            amountCents,
            dueDate: rest.dueDate ? rest.dueDate.toISOString() : undefined,
            paidAt: paidAt ? paidAt.toISOString() : undefined,
          }),
        });

        if (ctx.user?.organizationId && input.status === "OVERDUE") {
          await emitOperationalNotification({
            orgId: ctx.user.organizationId,
            type: "PAYMENT_OVERDUE",
            metadata: { chargeId: id },
          });
        }

        return raw?.data ?? raw;
      }),

    delete: protectedProcedure
      .input(
        z.object({
          id: z.union([z.string(), z.number()]).transform((v) => String(v)),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/${input.id}`, {
          method: "DELETE",
        });

        return raw?.data ?? raw;
      }),

    stats: protectedProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }) => {
        const raw = await nexoFetch<any>(ctx.req, `/finance/charges/stats`, {
          method: "GET",
        });

        return raw?.data ?? raw;
      }),

    revenueByMonth: protectedProcedure.query(async ({ ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/finance/charges/revenue-by-month`, {
        method: "GET",
      });

      return raw?.data ?? raw ?? [];
    }),

    pay: protectedProcedure
      .input(
        z.object({
          chargeId: z.union([z.string(), z.number()]).transform((v) => String(v)),
          method: z.enum(["PIX", "CASH", "CARD", "TRANSFER", "OTHER"]).default("PIX"),
          amountCents: z.number().int().min(1).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const raw = await nexoFetch<any>(
          ctx.req,
          `/finance/charges/${input.chargeId}/pay`,
          {
            method: "POST",
            body: JSON.stringify({
              method: input.method,
              amountCents: input.amountCents,
            }),
          },
        );

        return raw?.data ?? raw;
      }),
  }),
});
