import { Injectable } from '@nestjs/common'
import { ChargeStatus, OperationalStateValue } from '@prisma/client'
import { CustomersService } from '../customers/customers.service'
import { AppointmentsService } from '../appointments/appointments.service'
import { ServiceOrdersService } from '../service-orders/service-orders.service'
import { FinanceService } from '../finance/finance.service'
import { PrismaService } from '../prisma/prisma.service'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { RiskService } from '../risk/risk.service'
import { EnforcementEngineService } from '../governance/enforcement-engine.service'
import { GovernanceRunService } from '../governance/governance-run.service'

@Injectable()
export class DemoService {
  constructor(
    private readonly customers: CustomersService,
    private readonly appointments: AppointmentsService,
    private readonly serviceOrders: ServiceOrdersService,
    private readonly finance: FinanceService,
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly risk: RiskService,
    private readonly enforcementEngine: EnforcementEngineService,
    private readonly governanceRun: GovernanceRunService,
  ) {}

  async bootstrapLiveEnvironment(params: {
    orgId: string
    actorUserId: string | null
    actorPersonId: string | null
  }) {
    const now = new Date()
    const stamp = now.toISOString().slice(11, 19).replace(/:/g, '')

    const customer = await this.customers.create({
      orgId: params.orgId,
      createdBy: params.actorUserId,
      personId: params.actorPersonId,
      name: `Cliente Demo Oficial ${stamp}`,
      phone: '+5547999999999',
      email: `demo.oficial+${stamp}@nexogestao.app`,
      notes:
        'Gerado pelo bootstrap oficial para narrativa ponta a ponta (agenda → execução → cobrança → pagamento).',
    })

    const startsAt = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)

    const appointment = await this.appointments.create({
      orgId: params.orgId,
      createdBy: params.actorUserId,
      personId: params.actorPersonId,
      customerId: customer.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: 'CONFIRMED',
      notes: 'Agendamento confirmado automaticamente pelo bootstrap oficial.',
    })

    const amountCents = 18900
    const dueDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const serviceOrder = await this.serviceOrders.create({
      orgId: params.orgId,
      createdBy: params.actorUserId,
      personId: params.actorPersonId,
      customerId: customer.id,
      appointmentId: appointment.id,
      title: 'Troca de peça e revisão preventiva (demo oficial)',
      description:
        'Ordem criada pelo bootstrap oficial para provar encadeamento operacional e financeiro.',
      priority: 4,
      amountCents,
      dueDate: dueDate.toISOString(),
    })

    await this.serviceOrders.update({
      orgId: params.orgId,
      updatedBy: params.actorUserId,
      personId: params.actorPersonId,
      id: serviceOrder.id,
      data: {
        status: 'DONE',
      },
    })

    const ensuredCharge = await this.serviceOrders.generateCharge({
      orgId: params.orgId,
      actorUserId: params.actorUserId,
      serviceOrderId: serviceOrder.id,
      amountCents,
      dueDate: dueDate.toISOString(),
    })

    let chargeId = ensuredCharge.chargeId ?? null

    if (!chargeId) {
      const fallbackCharge = await this.prisma.charge.findFirst({
        where: {
          orgId: params.orgId,
          serviceOrderId: serviceOrder.id,
          status: { in: [ChargeStatus.PENDING, ChargeStatus.OVERDUE, ChargeStatus.PAID] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })

      chargeId = fallbackCharge?.id ?? null
    }

    if (!chargeId) {
      throw new Error('Falha ao gerar cobrança no bootstrap oficial.')
    }

    await this.finance.payCharge({
      orgId: params.orgId,
      chargeId,
      amountCents,
      method: 'PIX',
      actorUserId: params.actorUserId,
    })

    await this.whatsapp.enqueueMessage({
      orgId: params.orgId,
      customerId: customer.id,
      toPhone: customer.phone,
      entityType: 'CHARGE',
      entityId: chargeId,
      messageType: 'PAYMENT_REMINDER',
      messageKey: `demo-official-payment:${params.orgId}:${chargeId}`,
      renderedText:
        'Demo oficial: pagamento registrado com sucesso. Timeline, risco e governança foram atualizados.',
    })

    const customerRisk = await this.risk.recalculateCustomerOperationalRisk(
      params.orgId,
      customer.id,
      'DEMO_BOOTSTRAP_OFFICIAL',
    )

    this.governanceRun.startRun(params.orgId)
    const engineResult = await this.enforcementEngine.runForOrg(params.orgId)

    const agg = await this.prisma.person.aggregate({
      where: { orgId: params.orgId, active: true },
      _avg: { operationalRiskScore: true },
    })

    const institutionalRiskScore = Math.min(
      100,
      Math.max(0, Math.round(agg._avg.operationalRiskScore ?? 0)),
    )

    const openCorrectivesCount = await this.prisma.correctiveAction.count({
      where: {
        status: 'OPEN',
        person: { orgId: params.orgId },
      },
    })

    const governance = await this.governanceRun.finishWithAggregates({
      orgId: params.orgId,
      evaluated: engineResult.evaluated,
      warnings: engineResult.warnings,
      correctives: engineResult.correctivesCreated,
      institutionalRiskScore,
      restrictedCount: engineResult.restrictedCount,
      suspendedCount: engineResult.suspendedCount,
      openCorrectivesCount,
    })

    const persistedCharge = await this.prisma.charge.findUnique({
      where: { id: chargeId },
      select: { status: true, paidAt: true },
    })

    const personState = await this.prisma.person.findFirst({
      where: { orgId: params.orgId, id: params.actorPersonId ?? undefined },
      select: { operationalState: true, operationalRiskScore: true },
    })

    return {
      customerId: customer.id,
      appointmentId: appointment.id,
      serviceOrderId: serviceOrder.id,
      chargeId,
      chain: {
        serviceOrderStatus: 'DONE',
        chargeStatus: persistedCharge?.status ?? 'PAID',
        paidAt: persistedCharge?.paidAt ?? new Date(),
        customerRiskScore: customerRisk.score,
        governanceScore: governance.institutionalRiskScore,
        operationalState:
          (personState?.operationalState as OperationalStateValue | undefined) ??
          OperationalStateValue.NORMAL,
        operationalRiskScore: Number(personState?.operationalRiskScore ?? 0),
      },
    }
  }
}
