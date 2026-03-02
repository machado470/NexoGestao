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
        const orgId = ctx.user?.id || 1;
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

    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      return await getChargesByOrg(orgId);
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
        const orgId = ctx.user?.id || 1;
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

    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      return await getExpensesByOrg(orgId);
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
        const orgId = ctx.user?.id || 1;
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

    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      return await getInvoicesByOrg(orgId);
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

  // ===== Statistics & Reports =====
  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user?.id || 1;
    const allCharges = await getChargesByOrg(orgId);
    const allExpenses = await getExpensesByOrg(orgId);

    const now = new Date();
    const pendingCharges = allCharges.filter((c) => c.status === "PENDING");
    const paidCharges = allCharges.filter((c) => c.status === "PAID");
    const overdueCharges = allCharges.filter(
      (c) => c.status === "PENDING" && new Date(c.dueDate) < now
    );

    const totalPendingAmount = pendingCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalPaidAmount = paidCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalOverdueAmount = overdueCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalExpensesAmount = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      totalCharges: allCharges.length,
      totalPending: pendingCharges.length,
      totalPaid: paidCharges.length,
      totalOverdue: overdueCharges.length,
      totalPendingAmount,
      totalPaidAmount,
      totalOverdueAmount,
      totalExpensesAmount,
      netProfit: totalPaidAmount - totalExpensesAmount,
      totalAmount: totalPendingAmount + totalPaidAmount,
    };
  }),

  revenueByMonth: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user?.id || 1;
    const allCharges = await getChargesByOrg(orgId);
    const allExpenses = await getExpensesByOrg(orgId);
    
    const paidCharges = allCharges.filter((c) => c.status === "PAID");

    const monthlyData: Record<string, { revenue: number; expenses: number }> = {};

    paidCharges.forEach((charge) => {
      const date = new Date(charge.paidDate || charge.createdAt);
      const monthKey = date.toLocaleString("pt-BR", { month: "short", year: "numeric" });
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, expenses: 0 };
      monthlyData[monthKey].revenue += (charge.amount || 0);
    });

    allExpenses.forEach((expense) => {
      const date = new Date(expense.date || expense.createdAt);
      const monthKey = date.toLocaleString("pt-BR", { month: "short", year: "numeric" });
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, expenses: 0 };
      monthlyData[monthKey].expenses += (expense.amount || 0);
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      revenue: data.revenue / 100,
      expenses: data.expenses / 100,
      profit: (data.revenue - data.expenses) / 100,
    }));
  }),
});
