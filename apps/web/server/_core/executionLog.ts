import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express } from "express";

type ExecutionLogStatus =
  | "success"
  | "failed"
  | "pending"
  | "blocked"
  | "throttled"
  | "restricted"
  | "requires_confirmation";

type ExecutionEventType =
  | "EXECUTION_ACTION_REQUESTED"
  | "EXECUTION_ACTION_EXECUTED"
  | "EXECUTION_ACTION_FAILED"
  | "EXECUTION_ACTION_BLOCKED";

type ExecutionLogRecord = {
  id: string;
  actionId: string;
  decisionId: string;
  executionKey?: string;
  status: ExecutionLogStatus;
  eventType: ExecutionEventType;
  mode?: "manual" | "semi_automatic" | "automatic";
  reasonCode?: string;
  message?: string;
  telemetryKey?: string;
  executedAt: number;
  timestamp: string;
  entityType?: string;
  entityId?: string;
  createdAt: number;
};

type ExecutionLogPayload = {
  actionId?: unknown;
  decisionId?: unknown;
  executionKey?: unknown;
  status?: unknown;
  eventType?: unknown;
  mode?: unknown;
  reasonCode?: unknown;
  message?: unknown;
  telemetryKey?: unknown;
  executedAt?: unknown;
  timestamp?: unknown;
  entityType?: unknown;
  entityId?: unknown;
};

const STORAGE_DIR = path.resolve(process.cwd(), ".data");
const STORAGE_FILE = path.join(STORAGE_DIR, "execution-logs.json");
const MAX_LOGS = 5000;

function isStrictExecutionLogParsingEnabled() {
  return ["1", "true", "yes", "y", "on"].includes(
    (process.env.EXECUTION_LOG_STRICT_PARSE ?? "").toLowerCase().trim()
  );
}

function logExecutionLogParseError(error: unknown, raw: string) {
  console.error(
    JSON.stringify({
      event: "execution_log_parse_failed",
      level: "error",
      file: STORAGE_FILE,
      rawLength: raw.length,
      strict: isStrictExecutionLogParsingEnabled(),
      error: error instanceof Error ? error.message : String(error),
    })
  );
}

async function ensureStore() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  try {
    await fs.access(STORAGE_FILE);
  } catch {
    await fs.writeFile(STORAGE_FILE, "[]", "utf8");
  }
}

export async function readLogs(): Promise<ExecutionLogRecord[]> {
  await ensureStore();
  const raw = await fs.readFile(STORAGE_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;

    const error = new Error("Execution log storage payload is not an array");
    logExecutionLogParseError(error, raw);
    if (isStrictExecutionLogParsingEnabled()) throw error;
    return [];
  } catch (error) {
    if ((error as Error)?.message !== "Execution log storage payload is not an array") {
      logExecutionLogParseError(error, raw);
    }
    if (isStrictExecutionLogParsingEnabled()) throw error;
    return [];
  }
}

