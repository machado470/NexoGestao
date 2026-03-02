import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { launches, type Launch } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";

export const launchesRouter = router({
  // List launches with pagination
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
        type: z.enum(["income", "expense"]).optional(),
        status: z.enum(["pending", "paid", "overdue", "canceled"]).optional(),
      })
    )
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const offset = (input.page - 1) * input.limit;

      // Build where clause
      const whereConditions = [eq(launches.organizationId, ctx.user.organizationId)];
      if (input.type) {
        whereConditions.push(eq(launches.type, input.type));
      }
      if (input.status) {
        whereConditions.push(eq(launches.status, input.status));
      }

      // Get total count
      const totalResult = await db
        .select({ count: launches.id })
        .from(launches)
        .where(and(...whereConditions));
      const total = totalResult.length;

      // Get paginated data
      const data = await db
        .select()
        .from(launches)
        .where(and(...whereConditions))
        .orderBy(desc(launches.createdAt))
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

  // Get single launch
  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const launch = await db
        .select()
        .from(launches)
        .where(
          and(
            eq(launches.id, input.id),
            eq(launches.organizationId, ctx.user.organizationId)
          )
        );
      return launch[0] || null;
    }),

  // Create launch
  create: protectedProcedure
    .input(
      z.object({
        chargeId: z.number().int().optional(),
        type: z.enum(["income", "expense"]),
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
      
      const result = await db.insert(launches).values({
        organizationId: ctx.user.organizationId,
        chargeId: input.chargeId,
        type: input.type,
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

  // Update launch
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
      
      const { id, ...updateData } = input;

      // Verify ownership
      const launch = await db
        .select()
        .from(launches)
        .where(
          and(
            eq(launches.id, id),
            eq(launches.organizationId, ctx.user.organizationId)
          )
        );

      if (!launch.length) {
        throw new Error("Launch not found");
      }

      const updateValues: any = {};
      if (updateData.category) updateValues.category = updateData.category;
      if (updateData.description) updateValues.description = updateData.description;
      if (updateData.amount) updateValues.amount = updateData.amount.toString();
      if (updateData.dueDate) updateValues.dueDate = updateData.dueDate;
      if (updateData.paidDate) updateValues.paidDate = updateData.paidDate;
      if (updateData.status) updateValues.status = updateData.status;
      if (updateData.paymentMethod) updateValues.paymentMethod = updateData.paymentMethod;
      if (updateData.notes) updateValues.notes = updateData.notes;

      await db.update(launches).set(updateValues).where(eq(launches.id, id));
      return { success: true };
    }),

  // Delete launch
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify ownership
      const launch = await db
        .select()
        .from(launches)
        .where(
          and(
            eq(launches.id, input.id),
            eq(launches.organizationId, ctx.user.organizationId)
          )
        );

      if (!launch.length) {
        throw new Error("Launch not found");
      }

      await db.delete(launches).where(eq(launches.id, input.id));
      return { success: true };
    }),

  // Get summary statistics
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
      
      const whereConditions: any[] = [eq(launches.organizationId, ctx.user.organizationId)];

      if (input.startDate && input.endDate) {
        // Add date filter if needed
      }

      const allLaunches = await db
        .select()
        .from(launches)
        .where(and(...whereConditions));

      const income = allLaunches
        .filter((l: any) => l.type === "income" && l.status === "paid")
        .reduce((sum: number, l: any) => sum + parseFloat(l.amount.toString()), 0);

      const expenses = allLaunches
        .filter((l: any) => l.type === "expense" && l.status === "paid")
        .reduce((sum: number, l: any) => sum + parseFloat(l.amount.toString()), 0);

      const pendingIncome = allLaunches
        .filter((l: any) => l.type === "income" && l.status === "pending")
        .reduce((sum: number, l: any) => sum + parseFloat(l.amount.toString()), 0);

      const pendingExpenses = allLaunches
        .filter((l: any) => l.type === "expense" && l.status === "pending")
        .reduce((sum: number, l: any) => sum + parseFloat(l.amount.toString()), 0);

      return {
        income,
        expenses,
        pendingIncome,
        pendingExpenses,
        balance: income - expenses,
        totalLaunches: allLaunches.length,
      };
    }),
});
