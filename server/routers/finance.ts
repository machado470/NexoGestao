import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCharge,
  getChargesByOrg,
  getChargeById,
  updateCharge,
  deleteCharge,
  createExpense,
  getExpensesByOrg,
  getExpenseById,
  updateExpense,
  deleteExpense,
  createInvoice,
  getInvoicesByOrg,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "../db";

export const financeRouter = router({
  // ===== Charges (Receitas) =====
  charges: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: z.number().min(1, "Cliente é obrigatório"),
          description: z.string().min(1, "Descrição é obrigatória"),
          amount: z.number().min(1, "Valor deve ser maior que 0"),
          dueDate: z.date(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        return await createCharge({
          organizationId: orgId,
          customerId: input.customerId,
          description: input.description,
          amount: Math.round(input.amount * 100), // Converter para centavos
          dueDate: input.dueDate,
          status: "PENDING",
          notes: input.notes,
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        const allCharges = await getChargesByOrg(orgId);
        const total = allCharges.length;
        const pages = Math.ceil(total / input.limit);
        const start = (input.page - 1) * input.limit;
        const data = allCharges.slice(start, start + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages,
          },
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getChargeById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          description: z.string().min(1).optional(),
          amount: z.number().min(1).optional(),
          dueDate: z.date().optional(),
          paidDate: z.date().optional(),
          status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, amount, ...data } = input;
        const updateData: any = { ...data };
        if (amount !== undefined) {
          updateData.amount = Math.round(amount * 100);
        }
        return await updateCharge(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteCharge(input.id);
      }),
  }),

  // ===== Statistics =====
  stats: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(100),
      })
    )
    .query(async ({ ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allCharges = await getChargesByOrg(orgId);

      const now = new Date();
      const pending = allCharges.filter((c) => c.status === "PENDING");
      const paid = allCharges.filter((c) => c.status === "PAID");
      const overdue = allCharges.filter(
        (c) => c.status === "PENDING" && new Date(c.dueDate) < now
      );

      const totalPending = pending.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalPaid = paid.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalOverdue = overdue.reduce((sum, c) => sum + (c.amount || 0), 0);

      return {
        totalCharges: allCharges.length,
        totalPending: pending.length,
        totalPaid: paid.length,
        totalOverdue: overdue.length,
        totalPendingAmount: totalPending,
        totalPaidAmount: totalPaid,
        totalOverdueAmount: totalOverdue,
        totalAmount: totalPending + totalPaid,
      };
    }),

  // ===== Revenue by Month =====
  revenueByMonth: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(100),
      })
    )
    .query(async ({ ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allCharges = await getChargesByOrg(orgId);
      const paidCharges = allCharges.filter((c) => c.status === "PAID");

      // Group by month
      const monthlyRevenue: Record<string, number> = {};
      paidCharges.forEach((charge) => {
        const date = new Date(charge.paidDate || charge.createdAt);
        const monthKey = date.toLocaleString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (charge.amount || 0);
      });

      return Object.entries(monthlyRevenue).map(([month, revenue]) => ({
        month,
        revenue: revenue / 100,
      }));
    }),

  // ===== Expenses (Despesas) =====
  expenses: router({
    create: protectedProcedure
      .input(
        z.object({
          description: z.string().min(1, "Descrição é obrigatória"),
          amount: z.number().min(1, "Valor deve ser maior que 0"),
          date: z.date(),
          category: z.string().min(1, "Categoria é obrigatória"),
          paymentMethod: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        return await createExpense({
          organizationId: orgId,
          description: input.description,
          amount: Math.round(input.amount * 100),
          date: input.date,
          category: input.category,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        const allExpenses = await getExpensesByOrg(orgId);
        const total = allExpenses.length;
        const pages = Math.ceil(total / input.limit);
        const start = (input.page - 1) * input.limit;
        const data = allExpenses.slice(start, start + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages,
          },
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getExpenseById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          description: z.string().min(1).optional(),
          amount: z.number().min(1).optional(),
          date: z.date().optional(),
          category: z.string().optional(),
          paymentMethod: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, amount, ...data } = input;
        const updateData: any = { ...data };
        if (amount !== undefined) {
          updateData.amount = Math.round(amount * 100);
        }
        return await updateExpense(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteExpense(input.id);
      }),
  }),

  // ===== Invoices (Notas Fiscais) =====
  invoices: router({
    create: protectedProcedure
      .input(
        z.object({
          chargeId: z.number().optional(),
          invoiceNumber: z.string().min(1, "Número da nota é obrigatório"),
          issueDate: z.date(),
          amount: z.number().min(1, "Valor deve ser maior que 0"),
          status: z.enum(["issued", "cancelled", "pending"]).default("issued"),
          pdfUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        return await createInvoice({
          organizationId: orgId,
          chargeId: input.chargeId,
          invoiceNumber: input.invoiceNumber,
          issueDate: input.issueDate,
          amount: Math.round(input.amount * 100),
          status: input.status,
          pdfUrl: input.pdfUrl,
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        const allInvoices = await getInvoicesByOrg(orgId);
        const total = allInvoices.length;
        const pages = Math.ceil(total / input.limit);
        const start = (input.page - 1) * input.limit;
        const data = allInvoices.slice(start, start + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages,
          },
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getInvoiceById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          invoiceNumber: z.string().optional(),
          issueDate: z.date().optional(),
          amount: z.number().optional(),
          status: z.enum(["issued", "cancelled", "pending"]).optional(),
          pdfUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, amount, ...data } = input;
        const updateData: any = { ...data };
        if (amount !== undefined) {
          updateData.amount = Math.round(amount * 100);
        }
        return await updateInvoice(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteInvoice(input.id);
      }),
  }),
});
