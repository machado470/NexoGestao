import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createServiceTracking,
  getServiceTrackingByOrg,
  getServiceTrackingById,
  getServiceTrackingByCollaborator,
  getServiceTrackingByServiceOrder,
  updateServiceTracking,
  deleteServiceTracking,
  createDiscount,
  getDiscountsByServiceTracking,
  getDiscountById,
  deleteDiscount,
  calculateCollaboratorEarnings,
} from "../db";

export const serviceTrackingRouter = router({
  // Create service tracking
  create: protectedProcedure
    .input(
      z.object({
        serviceOrderId: z.number(),
        collaboratorId: z.number(),
        startTime: z.date(),
        hourlyRate: z.number().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.org) throw new Error("Organization not found");
      const tracking = await createServiceTracking({
        organizationId: ctx.org.id,
        serviceOrderId: input.serviceOrderId,
        collaboratorId: input.collaboratorId,
        startTime: input.startTime,
        hourlyRate: input.hourlyRate.toString(),
        status: "started" as const,
      });
      return tracking;
    }),

  // List all service tracking for organization
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.org) throw new Error("Organization not found");
    return await getServiceTrackingByOrg(ctx.org.id);
  }),

  // Get service tracking by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getServiceTrackingById(input.id);
    }),

  // Get service tracking by collaborator
  getByCollaborator: protectedProcedure
    .input(z.object({ collaboratorId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.org) throw new Error("Organization not found");
      return await getServiceTrackingByCollaborator(ctx.org.id, input.collaboratorId);
    }),

  // Get service tracking by service order
  getByServiceOrder: protectedProcedure
    .input(z.object({ serviceOrderId: z.number() }))
    .query(async ({ input }) => {
      return await getServiceTrackingByServiceOrder(input.serviceOrderId);
    }),

  // Update service tracking (end time, status, calculate hours and amount)
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        endTime: z.date().optional(),
        status: z.enum(["started", "paused", "completed", "canceled"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const tracking = await getServiceTrackingById(input.id);
      if (!tracking) throw new Error("Service tracking not found");

      const updateData: any = {};

      if (input.endTime) {
        updateData.endTime = input.endTime;
        // Calculate hours worked
        const startTime = new Date(tracking.startTime).getTime();
        const endTime = new Date(input.endTime).getTime();
        const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
        updateData.hoursWorked = hoursWorked.toString();

        // Calculate amount earned
        const hourlyRate = parseFloat(tracking.hourlyRate || "0");
        const amountEarned = hoursWorked * hourlyRate;
        updateData.amountEarned = amountEarned.toString();
      }

      if (input.status) {
        updateData.status = input.status;
      }

      return await updateServiceTracking(input.id, updateData);
    }),

  // Delete service tracking
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await deleteServiceTracking(input.id);
    }),

  // Add discount to service tracking
  addDiscount: protectedProcedure
    .input(
      z.object({
        serviceTrackingId: z.number(),
        reason: z.string(),
        amount: z.number().optional(),
        percentage: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.org) throw new Error("Organization not found");
      const tracking = await getServiceTrackingById(input.serviceTrackingId);
      if (!tracking) throw new Error("Service tracking not found");

      // Calculate discount amount
      let discountAmount = input.amount;
      if (input.percentage && !input.amount) {
        const earned = parseFloat(tracking.amountEarned || "0");
        discountAmount = (earned * input.percentage) / 100;
      }

      const discount = await createDiscount({
        organizationId: ctx.org.id,
        serviceTrackingId: input.serviceTrackingId,
        reason: input.reason,
        amount: discountAmount?.toString(),
        percentage: input.percentage?.toString(),
        approvedBy: ctx.user?.id || undefined,
      });

      // Update amountEarned in service tracking
      const currentEarned = parseFloat(tracking.amountEarned || "0");
      const newEarned = currentEarned - (discountAmount || 0);
      if (newEarned >= 0) {
        await updateServiceTracking(input.serviceTrackingId, {
          amountEarned: newEarned.toString(),
        });
      }

      return discount;
    }),

  // Get discounts for service tracking
  getDiscounts: protectedProcedure
    .input(z.object({ serviceTrackingId: z.number() }))
    .query(async ({ input }) => {
      return await getDiscountsByServiceTracking(input.serviceTrackingId);
    }),

  // Remove discount
  removeDiscount: protectedProcedure
    .input(z.object({ discountId: z.number() }))
    .mutation(async ({ input }) => {
      const discount = await getDiscountById(input.discountId);
      if (!discount) throw new Error("Discount not found");

      // Restore amountEarned in service tracking
      const tracking = await getServiceTrackingById(discount.serviceTrackingId);
      if (tracking) {
        const currentEarned = parseFloat(tracking.amountEarned || "0");
        const discountAmount = parseFloat(discount.amount || "0");
        const newEarned = currentEarned + discountAmount;
        await updateServiceTracking(discount.serviceTrackingId, {
          amountEarned: newEarned.toString(),
        });
      }

      return await deleteDiscount(input.discountId);
    }),

  // Calculate collaborator earnings
  calculateEarnings: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.org) throw new Error("Organization not found");
      return await calculateCollaboratorEarnings(
        ctx.org.id,
        input.collaboratorId,
        input.startDate,
        input.endDate
      );
    }),
});
