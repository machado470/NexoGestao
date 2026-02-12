import { Injectable } from '@nestjs/common'
import type { OperationalState } from '../people/operational-state.service'

export type EnforcementDecision =
  | { action: 'NONE'; reason?: string }
  | { action: 'CREATE_CORRECTIVE_ACTION'; reason: string }
  | { action: 'RAISE_WARNING'; reason: string }

@Injectable()
export class EnforcementPolicyService {
  decide(params: {
    status: OperationalState
    hasActiveException: boolean
  }): EnforcementDecision {
    const { status, hasActiveException } = params

    // Exceção ativa: não punir por enforcement automático
    if (hasActiveException) {
      return {
        action: 'NONE',
        reason:
          'Exceção ativa: enforcement automático suspenso',
      }
    }

    if (status.state === 'WARNING') {
      return {
        action: 'RAISE_WARNING',
        reason:
          'Alerta operacional por risco temporal (WARNING)',
      }
    }

    // Se travou por risco alto: cria corretiva automática
    if (status.state === 'RESTRICTED') {
      return {
        action: 'CREATE_CORRECTIVE_ACTION',
        reason:
          'Ação corretiva automática por acesso RESTRICTED',
      }
    }

    // Suspenso: pode virar corretiva institucional também (opcional)
    if (status.state === 'SUSPENDED') {
      return {
        action: 'CREATE_CORRECTIVE_ACTION',
        reason:
          'Ação corretiva automática por acesso SUSPENDED',
      }
    }

    return { action: 'NONE' }
  }
}

