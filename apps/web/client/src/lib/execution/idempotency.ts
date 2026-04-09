import type { ExecutionAction, ExecutionLog } from "@/lib/execution/types";

const IDEMPOTENCY_WINDOW_MS = 1000 * 60 * 30;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`);

  return `{${entries.join(",")}}`;
}

function hashString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return `exec_${Math.abs(hash).toString(36)}`;
}

export function buildExecutionKey(action: ExecutionAction, context: {
  decisionId?: string;
  entityType?: string;
  entityId?: string;
  source?: string;
}) {
  return hashString(
    stableStringify({
      actionId: action.id,
      mode: action.mode,
      payload: action.payload ?? {},
      decisionId: context.decisionId ?? null,
      entityType: context.entityType ?? null,
      entityId: context.entityId ?? null,
      source: context.source ?? null,
    })
  );
}

export function hasRecentExecutionByKey(input: {
  executionKey: string;
  logs: ExecutionLog[];
  withinMs?: number;
}) {
  const { executionKey, logs, withinMs = IDEMPOTENCY_WINDOW_MS } = input;
  const now = Date.now();

  return logs.some(log => {
    if (log.status !== "success") return false;
    if (log.executionKey !== executionKey) return false;
    return now - log.executedAt <= withinMs;
  });
}

export { IDEMPOTENCY_WINDOW_MS };
