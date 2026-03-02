import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCharge,
  getChargesByOrg,
  getChargeById,
  updateCharge,
  deleteCharge,
} from "../db";

export const financeRouter = router({
  // ===== Charges =====
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

    // ===== Statistics =====
    stats: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
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
    revenueByMonth: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
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

      return Object.entries(monthlyRevenue).map(([month, amount]) => ({
        month,
        amount: amount / 100, // Converter de centavos para reais
      }));
    }),
  }),
});
