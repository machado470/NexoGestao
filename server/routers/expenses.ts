import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { expenses } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";

export const expensesRouter = router({
  // List expenses
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
        status: z.enum(["pending", "paid", "overdue", "canceled"]).optional(),
        category: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      const whereConditions = [eq(expenses.organizationId, ctx.user.organizationId)];
      if (input.status) {
        whereConditions.push(eq(expenses.status, input.status));
      }
      if (input.category) {
        whereConditions.push(eq(expenses.category, input.category));
      }

      const total = (await db.select().from(expenses).where(and(...whereConditions))).length;
      const data = await db
        .select()
        .from(expenses)
        .where(and(...whereConditions))
        .orderBy(desc(expenses.createdAt))
        .limit(input.limit)
        .offset(offset);

      return {
        data,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          pages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Create expense
  create: protectedProcedure
    .input(
      z.object({
        category: z.string().min(1),
        description: z.string().min(1),
        amount: z.number().positive(),
        dueDate: z.date(),
        paidDate: z.date().optional(),
        status: z.enum(["pending", "paid", "overdue", "canceled"]).default("pending"),
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(expenses).values({
        organizationId: ctx.user.organizationId,
        category: input.category,
        description: input.description,
        amount: input.amount.toString(),
        dueDate: input.dueDate,
        paidDate: input.paidDate,
        status: input.status,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        createdBy: ctx.user.id,
      });
      return result;
    }),

  // Update expense
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        category: z.string().optional(),
        description: z.string().optional(),
        amount: z.number().positive().optional(),
        dueDate: z.date().optional(),
        paidDate: z.date().optional(),
        status: z.enum(["pending", "paid", "overdue", "canceled"]).optional(),
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const expense = await db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.id, input.id),
            eq(expenses.organizationId, ctx.user.organizationId)
          )
        );

      if (!expense.length) throw new Error("Expense not found");

      const updateValues: any = {};
      if (input.category) updateValues.category = input.category;
      if (input.description) updateValues.description = input.description;
      if (input.amount) updateValues.amount = input.amount.toString();
      if (input.dueDate) updateValues.dueDate = input.dueDate;
      if (input.paidDate) updateValues.paidDate = input.paidDate;
      if (input.status) updateValues.status = input.status;
      if (input.paymentMethod) updateValues.paymentMethod = input.paymentMethod;
      if (input.notes) updateValues.notes = input.notes;

      await db.update(expenses).set(updateValues).where(eq(expenses.id, input.id));
      return { success: true };
    }),

  // Delete expense
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const expense = await db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.id, input.id),
            eq(expenses.organizationId, ctx.user.organizationId)
          )
        );

      if (!expense.length) throw new Error("Expense not found");

      await db.delete(expenses).where(eq(expenses.id, input.id));
      return { success: true };
    }),

  // Get expense by ID
  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const expense = await db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.id, input.id),
            eq(expenses.organizationId, ctx.user.organizationId)
          )
        );

      return expense[0] || null;
    }),

  // Summary statistics
  summary: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allExpenses = await db
        .select()
        .from(expenses)
        .where(eq(expenses.organizationId, ctx.user.organizationId));

      const total = allExpenses.length;
      const paid = allExpenses.filter((e: any) => e.status === "paid").length;
      const pending = allExpenses.filter((e: any) => e.status === "pending").length;
      const overdue = allExpenses.filter((e: any) => e.status === "overdue").length;

      const totalAmount = allExpenses.reduce(
        (sum: number, e: any) => sum + parseFloat(e.amount.toString()),
        0
      );
      const paidAmount = allExpenses
        .filter((e: any) => e.status === "paid")
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount.toString()), 0);
      const pendingAmount = allExpenses
        .filter((e: any) => e.status === "pending" || e.status === "overdue")
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount.toString()), 0);

      // Group by category
      const byCategory: Record<string, number> = {};
      allExpenses.forEach((e: any) => {
        const cat = e.category || "Outros";
        byCategory[cat] = (byCategory[cat] || 0) + parseFloat(e.amount.toString());
      });

      return {
        total,
        paid,
        pending,
        overdue,
        totalAmount,
        paidAmount,
        pendingAmount,
        byCategory,
      };
    }),

  // Get monthly report
  monthlyReport: protectedProcedure
    .input(
      z.object({
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allExpenses = await db
        .select()
        .from(expenses)
        .where(eq(expenses.organizationId, ctx.user.organizationId));

      // Filter by month and year
      const monthlyExpenses = allExpenses.filter((e: any) => {
        const date = new Date(e.dueDate);
        return date.getFullYear() === input.year && date.getMonth() + 1 === input.month;
      });

      const totalAmount = monthlyExpenses.reduce(
        (sum: number, e: any) => sum + parseFloat(e.amount.toString()),
        0
      );
      const paidAmount = monthlyExpenses
        .filter((e: any) => e.status === "paid")
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount.toString()), 0);

      return {
        year: input.year,
        month: input.month,
        totalExpenses: monthlyExpenses.length,
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
        expenses: monthlyExpenses,
      };
    }),
});