async function writeLogs(logs: ExecutionLogRecord[]) {
  await ensureStore();
  await fs.writeFile(STORAGE_FILE, JSON.stringify(logs.slice(0, MAX_LOGS)), "utf8");
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function asStatus(value: unknown): ExecutionLogRecord["status"] | null {
  if (
    value === "success" ||
    value === "failed" ||
    value === "pending" ||
    value === "blocked" ||
    value === "throttled" ||
    value === "restricted" ||
    value === "requires_confirmation"
  ) {
    return value;
  }

  return null;
}

function asEventType(value: unknown): ExecutionEventType | undefined {
  if (
    value === "EXECUTION_ACTION_REQUESTED" ||
    value === "EXECUTION_ACTION_EXECUTED" ||
    value === "EXECUTION_ACTION_FAILED" ||
    value === "EXECUTION_ACTION_BLOCKED"
  ) {
    return value;
  }

  return undefined;
}

function asMode(value: unknown): ExecutionLogRecord["mode"] | undefined {
  if (value === "manual" || value === "semi_automatic" || value === "automatic") {
    return value;
  }

  return undefined;
}

function deriveEventType(status: ExecutionLogRecord["status"]) {
  if (status === "success") return "EXECUTION_ACTION_EXECUTED" satisfies ExecutionEventType;
  if (status === "failed") return "EXECUTION_ACTION_FAILED" satisfies ExecutionEventType;
  if (status === "pending") return "EXECUTION_ACTION_REQUESTED" satisfies ExecutionEventType;
  return "EXECUTION_ACTION_BLOCKED" satisfies ExecutionEventType;
}

function normalizePayload(payload: ExecutionLogPayload) {
  const actionId = asNonEmptyString(payload.actionId);
  const decisionId = asNonEmptyString(payload.decisionId);
  const status = asStatus(payload.status);

  if (!actionId || !decisionId || !status) {
    return null;
  }

  const executedAtRaw = typeof payload.executedAt === "number" ? payload.executedAt : Date.now();
  const executedAt = Number.isFinite(executedAtRaw) ? executedAtRaw : Date.now();
  const normalizedTimestamp = asNonEmptyString(payload.timestamp) ?? new Date(executedAt).toISOString();

  return {
    id: `${actionId}-${decisionId}-${Date.now()}`,
    actionId,
    decisionId,
    executionKey: asNonEmptyString(payload.executionKey) ?? undefined,
    status,
    eventType: asEventType(payload.eventType) ?? deriveEventType(status),
    mode: asMode(payload.mode),
    reasonCode: asNonEmptyString(payload.reasonCode) ?? undefined,
    message: asNonEmptyString(payload.message) ?? undefined,
    telemetryKey: asNonEmptyString(payload.telemetryKey) ?? undefined,
    executedAt,
    timestamp: normalizedTimestamp,
    entityType: asNonEmptyString(payload.entityType) ?? undefined,
    entityId: asNonEmptyString(payload.entityId) ?? undefined,
    createdAt: Date.now(),
  } satisfies ExecutionLogRecord;
}

export function registerExecutionLogRoutes(app: Express) {
  app.post("/execution/log", async (req, res) => {
    const payload = normalizePayload((req?.body ?? {}) as ExecutionLogPayload);

    if (!payload) {
      res.status(400).json({
        ok: false,
        error: "Payload inválido. actionId, decisionId e status são obrigatórios.",
      });
      return;
    }

    const logs = await readLogs();
    const next = [payload, ...logs]
      .sort((a, b) => b.executedAt - a.executedAt)
      .slice(0, MAX_LOGS);

    await writeLogs(next);

    res.status(201).json({ ok: true, log: payload });
  });

  app.get("/execution/logs", async (req, res) => {
    const decisionId = asNonEmptyString(req.query.decisionId);
    const actionId = asNonEmptyString(req.query.actionId);
    const executionKey = asNonEmptyString(req.query.executionKey);
    const eventType = asEventType(req.query.eventType);
    const status = asStatus(req.query.status);
    const sinceMs = Number(req.query.sinceMs ?? 0);

    const logs = await readLogs();

    const filtered = logs.filter((log) => {
      if (decisionId && log.decisionId !== decisionId) return false;
      if (actionId && log.actionId !== actionId) return false;
      if (executionKey && log.executionKey !== executionKey) return false;
      if (eventType && log.eventType !== eventType) return false;
      if (status && log.status !== status) return false;
      if (Number.isFinite(sinceMs) && sinceMs > 0) {
        if (Date.now() - log.executedAt > sinceMs) return false;
      }
      return true;
    });

    res.json({ ok: true, logs: filtered });
  });

  app.get("/execution/state-summary", async (req, res) => {
    const sinceMs = Number(req.query.sinceMs ?? 1000 * 60 * 60 * 24);
    const logs = await readLogs();
    const now = Date.now();

    const scoped = logs.filter((log) => {
      if (!Number.isFinite(sinceMs) || sinceMs <= 0) return true;
      return now - log.executedAt <= sinceMs;
    });

    const summary = {
      pending: scoped.filter(log => log.status === "pending").length,
      executed: scoped.filter(log => log.status === "success").length,
      failed: scoped.filter(log => log.status === "failed").length,
      blocked: scoped.filter(
        log =>
          log.status === "blocked" ||
          log.status === "restricted" ||
          log.status === "requires_confirmation"
      ).length,
      throttled: scoped.filter(log => log.status === "throttled").length,
    };

    res.json({ ok: true, summary });
  });
}
