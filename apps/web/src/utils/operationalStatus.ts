export type OperationalState =
  | 'NORMAL'
  | 'WARNING'
  | 'RESTRICTED'
  | 'SUSPENDED'

export type ExecutiveStatus =
  | 'OK'
  | 'WARNING'
  | 'CRITICAL'

export type StatusTone =
  | 'success'
  | 'warning'
  | 'critical'

/**
 * 🔒 Fonte única de verdade para status operacional
 */

export function operationalToExecutive(
  state: OperationalState,
): ExecutiveStatus {
  switch (state) {
    case 'WARNING':
      return 'WARNING'
    case 'RESTRICTED':
    case 'SUSPENDED':
      return 'CRITICAL'
    case 'NORMAL':
    default:
      return 'OK'
  }
}

export function executiveTone(
  status: ExecutiveStatus,
): StatusTone {
  switch (status) {
    case 'CRITICAL':
      return 'critical'
    case 'WARNING':
      return 'warning'
    case 'OK':
    default:
      return 'success'
  }
}

export function operationalLabel(
  state: OperationalState,
): string {
  switch (state) {
    case 'WARNING':
      return 'Risco sob atenção'
    case 'RESTRICTED':
      return 'Operação restrita'
    case 'SUSPENDED':
      return 'Operação suspensa'
    case 'NORMAL':
    default:
      return 'Operação normal'
  }
}
