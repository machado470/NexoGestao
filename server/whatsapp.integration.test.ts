import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WhatsAppClient } from "./_core/whatsapp";

describe("WhatsApp Business API Integration", () => {
  let whatsappClient: WhatsAppClient;

  beforeAll(() => {
    // Inicializar cliente com dados de teste
    whatsappClient = new WhatsAppClient({
      accessToken: "test-token",
      businessAccountId: "test-account",
      phoneNumberId: "test-phone",
      webhookVerifyToken: "test-verify-token",
    });
  });

  describe("Webhook Validation", () => {
    it("deve validar webhook com token correto", () => {
      const validation = whatsappClient.validateWebhook(
        "test-verify-token",
        "test-challenge",
        ""
      );

      expect(validation.valid).toBe(true);
      expect(validation.challenge).toBe("test-challenge");
    });

    it("deve rejeitar webhook com token incorreto", () => {
      const validation = whatsappClient.validateWebhook(
        "wrong-token",
        "test-challenge",
        ""
      );

      expect(validation.valid).toBe(false);
    });
  });

  describe("Webhook Processing", () => {
    it("deve processar mensagens recebidas", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "5511999999999",
                    phone_number_id: "test-phone",
                  },
                  messages: [
                    {
                      from: "5511988888888",
                      id: "msg-123",
                      timestamp: "1234567890",
                      type: "text",
                      text: {
                        body: "Olá, tudo bem?",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const processed = whatsappClient.processWebhook(payload as any);

      expect(processed.messages).toHaveLength(1);
      expect(processed.messages[0].from).toBe("5511988888888");
      expect(processed.messages[0].content.text).toBe("Olá, tudo bem?");
      expect(processed.messages[0].type).toBe("text");
    });

    it("deve processar status de entrega", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "5511999999999",
                    phone_number_id: "test-phone",
                  },
                  statuses: [
                    {
                      id: "msg-123",
                      status: "delivered",
                      timestamp: "1234567890",
                      recipient_id: "5511988888888",
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const processed = whatsappClient.processWebhook(payload as any);

      expect(processed.statuses).toHaveLength(1);
      expect(processed.statuses[0].messageId).toBe("msg-123");
      expect(processed.statuses[0].status).toBe("delivered");
    });

    it("deve processar imagens recebidas", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "5511999999999",
                    phone_number_id: "test-phone",
                  },
                  messages: [
                    {
                      from: "5511988888888",
                      id: "msg-123",
                      timestamp: "1234567890",
                      type: "image",
                      image: {
                        id: "img-123",
                        mime_type: "image/jpeg",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const processed = whatsappClient.processWebhook(payload as any);

      expect(processed.messages).toHaveLength(1);
      expect(processed.messages[0].type).toBe("image");
      expect(processed.messages[0].content.imageId).toBe("img-123");
    });

    it("deve processar documentos recebidos", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "5511999999999",
                    phone_number_id: "test-phone",
                  },
                  messages: [
                    {
                      from: "5511988888888",
                      id: "msg-123",
                      timestamp: "1234567890",
                      type: "document",
                      document: {
                        id: "doc-123",
                        mime_type: "application/pdf",
                        filename: "documento.pdf",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const processed = whatsappClient.processWebhook(payload as any);

      expect(processed.messages).toHaveLength(1);
      expect(processed.messages[0].type).toBe("document");
      expect(processed.messages[0].content.filename).toBe("documento.pdf");
    });
  });

  describe("Message Content Extraction", () => {
    it("deve extrair conteúdo de mensagem de texto", () => {
      const msg = {
        from: "5511988888888",
        id: "msg-123",
        timestamp: "1234567890",
        type: "text",
        text: {
          body: "Teste",
        },
      };

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "5511999999999",
                    phone_number_id: "test-phone",
                  },
                  messages: [msg],
                },
              },
            ],
          },
        ],
      };

      const processed = whatsappClient.processWebhook(payload as any);
      expect(processed.messages[0].content.text).toBe("Teste");
    });
  });
});
