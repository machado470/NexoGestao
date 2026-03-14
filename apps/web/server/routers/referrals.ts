import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

function toMoneyFromCents(value: unknown): number {
  return Number(value ?? 0) / 100;
}

function normalizeReferral(item: any) {
  return {
    ...item,
    referredUserName: item?.referredName ?? null,
    referredUserEmail: item?.referredEmail ?? null,
    referrerUserName: item?.referrerName ?? null,
    referrerUserEmail: item?.referrerEmail ?? null,
    creditAmount: toMoneyFromCents(item?.creditAmountCents),
  };
}

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
      const items = payload?.data ?? payload ?? [];
      const data = Array.isArray(items) ? items.map(normalizeReferral) : [];

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

      const payload = raw?.data ?? raw;
      return normalizeReferral(payload);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.union([z.number().int().positive(), z.string().min(1)]),
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

      const payload = raw?.data ?? raw;
      return normalizeReferral(payload);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.union([z.number().int().positive(), z.string().min(1)]) }))
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

      const payload = raw?.data ?? raw ?? {};
      const byStatus = payload?.byStatus ?? {};

      const pendingCount = Number(byStatus?.PENDING?.count ?? 0);
      const confirmedCount = Number(byStatus?.CONFIRMED?.count ?? 0);
      const paidCount = Number(byStatus?.PAID?.count ?? 0);

      return {
        byStatus,
        totalReferrals: pendingCount + confirmedCount + paidCount,
        completedReferrals: confirmedCount + paidCount,
        totalCredits: toMoneyFromCents(payload?.totalCreditsPaid ?? 0),
        totalCreditsPaid: payload?.totalCreditsPaid ?? 0,
      };
    }),

  generateCode: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/referrals/generate-code`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return raw?.data ?? raw;
    }),

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

      const payload = raw?.data ?? raw ?? {};
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const normalizedItems = items.map(normalizeReferral);

      const totalReferrals = Number(payload?.pagination?.total ?? normalizedItems.length ?? 0);
      const completedReferrals = normalizedItems.filter(
        (item: any) => item.status === "CONFIRMED" || item.status === "PAID"
      ).length;
      const totalCredits = normalizedItems.reduce(
        (sum: number, item: any) => sum + Number(item.creditAmount ?? 0),
        0
      );

      return {
        totalReferrals,
        completedReferrals,
        totalCredits,
        data: normalizedItems,
        pagination:
          payload?.pagination ?? {
            page,
            limit,
            total: normalizedItems.length,
            pages: 1,
          },
      };
    }),

  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/referrals/balance`, {
      method: "GET",
    });

    const payload = raw?.data ?? raw ?? {};

    return {
      available: toMoneyFromCents(payload?.pendingBalance ?? 0),
      used: toMoneyFromCents(payload?.paidBalance ?? 0),
      pendingBalance: payload?.pendingBalance ?? 0,
      paidBalance: payload?.paidBalance ?? 0,
    };
  }),
});
