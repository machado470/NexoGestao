import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invoices, charges, customers } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";

export const invoicesRouter = router({
  // List invoices
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
        status: z.enum(["draft", "issued", "paid", "canceled"]).optional(),
      })
    )
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      const whereConditions = [eq(invoices.organizationId, ctx.user.organizationId)];
      if (input.status) {
        whereConditions.push(eq(invoices.status, input.status));
      }

      const total = (await db.select().from(invoices).where(and(...whereConditions))).length;
      const data = await db
        .select()
        .from(invoices)
        .where(and(...whereConditions))
        .orderBy(desc(invoices.createdAt))
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

  // Create invoice
  create: protectedProcedure
    .input(
      z.object({
        chargeId: z.number().int().optional(),
        customerId: z.number().int(),
        invoiceNumber: z.string().min(1),
        seriesNumber: z.string().optional(),
        description: z.string().optional(),
        amount: z.number().positive(),
        issueDate: z.date(),
        dueDate: z.date().optional(),
        status: z.enum(["draft", "issued", "paid", "canceled"]).default("draft"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validar que o cliente pertence à organização
      const customer = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, input.customerId),
            eq(customers.organizationId, ctx.user.organizationId)
          )
        );

      if (!customer.length) throw new Error("Customer not found or does not belong to your organization");

      // Validar que a cobrança pertence à organização (se fornecida)
      if (input.chargeId) {
        const charge = await db
          .select()
          .from(charges)
          .where(
            and(
              eq(charges.id, input.chargeId),
              eq(charges.organizationId, ctx.user.organizationId)
            )
          );

        if (!charge.length) throw new Error("Charge not found or does not belong to your organization");
      }

      const result = await db.insert(invoices).values({
        organizationId: ctx.user.organizationId,
        chargeId: input.chargeId,
        customerId: input.customerId,
        invoiceNumber: input.invoiceNumber,
        seriesNumber: input.seriesNumber,
        description: input.description,
        amount: input.amount.toString(),
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        status: input.status,
        notes: input.notes,
        createdBy: ctx.user.id,
      });
      return result;
    }),

  // Update invoice
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["draft", "issued", "paid", "canceled"]).optional(),
        amount: z.number().positive().optional(),
        dueDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const invoice = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.organizationId, ctx.user.organizationId)
          )
        );

      if (!invoice.length) throw new Error("Invoice not found");

      const updateValues: any = {};
      if (input.status) updateValues.status = input.status;
      if (input.amount) updateValues.amount = input.amount.toString();
      if (input.dueDate) updateValues.dueDate = input.dueDate;
      if (input.notes) updateValues.notes = input.notes;

      await db.update(invoices).set(updateValues).where(eq(invoices.id, input.id));
      return { success: true };
    }),

  // Delete invoice
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const invoice = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.organizationId, ctx.user.organizationId)
          )
        );

      if (!invoice.length) throw new Error("Invoice not found");

      await db.delete(invoices).where(eq(invoices.id, input.id));
      return { success: true };
    }),

  // Get invoice by ID
  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const invoice = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.organizationId, ctx.user.organizationId)
          )
        );

      return invoice[0] || null;
    }),

  // Get invoices by charge ID
  byCharge: protectedProcedure
    .input(z.object({ chargeId: z.number().int() }))
    .query(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const data = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.chargeId, input.chargeId),
            eq(invoices.organizationId, ctx.user.organizationId)
          )
        );

      return data;
    }),

  // Summary statistics
  summary: protectedProcedure.query(async ({ ctx }: any) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, ctx.user.organizationId));

    const total = allInvoices.length;
    const issued = allInvoices.filter((i: any) => i.status === "issued").length;
    const paid = allInvoices.filter((i: any) => i.status === "paid").length;
    const totalAmount = allInvoices.reduce(
      (sum: number, i: any) => sum + parseFloat(i.amount.toString()),
      0
    );
    const paidAmount = allInvoices
      .filter((i: any) => i.status === "paid")
      .reduce((sum: number, i: any) => sum + parseFloat(i.amount.toString()), 0);

    return {
      total,
      issued,
      paid,
      totalAmount,
      paidAmount,
      pendingAmount: totalAmount - paidAmount,
    };
  }),
});
