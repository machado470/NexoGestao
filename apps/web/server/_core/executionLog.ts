import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express } from "express";

type ExecutionLogRecord = {
  id: string;
  actionId: string;
  decisionId: string;
  executionKey?: string;
  status: "success" | "failed" | "pending";
  executedAt: number;
  entityType?: string;
  entityId?: string;
  createdAt: number;
};

type ExecutionLogPayload = {
  actionId?: unknown;
  decisionId?: unknown;
  executionKey?: unknown;
  status?: unknown;
  executedAt?: unknown;
  entityType?: unknown;
  entityId?: unknown;
};

const STORAGE_DIR = path.resolve(process.cwd(), ".data");
const STORAGE_FILE = path.join(STORAGE_DIR, "execution-logs.json");
const MAX_LOGS = 5000;

async function ensureStore() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  try {
    await fs.access(STORAGE_FILE);
  } catch {
    await fs.writeFile(STORAGE_FILE, "[]", "utf8");
  }
}

async function readLogs(): Promise<ExecutionLogRecord[]> {
  await ensureStore();
  const raw = await fs.readFile(STORAGE_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
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
  if (value === "success" || value === "failed" || value === "pending") return value;
  return null;
}

function normalizePayload(payload: ExecutionLogPayload) {
  const actionId = asNonEmptyString(payload.actionId);
  const decisionId = asNonEmptyString(payload.decisionId);
  const status = asStatus(payload.status);

  if (!actionId || !decisionId || !status) {
    return null;
  }

  const executedAtRaw = typeof payload.executedAt === "number" ? payload.executedAt : Date.now();

  return {
    id: `${actionId}-${decisionId}-${Date.now()}`,
    actionId,
    decisionId,
    executionKey: asNonEmptyString(payload.executionKey) ?? undefined,
    status,
    executedAt: Number.isFinite(executedAtRaw) ? executedAtRaw : Date.now(),
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
    const sinceMs = Number(req.query.sinceMs ?? 0);

    const logs = await readLogs();

    const filtered = logs.filter((log) => {
      if (decisionId && log.decisionId !== decisionId) return false;
      if (actionId && log.actionId !== actionId) return false;
      if (executionKey && log.executionKey !== executionKey) return false;
      if (Number.isFinite(sinceMs) && sinceMs > 0) {
        if (Date.now() - log.executedAt > sinceMs) return false;
      }
      return true;
    });

    res.json({ ok: true, logs: filtered });
  });
}
