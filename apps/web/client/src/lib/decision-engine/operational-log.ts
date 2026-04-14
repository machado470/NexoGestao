import type { Decision } from "./decision.types";

export type OperationalLogStatus = "executed" | "ignored";

export type OperationalLogEntry = {
  decision_id: string;
  status: OperationalLogStatus;
  timestamp: string;
  source: Decision["source"];
  entityId?: string;
  message?: string;
};

const STORAGE_KEY = "nexo.operational.log.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function listOperationalLogs(): OperationalLogEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendOperationalLog(entry: OperationalLogEntry) {
  if (!canUseStorage()) return;

  const current = listOperationalLogs();
  const next = [entry, ...current].slice(0, 200);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function logDecisionStatus(decision: Decision, status: OperationalLogStatus, message?: string) {
  appendOperationalLog({
    decision_id: decision.id,
    status,
    source: decision.source,
    entityId: decision.entityId,
    timestamp: new Date().toISOString(),
    message,
  });
}
