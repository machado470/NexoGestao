import { Injectable } from '@nestjs/common'
import { WhatsAppEntityType, WhatsAppMessageType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { WhatsAppService } from './whatsapp.service'

@Injectable()
export class WhatsAppAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly timeline: TimelineService,
  ) {}

  async sendAppointmentConfirmation(orgId: string, appointmentId: string) {
    return this.sendFromEntity(orgId, 'APPOINTMENT', appointmentId, 'APPOINTMENT_CONFIRMATION', 'APPOINTMENT_CONFIRMATION_SENT')
  }

  async sendAppointmentReminder(orgId: string, appointmentId: string) {
    return this.sendFromEntity(orgId, 'APPOINTMENT', appointmentId, 'APPOINTMENT_REMINDER', 'APPOINTMENT_REMINDER_SENT')
  }

  async sendPaymentReminder(orgId: string, chargeId: string) {
    return this.sendFromEntity(orgId, 'CHARGE', chargeId, 'PAYMENT_REMINDER', 'PAYMENT_REMINDER_SENT')
  }

  async sendPaymentLink(orgId: string, chargeId: string) {
    return this.sendFromEntity(orgId, 'CHARGE', chargeId, 'PAYMENT_LINK', 'PAYMENT_LINK_SENT')
  }

  async sendPaymentConfirmation(orgId: string, paymentId: string) {
    return this.sendFromEntity(orgId, 'PAYMENT', paymentId, 'PAYMENT_CONFIRMATION', 'WHATSAPP_MESSAGE_SENT')
  }

  async sendServiceUpdate(orgId: string, serviceOrderId: string) {
    return this.sendFromEntity(orgId, 'SERVICE_ORDER', serviceOrderId, 'SERVICE_UPDATE', 'WHATSAPP_MESSAGE_SENT')
  }

  private async sendFromEntity(
    orgId: string,
    entityType: WhatsAppEntityType,
    entityId: string,
    messageType: WhatsAppMessageType,
    timelineAction: string,
  ) {
    const data = await this.resolveEntity(orgId, entityType, entityId)
    if (!data?.customer?.phone) return null

    const content = `Mensagem automática ${messageType} para ${data.customer.name}`
    const message = await this.whatsapp.enqueueMessage(orgId, {
      customerId: data.customer.id,
      toPhone: data.customer.phone,
      entityType,
      entityId,
      messageType,
      content,
    })

    await this.timeline.log({
      orgId,
      action: timelineAction,
      customerId: data.customer.id,
      metadata: {
        messageId: message.message?.id ?? null,
        entityType,
        entityId,
        status: message.message?.status ?? 'QUEUED',
        messageType,
      },
    }).catch(() => null)

    return message
  }

  private async resolveEntity(orgId: string, entityType: WhatsAppEntityType, entityId: string) {
    if (entityType === 'APPOINTMENT') {
      const appointment = await this.prisma.appointment.findFirst({ where: { orgId, id: entityId }, include: { customer: true } })
      return appointment ? { customer: appointment.customer } : null
    }

    if (entityType === 'SERVICE_ORDER') {
      const serviceOrder = await this.prisma.serviceOrder.findFirst({ where: { orgId, id: entityId }, include: { customer: true } })
      return serviceOrder ? { customer: serviceOrder.customer } : null
    }

    if (entityType === 'CHARGE') {
      const charge = await this.prisma.charge.findFirst({ where: { orgId, id: entityId }, include: { customer: true } })
      return charge ? { customer: charge.customer } : null
    }

    if (entityType === 'PAYMENT') {
      const payment = await this.prisma.payment.findFirst({ where: { orgId, id: entityId }, include: { charge: { include: { customer: true } } } })
      return payment ? { customer: payment.charge.customer } : null
    }

    return null
  }
}
