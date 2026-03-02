import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createReferral,
  getReferralByCode,
  getReferralsByUserId,
  updateReferral,
  getReferralStats,
  createCredit,
  getCreditsByUserId,
  getUserCreditsBalance,
  useCredit,
} from "../db";
import { TRPCError } from "@trpc/server";

export const referralsRouter = router({
  // ===== Generate Referral Code =====
  generateCode: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      // Gerar código único de referral
      const code = `REF-${userId}-${Date.now().toString(36).toUpperCase()}`;

      const referral = await createReferral({
        referrerId: userId,
        referralCode: code,
        status: "pending",
        creditAmount: "0",
      });

      return {
        code,
        referralUrl: `${process.env.VITE_FRONTEND_URL || "http://localhost:3000"}/register?ref=${code}`,
      };
    }),

  // ===== Get User Referrals =====
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const allReferrals = await getReferralsByUserId(userId);
      const total = allReferrals.length;
      const pages = Math.ceil(total / input.limit);
      const start = (input.page - 1) * input.limit;
      const data = allReferrals.slice(start, start + input.limit);

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

  // ===== Get Referral Stats =====
  getStats: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(100),
      })
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      return await getReferralStats(userId);
    }),

  // ===== Claim Credits =====
  claimCredits: protectedProcedure
    .input(
      z.object({
        referralId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const referral = await getReferralByCode("");
      if (!referral || referral.referrerId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Referral not found" });
      }

      if (referral.creditClaimed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Credits already claimed" });
      }

      // Criar crédito para o usuário
      await createCredit({
        userId,
        amount: referral.creditAmount || "0",
        source: "referral",
        sourceId: referral.id,
        description: `Crédito de referência: ${referral.referralCode}`,
      });

      // Marcar referral como claimed
      await updateReferral(input.referralId, { creditClaimed: true });

      return { success: true, creditAmount: referral.creditAmount };
    }),

  // ===== Get User Credits =====
  getCredits: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const allCredits = await getCreditsByUserId(userId);
      const total = allCredits.length;
      const pages = Math.ceil(total / input.limit);
      const start = (input.page - 1) * input.limit;
      const data = allCredits.slice(start, start + input.limit);

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

  // ===== Get Credits Balance =====
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
    }

    return await getUserCreditsBalance(userId);
  }),
});
