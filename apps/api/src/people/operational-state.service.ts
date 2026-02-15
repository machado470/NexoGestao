import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  TemporalRiskService,
  TemporalRiskResult,
} from '../risk/temporal-risk.service'
import { OperationalStateRepository } from './operational-state.repository'

export type OperationalStateValue =
  | 'NORMAL'
  | 'WARNING'
  | 'RESTRICTED'
  | 'SUSPENDED'

export type OperationalState = {
  state: OperationalStateValue
  riskScore: number
}

export type OperationalStateDetailed = OperationalState & {
  contributors: TemporalRiskResult['contributors']
  factors: TemporalRiskResult['factors']
}

@Injectable()
export class OperationalStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporalRisk: TemporalRiskService,
    private readonly repository: OperationalStateRepository,
  ) {}

  private toState(riskScore: number): OperationalStateValue {
    if (riskScore >= 90) return 'SUSPENDED'
    if (riskScore >= 70) return 'RESTRICTED'
    if (riskScore >= 50) return 'WARNING'
    return 'NORMAL'
  }

  async getStatus(personId: string): Promise<OperationalState> {
    const riskScore = await this.temporalRisk.calculate(personId)
    return { state: this.toState(riskScore), riskScore }
  }

  async getStatusDetailed(personId: string): Promise<OperationalStateDetailed> {
    const detailed = await this.temporalRisk.calculateDetailed(personId)

    return {
      state: this.toState(detailed.score),
      riskScore: detailed.score,
      contributors: detailed.contributors,
      factors: detailed.factors,
    }
  }
}
