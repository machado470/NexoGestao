import { Injectable } from '@nestjs/common'
import { ChargeStatus, ServiceOrderStatus, WhatsAppMessageStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class WhatsAppContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalContext(orgId: string, customerId: string) {
    const [customer, nextAppointment, activeServiceOrder, openCharge, lastInteraction] = await Promise.all([
      this.prisma.customer.findFirst({ where: { orgId, id: customerId }, select: { id: true, name: true, phone: true, active: true } }),
      this.prisma.appointment.findFirst({
        where: { orgId, customerId, startsAt: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.serviceOrder.findFirst({
        where: { orgId, customerId, status: { in: [ServiceOrderStatus.OPEN, ServiceOrderStatus.ASSIGNED, ServiceOrderStatus.IN_PROGRESS] } },
        orderBy: { updatedAt: 'desc' },
        include: { assignedTo: { select: { id: true, name: true } } },
      }),
      this.prisma.charge.findFirst({
        where: { orgId, customerId, status: { in: [ChargeStatus.PENDING, ChargeStatus.OVERDUE] } },
        orderBy: [{ status: 'desc' }, { dueDate: 'asc' }],
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { orgId, customerId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, direction: true, status: true, createdAt: true },
      }),
    ])

    const now = Date.now()
    const daysOverdue = openCharge && openCharge.dueDate
      ? Math.max(0, Math.floor((now - openCharge.dueDate.getTime()) / 86_400_000))
      : null

    const suggestedAction = this.pickSuggestedAction({ openCharge, nextAppointment, activeServiceOrder, lastInteraction })

    return {
      customer: customer
        ? { id: customer.id, name: customer.name, phone: customer.phone, status: customer.active ? 'ACTIVE' : 'INACTIVE' }
        : null,
      nextAppointment: nextAppointment
        ? {
            id: nextAppointment.id,
            scheduledAt: nextAppointment.startsAt,
            status: nextAppointment.status,
            serviceName: nextAppointment.notes ?? null,
            notes: nextAppointment.notes ?? null,
          }
        : null,
      activeServiceOrder: activeServiceOrder
        ? {
            id: activeServiceOrder.id,
            code: activeServiceOrder.id,
            number: activeServiceOrder.id,
            status: activeServiceOrder.status,
            technician: activeServiceOrder.assignedTo?.name ?? null,
            responsible: activeServiceOrder.assignedTo?.name ?? null,
          }
        : null,
      openCharge: openCharge
        ? {
            id: openCharge.id,
            amount: openCharge.amountCents,
            dueDate: openCharge.dueDate,
            status: openCharge.status,
            daysOverdue,
          }
        : null,
      lastInteraction: lastInteraction
        ? {
            messageId: lastInteraction.id,
            direction: lastInteraction.direction,
            status: lastInteraction.status,
            createdAt: lastInteraction.createdAt,
          }
        : null,
      suggestedAction,
    }
  }

  private pickSuggestedAction(input: {
    openCharge: any
    nextAppointment: any
    activeServiceOrder: any
    lastInteraction: { status: WhatsAppMessageStatus } | null
  }) {
    if (input.lastInteraction?.status === 'FAILED') {
      return { type: 'RETRY_FAILED_MESSAGE', label: 'Reenviar mensagem', reason: 'Último envio falhou', entityType: 'GENERAL', entityId: null }
    }

    if (input.openCharge?.status === 'OVERDUE') {
      return { type: 'SEND_PAYMENT_REMINDER', label: 'Enviar lembrete', reason: 'Cobrança vencida', entityType: 'CHARGE', entityId: input.openCharge.id }
    }

    if (input.openCharge?.status === 'PENDING') {
      return { type: 'SEND_PAYMENT_LINK', label: 'Enviar link de pagamento', reason: 'Cobrança pendente', entityType: 'CHARGE', entityId: input.openCharge.id }
    }

    if (input.nextAppointment) {
      return { type: 'CONFIRM_APPOINTMENT', label: 'Confirmar agendamento', reason: 'Agendamento futuro pendente de contato', entityType: 'APPOINTMENT', entityId: input.nextAppointment.id }
    }

    if (input.activeServiceOrder) {
      return { type: 'UPDATE_SERVICE_STATUS', label: 'Atualizar status da O.S.', reason: 'Ordem de serviço ativa', entityType: 'SERVICE_ORDER', entityId: input.activeServiceOrder.id }
    }

    return { type: 'NONE', label: 'Sem ação', reason: 'Nenhuma ação sugerida no momento', entityType: 'GENERAL', entityId: null }
  }
}
