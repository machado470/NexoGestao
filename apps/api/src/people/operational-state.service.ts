import { Injectable } from '@nestjs/common'
import {
  TemporalRiskService,
  TemporalRiskResult,
} from '../risk/temporal-risk.service'
import { OperationalStateRepository } from './operational-state.repository'
import { TimelineService } from '../timeline/timeline.service'

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

export type OperationalStateSyncResult = {
  status: OperationalState
  changed: boolean
  from: OperationalStateValue | null
  to: OperationalStateValue
}

@Injectable()
export class OperationalStateService {
  constructor(
    private readonly temporalRisk: TemporalRiskService,
    private readonly repository: OperationalStateRepository,
    private readonly timeline: TimelineService,
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

  async syncAndLogStateChange(
    orgId: string,
    personId: string,
  ): Promise<OperationalStateSyncResult> {
    const status = await this.getStatus(personId)
    const last = await this.repository.getLastState({ orgId, personId })

    const to = status.state
    const changed = last !== to

    if (!changed) {
      return { status, changed: false, from: last, to }
    }

    await this.timeline.log({
      orgId,
      action: 'OPERATIONAL_STATE_CHANGED',
      personId,
      description: `Estado operacional: ${last ?? 'N/A'} → ${to}`,
      metadata: {
        from: last,
        to,
        riskScore: status.riskScore,
      },
    })

    return { status, changed: true, from: last, to }
  }
}
