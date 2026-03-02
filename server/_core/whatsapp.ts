import axios, { AxiosInstance } from "axios";
import crypto from "crypto";

/**
 * WhatsApp Business API Client
 * Integração com a API oficial do WhatsApp Business
 */

interface WhatsAppConfig {
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  apiVersion?: string;
}

interface WhatsAppMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "text" | "image" | "document" | "audio" | "video" | "template";
  text?: {
    preview_url?: boolean;
    body: string;
  };
  image?: {
    link: string;
  };
  document?: {
    link: string;
  };
  audio?: {
    link: string;
  };
  video?: {
    link: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
  };
}

interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: {
            body: string;
          };
          image?: {
            id: string;
            mime_type: string;
          };
          document?: {
            id: string;
            mime_type: string;
            sha256: string;
            filename: string;
          };
          audio?: {
            id: string;
            mime_type: string;
          };
          video?: {
            id: string;
            mime_type: string;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id?: string;
          errors?: Array<{
            code: number;
            title: string;
            message: string;
            error_data: {
              details: string;
            };
          }>;
        }>;
      };
    }>;
  }>;
}

export class WhatsAppClient {
  private client: AxiosInstance;
  private config: WhatsAppConfig;
  private baseUrl: string;

  constructor(config: WhatsAppConfig) {
    this.config = {
      apiVersion: "v18.0",
      ...config,
    };

    this.baseUrl = `https://graph.instagram.com/${this.config.apiVersion}`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Enviar mensagem de texto
   */
  async sendTextMessage(
    recipientPhone: string,
    message: string
  ): Promise<{ messageId: string; status: string }> {
    try {
      const response = await this.client.post(
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }
      );

      return {
        messageId: response.data.messages[0].id,
        status: "sent",
      };
    } catch (error) {
      console.error("Erro ao enviar mensagem WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Enviar imagem
   */
  async sendImageMessage(
    recipientPhone: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ messageId: string; status: string }> {
    try {
      const response = await this.client.post(
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "image",
          image: {
            link: imageUrl,
          },
          caption,
        }
      );

      return {
        messageId: response.data.messages[0].id,
        status: "sent",
      };
    } catch (error) {
      console.error("Erro ao enviar imagem WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Enviar documento
   */
  async sendDocumentMessage(
    recipientPhone: string,
    documentUrl: string,
    filename?: string
  ): Promise<{ messageId: string; status: string }> {
    try {
      const response = await this.client.post(
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "document",
          document: {
            link: documentUrl,
            filename,
          },
        }
      );

      return {
        messageId: response.data.messages[0].id,
        status: "sent",
      };
    } catch (error) {
      console.error("Erro ao enviar documento WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Enviar template de mensagem
   */
  async sendTemplateMessage(
    recipientPhone: string,
    templateName: string,
    languageCode: string = "pt_BR",
    parameters?: string[]
  ): Promise<{ messageId: string; status: string }> {
    try {
      const response = await this.client.post(
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            ...(parameters && {
              components: [
                {
                  type: "body",
                  parameters: parameters.map((param) => ({
                    type: "text",
                    text: param,
                  })),
                },
              ],
            }),
          },
        }
      );

      return {
        messageId: response.data.messages[0].id,
        status: "sent",
      };
    } catch (error) {
      console.error("Erro ao enviar template WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Marcar mensagem como lida
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post(`/${this.config.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      });
    } catch (error) {
      console.error("Erro ao marcar mensagem como lida:", error);
      throw error;
    }
  }

  /**
   * Validar webhook do WhatsApp
   */
  validateWebhook(
    token: string,
    challenge: string,
    signature: string
  ): { valid: boolean; challenge?: string } {
    // Verificar token
    if (token !== this.config.webhookVerifyToken) {
      return { valid: false };
    }

    // Verificar assinatura (opcional, mas recomendado)
    // A assinatura é gerada usando HMAC-SHA256
    // Formato: sha256=<hash>

    return {
      valid: true,
      challenge,
    };
  }

  /**
   * Processar webhook recebido do WhatsApp
   */
  processWebhook(payload: WebhookPayload): {
    messages: Array<{
      from: string;
      messageId: string;
      timestamp: string;
      type: string;
      content: any;
    }>;
    statuses: Array<{
      messageId: string;
      status: string;
      timestamp: string;
      recipientId?: string;
      errors?: any[];
    }>;
  } {
    const messages: any[] = [];
    const statuses: any[] = [];

    payload.entry.forEach((entry) => {
      entry.changes.forEach((change) => {
        const value = change.value;

        // Processar mensagens recebidas
        if (value.messages) {
          value.messages.forEach((msg) => {
            messages.push({
              from: msg.from,
              messageId: msg.id,
              timestamp: msg.timestamp,
              type: msg.type,
              content: this.extractMessageContent(msg),
            });
          });
        }

        // Processar status de entrega
        if (value.statuses) {
          value.statuses.forEach((status) => {
            statuses.push({
              messageId: status.id,
              status: status.status,
              timestamp: status.timestamp,
              recipientId: status.recipient_id,
              errors: status.errors,
            });
          });
        }
      });
    });

    return { messages, statuses };
  }

  /**
   * Extrair conteúdo da mensagem
   */
  private extractMessageContent(msg: any): any {
    switch (msg.type) {
      case "text":
        return {
          text: msg.text?.body,
        };
      case "image":
        return {
          imageId: msg.image?.id,
          mimeType: msg.image?.mime_type,
        };
      case "document":
        return {
          documentId: msg.document?.id,
          mimeType: msg.document?.mime_type,
          filename: msg.document?.filename,
        };
      case "audio":
        return {
          audioId: msg.audio?.id,
          mimeType: msg.audio?.mime_type,
        };
      case "video":
        return {
          videoId: msg.video?.id,
          mimeType: msg.video?.mime_type,
        };
      default:
        return msg;
    }
  }

  /**
   * Obter URL de mídia
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await this.client.get(`/${mediaId}`, {
        params: {
          fields: "url",
        },
      });

      return response.data.url;
    } catch (error) {
      console.error("Erro ao obter URL de mídia:", error);
      throw error;
    }
  }

  /**
   * Download de mídia
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error("Erro ao fazer download de mídia:", error);
      throw error;
    }
  }
}

/**
 * Inicializar cliente WhatsApp
 */
export function initWhatsAppClient(): WhatsAppClient | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!accessToken || !businessAccountId || !phoneNumberId || !webhookVerifyToken) {
    console.warn("WhatsApp Business API não configurado. Verifique as variáveis de ambiente.");
    return null;
  }

  return new WhatsAppClient({
    accessToken,
    businessAccountId,
    phoneNumberId,
    webhookVerifyToken,
  });
}

export const whatsappClient = initWhatsAppClient();
