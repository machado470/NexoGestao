import { Injectable } from '@nestjs/common'
import { OperationalStateValue } from '@prisma/client'

export type EnforcementAction =
  | 'NONE'
  | 'RAISE_WARNING'
  | 'CREATE_CORRECTIVE_ACTION'

export type EnforcementDecision = {
  action: EnforcementAction
  reason: string

  // ✅ sempre devolvemos o enum canônico do Prisma (persistência)
  nextState: OperationalStateValue

  shouldBlockActions: boolean
  shouldRaiseWarning: boolean
  shouldCreateCorrective: boolean
}

export type DecideInput = {
  riskScore: number

  /**
   * ✅ O engine tá passando um tipo (enum) chamado OperationalState.
   * Enum NÃO é string, e o TS não deixa “assumir”.
   *
   * Aqui a policy aceita qualquer coisa e normaliza via String().
   * Isso mantém o engine livre pra trocar tipo sem quebrar policy.
   */
  status: unknown

  // ✅ o engine está passando isso
  hasActiveException?: boolean

  orgId?: string
  personId?: string
  source?: string
}

@Injectable()
export class EnforcementPolicyService {
  private readonly thresholds = {
    warning: 50,
    restricted: 70,
    suspended: 90,
  }

  decide(input: DecideInput): EnforcementDecision {
    const currentState = this.normalizeState(input.status)

    // ✅ exceção ativa: policy “segura a onda” (sem enforcement)
    if (input.hasActiveException) {
      return {
        action: 'NONE',
        reason: 'Sem enforcement: pessoa com exceção ativa.',
        nextState: currentState,
        shouldBlockActions: false,
        shouldRaiseWarning: false,
        shouldCreateCorrective: false,
      }
    }

    const nextState = this.deriveOperationalState(input.riskScore)

    const shouldBlockActions = this.shouldBlockActions(nextState)
    const shouldRaiseWarning = this.shouldRaiseWarning(nextState)
    const shouldCreateCorrective = this.shouldCreateCorrective(nextState)

    if (nextState === 'NORMAL') {
      return {
        action: 'NONE',
        reason: 'Sem enforcement: risco dentro do normal.',
        nextState,
        shouldBlockActions,
        shouldRaiseWarning,
        shouldCreateCorrective,
      }
    }

    if (nextState === 'WARNING') {
      return {
        action: 'RAISE_WARNING',
        reason: `WARNING: risco=${input.riskScore} >= ${this.thresholds.warning}.`,
        nextState,
        shouldBlockActions,
        shouldRaiseWarning,
        shouldCreateCorrective,
      }
    }

    if (nextState === 'RESTRICTED') {
      return {
        action: 'CREATE_CORRECTIVE_ACTION',
        reason: `RESTRICTED: risco=${input.riskScore} >= ${this.thresholds.restricted}.`,
        nextState,
        shouldBlockActions,
        shouldRaiseWarning,
        shouldCreateCorrective,
      }
    }

    return {
      action: 'CREATE_CORRECTIVE_ACTION',
      reason: `SUSPENDED: risco=${input.riskScore} >= ${this.thresholds.suspended}.`,
      nextState,
      shouldBlockActions,
      shouldRaiseWarning,
      shouldCreateCorrective,
    }
  }

  private normalizeState(state: unknown): OperationalStateValue {
    const s = String(state ?? '').toUpperCase().trim()

    if (s === 'NORMAL') return 'NORMAL'
    if (s === 'WARNING') return 'WARNING'
    if (s === 'RESTRICTED') return 'RESTRICTED'
    if (s === 'SUSPENDED') return 'SUSPENDED'

    // fallback seguro
    return 'NORMAL'
  }

  deriveOperationalState(riskScore: number): OperationalStateValue {
    if (riskScore >= this.thresholds.suspended) return 'SUSPENDED'
    if (riskScore >= this.thresholds.restricted) return 'RESTRICTED'
    if (riskScore >= this.thresholds.warning) return 'WARNING'
    return 'NORMAL'
  }

  shouldBlockActions(state: OperationalStateValue): boolean {
    return state === 'RESTRICTED' || state === 'SUSPENDED'
  }

  shouldRaiseWarning(state: OperationalStateValue): boolean {
    return state === 'WARNING' || state === 'RESTRICTED' || state === 'SUSPENDED'
  }

  shouldCreateCorrective(state: OperationalStateValue): boolean {
    return state === 'RESTRICTED' || state === 'SUSPENDED'
  }
}
