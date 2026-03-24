import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TemporalRiskService } from './temporal-risk.service'
import { TimelineService } from '../timeline/timeline.service'

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporalRisk: TemporalRiskService,
    private readonly timeline: TimelineService,
  ) {}

  /**
   * 🔹 Apenas cálculo simples (compatível com o que já existia)
   */
  async calculatePersonRisk(personId: string) {
    return this.temporalRisk.calculate(personId)
  }

  /**
   * 🔥 NOVO: cálculo completo com explicação (base do frontend inteligente)
   */
  async getPersonRiskExplanation(personId: string) {
    const detailed = await this.temporalRisk.calculateDetailed(personId)

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        name: true,
        riskScore: true,
        operationalState: true,
      },
    })

    if (!person) {
      throw new Error('Pessoa não encontrada')
    }

    return {
      person,
      risk: detailed,
    }
  }

  /**
   * 🔹 Recalcula + persiste
   */
  async recalculatePersonRisk(personId: string, reason?: string) {
    const detailed = await this.temporalRisk.calculateDetailed(personId)

    await this.prisma.person.update({
      where: { id: personId },
      data: {
        riskScore: detailed.score,
        operationalState: detailed.state,
      },
    })

    await this.snapshot(personId, detailed.score, reason)

    return detailed
  }

  /**
   * 🔹 Snapshot + timeline
   */
  async snapshot(personId: string, score: number, reason?: string) {
    const finalReason = reason?.trim()
      ? reason.trim()
      : 'Reavaliação automática'

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { orgId: true },
    })

    if (!person) {
      throw new Error('RiskService.snapshot(): person não encontrado')
    }

    await this.prisma.riskSnapshot.create({
      data: {
        personId,
        score,
        reason: finalReason,
      },
    })

    await this.timeline.log({
      orgId: person.orgId,
      personId,
      action: 'RISK_SNAPSHOT_CREATED',
      metadata: { score, reason: finalReason },
    })
  }

  /**
   * 🔥 MELHORADO: risco operacional do cliente com explicação
   */
  async getCustomerOperationalRisk(orgId: string, customerId: string) {
    const [noShowCount, overdueCount, canceledCount] = await Promise.all([
      this.prisma.appointment.count({
        where: { orgId, customerId, status: 'NO_SHOW' },
      }),
      this.prisma.charge.count({
        where: { orgId, customerId, status: 'OVERDUE' },
      }),
      this.prisma.appointment.count({
        where: { orgId, customerId, status: 'CANCELED' },
      }),
    ])

    const score = Math.min(
      100,
      noShowCount * 25 +
        overdueCount * 20 +
        Math.max(0, canceledCount - 1) * 10,
    )

    const explanation = [
      `Score calculado: ${score}`,
      `Faltas (no-show): ${noShowCount} → impacto ${noShowCount * 25}`,
      `Cobranças vencidas: ${overdueCount} → impacto ${overdueCount * 20}`,
      `Cancelamentos: ${canceledCount} → impacto ${
        Math.max(0, canceledCount - 1) * 10
      }`,
    ]

    return {
      score,
      factors: { noShowCount, overdueCount, canceledCount },
      explanation,
    }
  }

  /**
   * 🔹 Mantido (compatibilidade com fluxo atual)
   */
  async recalculateCustomerOperationalRisk(
    orgId: string,
    customerId: string,
    reason?: string,
  ) {
    const result = await this.getCustomerOperationalRisk(orgId, customerId)

    await this.timeline.log({
      orgId,
      action: 'CUSTOMER_OPERATIONAL_RISK_UPDATED',
      description: `Risco operacional do cliente recalculado (${result.score})`,
      metadata: {
        customerId,
        reason: reason ?? 'OPERATIONAL_EVENT',
        ...result,
      },
    })

    return result
  }
}
