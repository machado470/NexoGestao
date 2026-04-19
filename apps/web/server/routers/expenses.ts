import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const zId = z.preprocess(v => (v == null ? v : String(v)), z.string().min(1));
const expenseCategoryEnum = z.enum(["HOUSING","ELECTRICITY","WATER","INTERNET","PAYROLL","MARKET","TRANSPORT","LEISURE","OPERATIONS","OTHER"]);
const expenseTypeEnum = z.enum(["FIXED", "VARIABLE"]);
const recurrenceEnum = z.enum(["NONE", "MONTHLY"]);

export const expensesRouter = router({
  createExpense: protectedProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().optional(), amount: z.number().positive(), category: expenseCategoryEnum, type: expenseTypeEnum, recurrence: recurrenceEnum.default("NONE"), occurredAt: z.coerce.date(), dueDay: z.number().int().min(1).max(31).optional(), notes: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => nexoFetch(ctx.req, `/expenses`, { method: "POST", body: JSON.stringify({ title: input.title, description: input.description, amountCents: Math.round(input.amount * 100), category: input.category, type: input.type, recurrence: input.recurrence, occurredAt: input.occurredAt.toISOString(), dueDay: input.dueDay, notes: input.notes, isActive: input.isActive }) })),

  listExpenses: protectedProcedure
    .input(z.object({ page: z.number().int().positive().default(1), limit: z.number().int().positive().default(10), category: expenseCategoryEnum.optional(), type: expenseTypeEnum.optional(), recurrence: recurrenceEnum.optional(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const params = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
      if (input.category) params.set("category", input.category);
      if (input.type) params.set("type", input.type);
      if (input.recurrence) params.set("recurrence", input.recurrence);
      if (input.from) params.set("from", input.from);
      if (input.to) params.set("to", input.to);
      return nexoFetch(ctx.req, `/expenses?${params.toString()}`, { method: "GET" });
    }),

  getExpenseSummary: protectedProcedure
    .input(z.object({ month: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => nexoFetch(ctx.req, `/expenses/summary${input?.month ? `?month=${input.month}` : ""}`, { method: "GET" })),

  getMonthlyFinancialResult: protectedProcedure
    .input(z.object({ month: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => nexoFetch(ctx.req, `/expenses/monthly-result${input?.month ? `?month=${input.month}` : ""}`, { method: "GET" })),

  updateExpense: protectedProcedure
    .input(z.object({ id: zId, title: z.string().min(1).optional(), description: z.string().optional(), amount: z.number().positive().optional(), category: expenseCategoryEnum.optional(), type: expenseTypeEnum.optional(), recurrence: recurrenceEnum.optional(), occurredAt: z.coerce.date().optional(), dueDay: z.number().int().min(1).max(31).optional(), isActive: z.boolean().optional(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { id, amount, ...data } = input;
      return nexoFetch(ctx.req, `/expenses/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, amountCents: amount !== undefined ? Math.round(amount * 100) : undefined, occurredAt: data.occurredAt ? data.occurredAt.toISOString() : undefined }) });
    }),

  archiveExpense: protectedProcedure.input(z.object({ id: zId })).mutation(async ({ input, ctx }) => nexoFetch(ctx.req, `/expenses/${input.id}`, { method: "DELETE" })),

  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), amount: z.number().positive(), category: expenseCategoryEnum, type: expenseTypeEnum.default("VARIABLE"), recurrence: recurrenceEnum.default("NONE"), occurredAt: z.coerce.date().optional(), date: z.coerce.date().optional(), notes: z.string().optional() })).mutation(async ({ input, ctx }) => nexoFetch(ctx.req, `/expenses`, { method: "POST", body: JSON.stringify({ title: input.title, description: input.description, amountCents: Math.round(input.amount * 100), category: input.category, type: input.type, recurrence: input.recurrence, occurredAt: (input.occurredAt ?? input.date ?? new Date()).toISOString(), notes: input.notes }) })),
  list: protectedProcedure.input(z.object({ page: z.number().int().positive().default(1), limit: z.number().int().positive().default(10), category: expenseCategoryEnum.optional(), from: z.string().optional(), to: z.string().optional() })).query(async ({ input, ctx }) => {
    const params = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
    if (input.category) params.set("category", input.category);
    if (input.from) params.set("from", input.from);
    if (input.to) params.set("to", input.to);
    return nexoFetch(ctx.req, `/expenses?${params.toString()}`, { method: "GET" });
  }),
  summary: protectedProcedure.query(async ({ ctx }) => nexoFetch(ctx.req, `/expenses/summary`, { method: "GET" })),
  update: protectedProcedure.input(z.object({ id: zId, title: z.string().optional(), description: z.string().optional(), amount: z.number().positive().optional(), category: expenseCategoryEnum.optional(), notes: z.string().optional(), occurredAt: z.coerce.date().optional(), date: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
    const { id, amount, ...data } = input;
    return nexoFetch(ctx.req, `/expenses/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, amountCents: amount ? Math.round(amount * 100) : undefined, occurredAt: (data.occurredAt ?? data.date)?.toISOString() }) });
  }),
  delete: protectedProcedure.input(z.object({ id: zId })).mutation(async ({ input, ctx }) => nexoFetch(ctx.req, `/expenses/${input.id}`, { method: "DELETE" })),
});
