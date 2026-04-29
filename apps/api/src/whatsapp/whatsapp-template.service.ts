import { Injectable, Logger } from '@nestjs/common'
import { WhatsAppMessageType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { renderTemplate } from './template.util'

const DEFAULT_TEMPLATES: Array<{ key: string; name: string; messageType: WhatsAppMessageType; content: string }> = [
  { key: 'appointment_confirmation', name: 'Confirmação de agendamento', messageType: 'APPOINTMENT_CONFIRMATION', content: 'Olá {{customerName}}, seu agendamento foi confirmado para {{appointmentDate}} às {{appointmentTime}}.' },
  { key: 'appointment_reminder', name: 'Lembrete de agendamento', messageType: 'APPOINTMENT_REMINDER', content: 'Lembrete: {{customerName}}, seu atendimento é em {{appointmentDate}} às {{appointmentTime}}.' },
  { key: 'payment_reminder', name: 'Lembrete de pagamento', messageType: 'PAYMENT_REMINDER', content: 'Olá {{customerName}}, identificamos cobrança de {{chargeAmount}} com vencimento em {{chargeDueDate}}.' },
  { key: 'payment_link', name: 'Link de pagamento', messageType: 'PAYMENT_LINK', content: 'Olá {{customerName}}, seu link de pagamento: {{paymentLink}}.' },
  { key: 'payment_confirmation', name: 'Confirmação de pagamento', messageType: 'PAYMENT_CONFIRMATION', content: 'Pagamento confirmado. Obrigado, {{customerName}}.' },
  { key: 'service_update', name: 'Atualização de serviço', messageType: 'SERVICE_UPDATE', content: 'Atualização da O.S. {{serviceOrderNumber}}: {{companyName}} recebeu seu retorno.' },
  { key: 'manual_followup', name: 'Follow-up manual', messageType: 'MANUAL', content: 'Olá {{customerName}}, seguimos acompanhando seu atendimento.' },
]

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name)

  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultTemplates(orgId: string) {
    for (const template of DEFAULT_TEMPLATES) {
      await this.prisma.whatsAppTemplate.upsert({
        where: { orgId_key: { orgId, key: template.key } },
        create: {
          orgId,
          key: template.key,
          name: template.name,
          messageType: template.messageType,
          body: template.content,
          content: template.content,
          isActive: true,
        },
        update: {
          name: template.name,
          messageType: template.messageType,
          content: template.content,
          body: template.content,
          isActive: true,
        },
      })
    }
  }

  async renderTemplate(orgId: string, templateKey: string, context: Record<string, unknown>) {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { orgId, key: templateKey, isActive: true },
    })

    if (!template) {
      throw new Error(`Template não encontrado: ${templateKey}`)
    }

    const source = template.content ?? template.body
    const rendered = renderTemplate(source, context)
    for (const variable of rendered.missingVariables) {
      this.logger.warn(`Variável ausente no template ${templateKey}: ${variable}`)
    }

    return {
      template,
      content: rendered.content,
      missingVariables: rendered.missingVariables,
    }
  }
}
