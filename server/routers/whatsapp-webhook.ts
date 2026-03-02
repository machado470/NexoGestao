import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { whatsappClient } from "../_core/whatsapp";
import { getDb } from "../db";
import { whatsappMessages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Router para webhooks do WhatsApp Business API
 * Recebe mensagens, status de entrega e outros eventos
 */

export const whatsappWebhookRouter = router({
  /**
   * GET /api/trpc/whatsapp-webhook.verify
   * Validar webhook do WhatsApp
   */
  verify: publicProcedure
    .input(
      z.object({
        "hub.mode": z.string(),
        "hub.challenge": z.string(),
        "hub.verify_token": z.string(),
      })
    )
    .query(async ({ input }) => {
      if (!whatsappClient) {
        return {
          error: "WhatsApp não configurado",
        };
      }

      const validation = whatsappClient.validateWebhook(
        input["hub.verify_token"],
        input["hub.challenge"],
        ""
      );

      if (!validation.valid) {
        return {
          error: "Token inválido",
        };
      }

      return {
        challenge: validation.challenge,
      };
    }),

  /**
   * POST /api/trpc/whatsapp-webhook.receive
   * Receber webhooks do WhatsApp
   */
  receive: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      if (!whatsappClient) {
        return {
          error: "WhatsApp não configurado",
        };
      }

      try {
        const payload = input;
        const processed = whatsappClient.processWebhook(payload);

        const db = await getDb();
        if (!db) {
          return { error: "Banco de dados não disponível" };
        }

        // Processar mensagens recebidas
        for (const message of processed.messages) {
          // Encontrar cliente pelo número de telefone
          const customerPhone = message.from;

          // Salvar mensagem no banco
          await db.insert(whatsappMessages).values({
            organizationId: 1,
            customerId: 1,
            messageId: message.messageId,
            direction: "inbound",
            content: message.content.text || JSON.stringify(message.content),
            status: "delivered",
            senderNumber: message.from,
            receiverNumber: "",
            mediaUrl: null,
            createdAt: new Date(parseInt(message.timestamp) * 1000),
            updatedAt: new Date(),
          });

          // Log removido para produção
        }

        // Processar status de entrega
        for (const status of processed.statuses) {
          // Atualizar status da mensagem no banco
          if (db) {
            const statusMap: Record<string, "pending" | "sent" | "delivered" | "read" | "failed"> = {
              sent: "sent",
              delivered: "delivered",
              read: "read",
              failed: "failed",
            };
            const mappedStatus = statusMap[status.status] || "sent";
            await db
              .update(whatsappMessages)
              .set({
                status: mappedStatus,
                updatedAt: new Date(parseInt(status.timestamp) * 1000),
              })
              .where(eq(whatsappMessages.messageId, status.messageId));
          }

          // Log removido para produção
        }

        return {
          success: true,
          messagesProcessed: processed.messages.length,
          statusesProcessed: processed.statuses.length,
        };
      } catch (error) {
        console.error("Erro ao processar webhook WhatsApp:", error);
        return {
          error: "Erro ao processar webhook",
        };
      }
    }),

  /**
   * POST /api/trpc/whatsapp-webhook.sendMessage
   * Enviar mensagem via WhatsApp
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        recipientPhone: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (!whatsappClient) {
        return {
          error: "WhatsApp não configurado",
        };
      }

      try {
        const result = await whatsappClient.sendTextMessage(
          input.recipientPhone,
          input.message
        );

        const db = await getDb();
        const db4 = await getDb();
        if (!db4) {
          return { error: "Banco de dados não disponível" };
        }

        // Salvar mensagem no banco
        await db4.insert(whatsappMessages).values({
          organizationId: 1,
          customerId: input.customerId,
          messageId: result.messageId,
          direction: "outbound",
          content: input.message,
          status: "sent" as const,
          senderNumber: "",
          receiverNumber: input.recipientPhone,
          mediaUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Log removido para produção

        return {
          success: true,
          messageId: result.messageId,
          status: result.status,
        };
      } catch (error) {
        console.error("Erro ao enviar mensagem WhatsApp:", error);
        return {
          error: "Erro ao enviar mensagem",
        };
      }
    }),

  /**
   * POST /api/trpc/whatsapp-webhook.sendImage
   * Enviar imagem via WhatsApp
   */
  sendImage: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        recipientPhone: z.string(),
        imageUrl: z.string(),
        caption: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!whatsappClient) {
        return {
          error: "WhatsApp não configurado",
        };
      }

      try {
        const result = await whatsappClient.sendImageMessage(
          input.recipientPhone,
          input.imageUrl,
          input.caption
        );

        const db2 = await getDb();
        if (!db2) {
          return { error: "Banco de dados não disponível" };
        }

        // Salvar mensagem no banco
        await db2.insert(whatsappMessages).values({
          organizationId: 1,
          customerId: input.customerId,
          messageId: result.messageId,
          direction: "outbound",
          content: `[Imagem] ${input.caption || ""}`,
          status: "sent",
          senderNumber: "",
          receiverNumber: input.recipientPhone,
          mediaUrl: input.imageUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          messageId: result.messageId,
          status: result.status,
        };
      } catch (error) {
        console.error("Erro ao enviar imagem WhatsApp:", error);
        return {
          error: "Erro ao enviar imagem",
        };
      }
    }),

  /**
   * POST /api/trpc/whatsapp-webhook.sendDocument
   * Enviar documento via WhatsApp
   */
  sendDocument: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        recipientPhone: z.string(),
        documentUrl: z.string(),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!whatsappClient) {
        return {
          error: "WhatsApp não configurado",
        };
      }

      try {
        const result = await whatsappClient.sendDocumentMessage(
          input.recipientPhone,
          input.documentUrl,
          input.filename
        );

        const db3 = await getDb();
        if (!db3) {
          return { error: "Banco de dados não disponível" };
        }

        // Salvar mensagem no banco
        await db3.insert(whatsappMessages).values({
          organizationId: 1,
          customerId: input.customerId,
          messageId: result.messageId,
          direction: "outbound",
          content: `[Documento] ${input.filename || ""}`,
          status: "sent",
          senderNumber: "",
          receiverNumber: input.recipientPhone,
          mediaUrl: input.documentUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          messageId: result.messageId,
          status: result.status,
        };
      } catch (error) {
        console.error("Erro ao enviar documento WhatsApp:", error);
        return {
          error: "Erro ao enviar documento",
        };
      }
    }),

  /**
   * POST /api/trpc/whatsapp-webhook.sendTemplate
   * Enviar template de mensagem via WhatsApp
   */
  sendTemplate: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        recipientPhone: z.string(),
        templateName: z.string(),
        languageCode: z.string().optional(),
        parameters: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!whatsappClient) {
        return {
          error: "WhatsApp não configurado",
        };
      }

      try {
        const result = await whatsappClient.sendTemplateMessage(
          input.recipientPhone,
          input.templateName,
          input.languageCode,
          input.parameters
        );

        const db4 = await getDb();
        if (!db4) {
          return { error: "Banco de dados não disponível" };
        }

        // Salvar mensagem no banco
        await db4.insert(whatsappMessages).values({
          organizationId: 1,
          customerId: input.customerId,
          messageId: result.messageId,
          direction: "outbound",
          content: `[Template] ${input.templateName}`,
          status: "sent" as const,
          senderNumber: "",
          receiverNumber: input.recipientPhone,
          mediaUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          messageId: result.messageId,
          status: result.status,
        };
      } catch (error) {
        console.error("Erro ao enviar template WhatsApp:", error);
        return {
          error: "Erro ao enviar template",
        };
      }
    }),

  /**
   * POST /api/trpc/whatsapp-webhook.markAsRead
   * Marcar mensagem como lida
   */
  markAsRead: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (!whatsappClient) {
        return {
          error: "WhatsApp não configurado",
        };
      }

      try {
        await whatsappClient.markAsRead(input.messageId);

        return {
          success: true,
        };
      } catch (error) {
        console.error("Erro ao marcar mensagem como lida:", error);
        return {
          error: "Erro ao marcar mensagem como lida",
        };
      }
    }),
});
