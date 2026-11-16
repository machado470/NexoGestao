import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'

@Injectable()
export class PaymentRefundsService {
  constructor(private readonly prisma: PrismaService, private readonly timeline: TimelineService) {}

  async record(input: { orgId: string; chargeId: string; paymentIntentId: string; providerRefundId: string; providerEventId: string; amountCents: number; currency: string; refundedAt: Date }) {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || !Number.isFinite(input.refundedAt.getTime())) throw new BadRequestException('Estorno sem valor ou data válidos')
    const result = await this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findFirst({ where: { orgId: input.orgId, chargeId: input.chargeId, externalRef: `stripe:${input.paymentIntentId}`, charge: { orgId: input.orgId } }, include: { charge: true } })
      // Out-of-order refund before settlement must be retried, not acknowledged and lost.
      if (!payment) throw new ServiceUnavailableException('Pagamento do estorno ainda não conciliado. Repetir evento.')
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} AND "orgId" = ${input.orgId} FOR UPDATE`
      const existing = await tx.paymentRefund.findUnique({ where: { providerRefundId: input.providerRefundId } })
      if (existing) {
        if (existing.orgId !== input.orgId || existing.paymentId !== payment.id || existing.amountCents !== input.amountCents || existing.currency.toLowerCase() !== input.currency.toLowerCase()) throw new ConflictException('Referência de estorno divergente')
        if (existing.reversedAt) throw new ConflictException('Estorno revertido exige conciliação antes de nova confirmação')
        return { refund: existing, duplicate: true, event: null, timelineInput: null }
      }
      if (payment.charge.currency.toLowerCase() !== input.currency.toLowerCase()) throw new ConflictException('Moeda do estorno diverge do pagamento')
      const active = await tx.paymentRefund.aggregate({where:{paymentId:payment.id,orgId:input.orgId,reversedAt:null},_sum:{amountCents:true}})
      if ((active._sum.amountCents ?? 0) + input.amountCents > payment.amountCents) throw new ConflictException('Estornos excedem o pagamento original')
      const refund = await tx.paymentRefund.create({ data: { orgId: input.orgId, paymentId: payment.id, providerRefundId: input.providerRefundId, providerEventId: input.providerEventId, amountCents: input.amountCents, currency: input.currency.toUpperCase(), refundedAt: input.refundedAt } })
      const timelineInput = { orgId: input.orgId, action: 'PAYMENT_REFUNDED', description: 'Estorno de pagamento confirmado pelo provedor', customerId: payment.charge.customerId, chargeId: input.chargeId, serviceOrderId: payment.charge.serviceOrderId,
        metadata: { actorUserId: null, provider: 'stripe', refundId: refund.id, providerRefundId: input.providerRefundId, paymentId: payment.id, chargeId: input.chargeId, amountCents: input.amountCents, currency: input.currency.toUpperCase(), refundedAt: input.refundedAt.toISOString() } }
      const event = await this.timeline.logInTransaction(timelineInput, tx)
      await tx.auditEvent.create({ data: { orgId: input.orgId, action: 'PAYMENT_REFUNDED', entityType: 'PAYMENT', entityId: payment.id, context: timelineInput.description, metadata: timelineInput.metadata } })
      return { refund, duplicate: false, event, timelineInput }
    })
    if (result.event && result.timelineInput) await this.timeline.dispatchPersistedEventWebhook(result.timelineInput, result.event.id)
    return { refund: result.refund, duplicate: result.duplicate }
  }
  async reverse(input: { orgId: string; chargeId: string; paymentIntentId: string; providerRefundId: string; providerEventId: string }) {
    const result = await this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findFirst({ where: { orgId: input.orgId, chargeId: input.chargeId, externalRef: `stripe:${input.paymentIntentId}`, charge: { orgId: input.orgId } }, include: { charge: true } })
      if (!payment) throw new ServiceUnavailableException('Pagamento da reversão ainda não conciliado')
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} AND "orgId" = ${input.orgId} FOR UPDATE`
      const refund = await tx.paymentRefund.findUnique({ where: { providerRefundId: input.providerRefundId } })
      if (!refund) return { duplicate: true, event: null, timelineInput: null } // Pending/failed refunds were never booked.
      if (refund.orgId !== input.orgId || refund.paymentId !== payment.id) throw new ConflictException('Reversão vinculada a outro pagamento')
      if (refund.reversedAt) return { duplicate: true, event: null, timelineInput: null }
      // This is the known local reconciliation time, not an invented bank settlement date.
      const reversedAt = new Date()
      await tx.paymentRefund.update({ where: { id: refund.id }, data: { reversedAt, reversalProviderEventId: input.providerEventId } })
      const timelineInput = { orgId: input.orgId, action: 'PAYMENT_REFUND_REVERSED', description: 'Estorno revertido após falha ou cancelamento confirmado pelo provedor', customerId: payment.charge.customerId, chargeId: input.chargeId, serviceOrderId: payment.charge.serviceOrderId,
        metadata: { actorUserId: null, provider: 'stripe', refundId: refund.id, providerRefundId: input.providerRefundId, paymentId: payment.id, chargeId: input.chargeId, amountCents: refund.amountCents, reversedAt: reversedAt.toISOString() } }
      const event = await this.timeline.logInTransaction(timelineInput, tx)
      await tx.auditEvent.create({ data: { orgId: input.orgId, action: 'PAYMENT_REFUND_REVERSED', entityType: 'PAYMENT', entityId: payment.id, context: timelineInput.description, metadata: timelineInput.metadata } })
      return { duplicate: false, event, timelineInput }
    })
    if (result.event && result.timelineInput) await this.timeline.dispatchPersistedEventWebhook(result.timelineInput, result.event.id)
    return { duplicate: result.duplicate }
  }

}
