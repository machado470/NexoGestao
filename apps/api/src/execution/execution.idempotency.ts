import type { ExecutionActionCandidate } from './execution.types'

type BuildExecutionKeyInput = {
  action: Pick<ExecutionActionCandidate, 'actionId' | 'decisionId' | 'entityId' | 'entityType'>
  context: {
    orgId: string
    mode?: string
    scope?: string
    payload?: Record<string, unknown> | null
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((x) => stableStringify(x)).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)

  return `{${entries.join(',')}}`
}

function hashString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return `exec_${Math.abs(hash).toString(36)}`
}

export function buildExecutionKey(input: BuildExecutionKeyInput) {
  const { action, context } = input
  const raw = stableStringify({
    actionId: action.actionId,
    decisionId: action.decisionId,
    entityType: action.entityType,
    entityId: action.entityId,
    orgId: context.orgId,
    mode: context.mode ?? null,
    scope: context.scope ?? 'default',
    payload: context.payload ?? null,
  })

  return hashString(raw)
}
