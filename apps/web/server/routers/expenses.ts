import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const zId = z.preprocess(
  (v) => (v === undefined || v === null ? v : String(v)),
  z.string().min(1)
);

const expenseCategoryEnum = z.enum([
  "OPERATIONAL",
  "MARKETING",
  "INFRASTRUCTURE",
  "PAYROLL",
  "TAXES",
  "SUPPLIES",
  "TRAVEL",
  "OTHER",
]);

type ExpensesSummaryLike = {
  totalExpenses?: number;
  count?: number;
  byCategory?: Record<string, number>;
};

type ExpensesListLike = {
  data?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export const expensesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1, "Descrição é obrigatória"),
        amount: z.number().positive("Valor deve ser > 0"),
        category: expenseCategoryEnum.optional(),
        date: z.coerce.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await nexoFetch(ctx.req, `/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: input.description,
          amountCents: Math.round(input.amount * 100),
          category: input.category,
          date: input.date.toISOString(),
          notes: input.notes,
        }),
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
        category: expenseCategoryEnum.optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const params = new URLSearchParams({
        page: String(input.page),
        limit: String(input.limit),
      });

      if (input.category) params.set("category", input.category);
      if (input.from) params.set("from", input.from);
      if (input.to) params.set("to", input.to);

      const out = await nexoFetch(ctx.req, `/expenses?${params.toString()}`, {
        method: "GET",
      });

      if (Array.isArray(out)) {
        const total = out.length;
        const offset = (input.page - 1) * input.limit;
        const data = out.slice(offset, offset + input.limit);

        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages: Math.ceil(total / input.limit),
          },
        };
      }

      return out;
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    try {
      const out = (await nexoFetch(ctx.req, `/expenses/summary`, {
        method: "GET",
      })) as ExpensesSummaryLike | null;

      return out ?? {};
    } catch {
      const out = (await nexoFetch(ctx.req, `/expenses?page=1&limit=1000`, {
        method: "GET",
      })) as ExpensesListLike | any[] | null;

      const rows = Array.isArray(out)
        ? out
        : Array.isArray(out?.data)
          ? out.data
          : [];

      const totalExpenses = rows.reduce(
        (acc: number, item: any) => acc + Number(item?.amountCents ?? 0),
        0
      );

      return { totalExpenses, count: rows.length };
    }
  }),

  getById: protectedProcedure
    .input(z.object({ id: zId }))
    .query(async ({ input, ctx }) => {
      return await nexoFetch(ctx.req, `/expenses/${input.id}`, {
        method: "GET",
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: zId,
        description: z.string().min(1).optional(),
        amount: z.number().positive().optional(),
        category: expenseCategoryEnum.optional(),
        date: z.coerce.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, amount, ...data } = input;

      return await nexoFetch(ctx.req, `/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          amountCents: amount !== undefined ? Math.round(amount * 100) : undefined,
          date: data.date ? data.date.toISOString() : undefined,
        }),
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ input, ctx }) => {
      return await nexoFetch(ctx.req, `/expenses/${input.id}`, {
        method: "DELETE",
      });
    }),
});
