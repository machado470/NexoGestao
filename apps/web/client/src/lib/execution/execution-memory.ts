import { useSyncExternalStore } from "react";
import type { ExecutionLog } from "@/lib/execution/types";

const STORAGE_KEY = "nexo.execution.logs.v1";
const MAX_LOGS = 200;
const RECENT_WINDOW_MS = 1000 * 60 * 60 * 6;

let logsCache: ExecutionLog[] = [];
const listeners = new Set<() => void>();
let loaded = false;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadLogs() {
  if (loaded) return;
  loaded = true;

  if (!canUseStorage()) {
    logsCache = [];
    return;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ExecutionLog[]) : [];
    logsCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    logsCache = [];
  }
}

function persistLogs() {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logsCache));
}

function emit() {
  listeners.forEach(listener => listener());
}

export function getExecutionLogs() {
  loadLogs();
  return logsCache;
}

export function appendExecutionLog(log: ExecutionLog) {
  loadLogs();
  logsCache = [log, ...logsCache].slice(0, MAX_LOGS);
  persistLogs();
  emit();
}

export function wasRecentlyExecuted(input: {
  actionId: string;
  decisionId: string;
  withinMs?: number;
}) {
  const { actionId, decisionId, withinMs = RECENT_WINDOW_MS } = input;
  const now = Date.now();

  return getExecutionLogs().some(log => {
    if (log.status !== "success") return false;
    if (log.actionId !== actionId || log.decisionId !== decisionId) return false;
    return now - log.executedAt <= withinMs;
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExecutionMemory() {
  const logs = useSyncExternalStore(subscribe, getExecutionLogs, getExecutionLogs);

  return {
    logs,
    appendExecutionLog,
    wasRecentlyExecuted,
  };
}
