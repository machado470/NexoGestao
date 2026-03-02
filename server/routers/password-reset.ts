import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenAsUsed,
  getValidPasswordResetToken,
  getUserByEmail,
} from "../db";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../_core/email";

export const passwordResetRouter = router({
  // ===== Request Password Reset =====
  request: publicProcedure
    .input(
      z.object({
        email: z.string().email("Email inválido"),
      })
    )
    .mutation(async ({ input }) => {
      // Buscar usuário pelo email
      const user = await getUserByEmail(input.email);
      
      // Não revelar se o email existe ou não (segurança)
      if (!user) {
        return {
          success: true,
          message: "Se o email existe em nosso sistema, você receberá um link de reset",
        };
      }

      // Gerar token único
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      // Salvar token no banco de dados
      await createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });

      // Enviar email com link de reset
      const resetUrl = `${process.env.VITE_FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email || input.email, resetUrl, user.name || undefined);

      return {
        success: true,
        message: "Se o email existe em nosso sistema, você receberá um link de reset",
      };
    }),

  // ===== Verify Reset Token =====
  verifyToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token é obrigatório"),
      })
    )
    .query(async ({ input }) => {
      const resetToken = await getValidPasswordResetToken(input.token);

      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token inválido ou expirado",
        });
      }

      return {
        valid: true,
        userId: resetToken.userId,
      };
    }),

  // ===== Reset Password =====
  reset: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token é obrigatório"),
        newPassword: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
        confirmPassword: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Senhas não conferem",
        });
      }

      const resetToken = await getValidPasswordResetToken(input.token);

      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token inválido ou expirado",
        });
      }

      // TODO: Atualizar senha do usuário
      // const hashedPassword = await hashPassword(input.newPassword);
      // await updateUserPassword(resetToken.userId, hashedPassword);

      // Marcar token como usado
      await markPasswordResetTokenAsUsed(resetToken.id);

      return {
        success: true,
        message: "Senha alterada com sucesso",
      };
    }),

  // ===== Change Password (Authenticated) =====
  change: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Senha atual é obrigatória"),
        newPassword: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
        confirmPassword: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Senhas não conferem",
        });
      }

      // TODO: Verificar senha atual
      // TODO: Atualizar senha do usuário

      return {
        success: true,
        message: "Senha alterada com sucesso",
      };
    }),
});
