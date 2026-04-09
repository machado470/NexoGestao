import { Injectable } from '@nestjs/common'
import type {
  ExecutionActionCandidate,
  ExecutionGovernanceStatus,
} from './execution.types'

type GovernanceResult = {
  status: ExecutionGovernanceStatus
  reasonCode?: string
}

@Injectable()
export class ExecutionGovernanceService {
  evaluate(candidate: ExecutionActionCandidate): GovernanceResult {
    const amountCents = Number(candidate.metadata?.amountCents ?? 0)

    if (amountCents > 500_000) {
      return {
        status: 'requires_confirmation',
        reasonCode: 'governance_high_amount_requires_approval',
      }
    }

    if (candidate.metadata?.blockedByGovernance === true) {
      return {
        status: 'blocked',
        reasonCode: 'governance_blocked_candidate',
      }
    }

    return { status: 'allowed' }
  }

  requiresApproval(candidate: ExecutionActionCandidate) {
    return this.evaluate(candidate).status === 'requires_confirmation'
  }
}
