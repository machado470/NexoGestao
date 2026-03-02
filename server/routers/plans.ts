import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getAllPlans,
  getPlanById,
  getPlanByName,
  getSubscriptionByOrg,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getActivePlan,
  createTransaction,
  getTransactionsByOrg,
  getPlanUsage,
  updatePlanUsage,
} from "../db";

export const plansRouter = router({
  // Get all available plans (public)
  listAll: publicProcedure.query(async () => {
    return await getAllPlans();
  }),

  // Get plan by ID
  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      return await getPlanById(input.id);
    }),

  // Get plan by name
  getByName: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return await getPlanByName(input.name);
    }),

  // Get current subscription for organization
  getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getSubscriptionByOrg(ctx.user.organizationId);
    if (!subscription) {
      // Return free plan subscription
      const freePlan = await getPlanByName("free");
      return {
        id: 0,
        organizationId: ctx.user.organizationId,
        planId: freePlan?.id || 1,
        status: "active",
        startDate: new Date(),
        endDate: null,
        autoRenew: true,
        billingCycle: "monthly",
        plan: freePlan,
      };
    }
    const plan = await getPlanById(subscription.planId);
    return { ...subscription, plan };
  }),

  // Get active plan for organization
  getActivePlan: protectedProcedure.query(async ({ ctx }) => {
    return await getActivePlan(ctx.user.organizationId);
  }),

  // Upgrade to plan
  upgrade: protectedProcedure
    .input(
      z.object({
        planId: z.number().int(),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
        useReferralCredits: z.number().optional(), // Amount of referral credits to use
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getPlanById(input.planId);
      if (!plan) throw new Error("Plan not found");

      // Calculate price
      const price =
        input.billingCycle === "yearly"
          ? Number(plan.priceYearly || plan.priceMonthly)
          : Number(plan.priceMonthly);

      // Apply referral credits discount
      let finalPrice = price;
      if (input.useReferralCredits && input.useReferralCredits > 0) {
        finalPrice = Math.max(0, price - input.useReferralCredits);
      }

      // Create or update subscription
      const existingSubscription = await getSubscriptionByOrg(
        ctx.user.organizationId
      );

      const startDate = new Date();
      const endDate = new Date();
      if (input.billingCycle === "monthly") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      let subscription;
      if (existingSubscription) {
        subscription = await updateSubscription(existingSubscription.id, {
          planId: input.planId,
          status: "active",
          startDate,
          endDate,
          billingCycle: input.billingCycle,
          autoRenew: true,
        });
      } else {
        subscription = await createSubscription({
          organizationId: ctx.user.organizationId,
          planId: input.planId,
          status: "active",
          startDate,
          endDate,
          billingCycle: input.billingCycle,
          autoRenew: true,
        });
      }

      // Create transaction record
      if (finalPrice > 0) {
        await createTransaction({
          organizationId: ctx.user.organizationId,
          subscriptionId: subscription.id,
          amount: finalPrice,
          currency: "BRL",
          status: "completed",
          paymentMethod: input.useReferralCredits ? "credit" : "pending",
          description: `Upgrade to ${plan.displayName} (${input.billingCycle})`,
        });
      }

      return subscription;
    }),

  // Cancel subscription
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await getSubscriptionByOrg(ctx.user.organizationId);
    if (!subscription) throw new Error("No active subscription");

    return await cancelSubscription(subscription.id);
  }),

  // Get usage for current plan
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const usage = await getPlanUsage(ctx.user.organizationId);
    const plan = await getActivePlan(ctx.user.organizationId);

    if (!usage) {
      return {
        clientsCount: 0,
        appointmentsCount: 0,
        serviceOrdersCount: 0,
        chargesCount: 0,
        peopleCount: 0,
        plan,
        limits: {
          maxClients: plan?.maxClients || -1,
          maxAppointments: plan?.maxAppointments || -1,
          maxServiceOrders: plan?.maxServiceOrders || -1,
          maxCharges: plan?.maxCharges || -1,
          maxPeople: plan?.maxPeople || -1,
        },
      };
    }

    return {
      ...usage,
      plan,
      limits: {
        maxClients: plan?.maxClients || -1,
        maxAppointments: plan?.maxAppointments || -1,
        maxServiceOrders: plan?.maxServiceOrders || -1,
        maxCharges: plan?.maxCharges || -1,
        maxPeople: plan?.maxPeople || -1,
      },
    };
  }),

  // Check if feature is available
  hasFeature: protectedProcedure
    .input(z.object({ feature: z.string() }))
    .query(async ({ ctx, input }) => {
      const plan = await getActivePlan(ctx.user.organizationId);
      if (!plan) return false;

      const features = Array.isArray(plan.features)
        ? plan.features
        : JSON.parse(plan.features || "[]");
      return features.includes(input.feature);
    }),

  // Get transactions
  getTransactions: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const transactions = await getTransactionsByOrg(ctx.user.organizationId);
      const total = transactions.length;
      const offset = (input.page - 1) * input.limit;

      return {
        data: transactions.slice(offset, offset + input.limit),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          pages: Math.ceil(total / input.limit),
        },
      };
    }),
});
