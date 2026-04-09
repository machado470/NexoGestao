import { useEffect, useSyncExternalStore } from "react";
import type { ExecutionLog } from "@/lib/execution/types";

const STORAGE_KEY = "nexo.execution.logs.v1";
const MAX_LOGS = 200;
const RECENT_WINDOW_MS = 1000 * 60 * 60 * 6;

let logsCache: ExecutionLog[] = [];
const listeners = new Set<() => void>();
let loaded = false;
let hydratedFromBackend = false;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function mergeLogs(logs: ExecutionLog[]) {
  const uniqueById = new Map<string, ExecutionLog>();

  logs.forEach((log) => {
    if (!log?.id) return;
    uniqueById.set(log.id, log);
  });

  return [...uniqueById.values()]
    .sort((a, b) => b.executedAt - a.executedAt)
    .slice(0, MAX_LOGS);
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
  logsCache = mergeLogs([log, ...logsCache]);
  persistLogs();
  emit();
}

export function replaceExecutionLogs(logs: ExecutionLog[]) {
  loadLogs();
  logsCache = mergeLogs(logs);
  persistLogs();
  emit();
}

export async function syncExecutionLogAsync(log: ExecutionLog) {
  try {
    await fetch("/execution/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        actionId: log.actionId,
        decisionId: log.decisionId,
        status: log.status,
        executedAt: log.executedAt,
        entityType: log.entityType,
        entityId: log.entityId,
        executionKey: log.executionKey,
        mode: log.mode,
        eventType: log.eventType,
        reasonCode: log.reasonCode,
        message: log.message,
        telemetryKey: log.telemetryKey,
      }),
    });
  } catch {
    // fallback silencioso: mantém persistência local
  }
}



export async function syncExecutionEventAsync(event: ExecutionLog) {
  try {
    await fetch("/execution/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        actionId: event.actionId,
        decisionId: event.decisionId,
        status: event.status,
        executedAt: event.executedAt,
        entityType: event.entityType,
        entityId: event.entityId,
        executionKey: event.executionKey,
        mode: event.mode,
        eventType: event.eventType,
        reasonCode: event.reasonCode,
        message: event.message,
        telemetryKey: event.telemetryKey,
      }),
    });
  } catch {
    // fallback silencioso: mantém persistência local
  }
}

export async function hydrateExecutionLogsFromBackend() {
  if (hydratedFromBackend || typeof window === "undefined") return;
  hydratedFromBackend = true;

  try {
    const response = await fetch("/execution/logs", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) return;

    const payload = (await response.json()) as { logs?: ExecutionLog[] };
    const backendLogs = Array.isArray(payload.logs) ? payload.logs : [];

    replaceExecutionLogs([...backendLogs, ...getExecutionLogs()]);
  } catch {
    // fallback silencioso: mantém persistência local
  }
}

export function wasRecentlyExecuted(input: {
  actionId: string;
  decisionId: string;
  executionKey?: string;
  withinMs?: number;
}) {
  const { actionId, decisionId, executionKey, withinMs = RECENT_WINDOW_MS } = input;
  const now = Date.now();

  return getExecutionLogs().some(log => {
    if (log.status !== "success") return false;
    const sameAction = log.actionId === actionId && log.decisionId === decisionId;
    const sameExecution = executionKey ? log.executionKey === executionKey : false;
    if (!sameAction && !sameExecution) return false;
    return now - log.executedAt <= withinMs;
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExecutionMemory() {
  const logs = useSyncExternalStore(subscribe, getExecutionLogs, getExecutionLogs);

  useEffect(() => {
    void hydrateExecutionLogsFromBackend();
  }, []);

  return {
    logs,
    appendExecutionLog,
    wasRecentlyExecuted,
    syncExecutionLogAsync,
    syncExecutionEventAsync,
  };
}
