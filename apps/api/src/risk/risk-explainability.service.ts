import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type RiskFactor = {
  factor: string
  weight: number
  impact: 'high' | 'medium' | 'low'
  reason: string
}

type RiskExplanation = {
  personId: string
  personName: string
  riskScore: number
  operationalRiskScore: number
  operationalState: string
  factors: RiskFactor[]
  summary: string
  recommendations: string[]
  lastUpdated: Date
}

@Injectable()
export class RiskExplainabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async explainPersonRisk(orgId: string, personId: string): Promise<RiskExplanation | null> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, orgId },
      include: {
        riskSnapshots: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        correctiveActions: {
          where: { status: 'OPEN' },
          take: 5,
        },
        exceptions: {
          where: { processedAt: null },
          take: 5,
        },
      },
    })

    if (!person) {
      return null
    }

    const factors: RiskFactor[] = []
    let baseScore = 0

    // Fator 1: Risco operacional
    if (person.operationalRiskScore > 0) {
      const weight = Math.min(person.operationalRiskScore / 100, 1)
      factors.push({
        factor: 'Risco Operacional',
        weight: weight * 100,
        impact: person.operationalRiskScore > 70 ? 'high' : person.operationalRiskScore > 40 ? 'medium' : 'low',
        reason: `Score operacional: ${person.operationalRiskScore}/100`,
      })
      baseScore += weight * 30
    }

    // Fator 2: Estado operacional
    if (person.operationalState !== 'NORMAL') {
      const weight = person.operationalState === 'SUSPENDED' ? 1 : person.operationalState === 'RESTRICTED' ? 0.7 : 0.4
      factors.push({
        factor: 'Estado Operacional',
        weight: weight * 100,
        impact: person.operationalState === 'SUSPENDED' ? 'high' : person.operationalState === 'RESTRICTED' ? 'medium' : 'low',
        reason: `Estado: ${person.operationalState}`,
      })
      baseScore += weight * 25
    }

    // Fator 3: Ações corretivas abertas
    if (person.correctiveActions.length > 0) {
      const weight = Math.min(person.correctiveActions.length / 5, 1)
      factors.push({
        factor: 'Ações Corretivas Abertas',
        weight: weight * 100,
        impact: person.correctiveActions.length > 3 ? 'high' : person.correctiveActions.length > 1 ? 'medium' : 'low',
        reason: `${person.correctiveActions.length} ações abertas`,
      })
      baseScore += weight * 20
    }

    // Fator 4: Exceções não processadas
    if (person.exceptions.length > 0) {
      const weight = Math.min(person.exceptions.length / 3, 1)
      factors.push({
        factor: 'Exceções Não Processadas',
        weight: weight * 100,
        impact: person.exceptions.length > 2 ? 'high' : 'medium',
        reason: `${person.exceptions.length} exceções pendentes`,
      })
      baseScore += weight * 15
    }

    // Fator 5: Histórico de risco (snapshot mais recente)
    const latestSnapshot = person.riskSnapshots[0]
    if (latestSnapshot && latestSnapshot.score > 60) {
      const weight = Math.min(latestSnapshot.score / 100, 1)
      factors.push({
        factor: 'Histórico de Risco',
        weight: weight * 100,
        impact: latestSnapshot.score > 80 ? 'high' : 'medium',
        reason: `Histórico: ${latestSnapshot.score}/100`,
      })
      baseScore += weight * 10
    }

    // Normalizar score
    const finalScore = Math.min(Math.round(baseScore), 100)

    // Gerar recomendações
    const recommendations: string[] = []
    if (person.operationalState === 'SUSPENDED') {
      recommendations.push('Revisar motivo da suspensão e considerar reabilitação')
    }
    if (person.correctiveActions.length > 2) {
      recommendations.push('Priorizar resolução das ações corretivas abertas')
    }
    if (person.exceptions.length > 1) {
      recommendations.push('Processar e documentar exceções pendentes')
    }
    if (person.operationalRiskScore > 70) {
      recommendations.push('Realizar auditoria operacional detalhada')
    }
    if (recommendations.length === 0) {
      recommendations.push('Continuar monitoramento regular')
    }

    // Gerar resumo
    const summary = this.buildSummary(finalScore, person.operationalState, factors)

    return {
      personId: person.id,
      personName: person.name,
      riskScore: person.riskScore,
      operationalRiskScore: person.operationalRiskScore,
      operationalState: person.operationalState,
      factors: factors.sort((a, b) => b.weight - a.weight),
      summary,
      recommendations,
      lastUpdated: person.updatedAt,
    }
  }

  private buildSummary(score: number, state: string, factors: RiskFactor[]): string {
    if (state === 'SUSPENDED') {
      return 'Pessoa suspensa do sistema. Reabilitação necessária.'
    }
    if (state === 'RESTRICTED') {
      return 'Pessoa com restrições operacionais ativas.'
    }
    if (score >= 80) {
      return 'Risco muito alto. Ação imediata recomendada.'
    }
    if (score >= 60) {
      return 'Risco elevado. Monitoramento intensivo necessário.'
    }
    if (score >= 40) {
      return 'Risco moderado. Vigilância contínua recomendada.'
    }
    if (score >= 20) {
      return 'Risco baixo. Monitoramento padrão.'
    }
    return 'Risco mínimo. Operação normal.'
  }
}
