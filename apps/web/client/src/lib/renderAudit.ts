export type NexoAuditEvent = {
  at: string;
  source: string;
  message: string;
  payload?: unknown;
};

export type NexoAuditState = {
  htmlStartedAt?: string;
  renderAuditMode?: string;
  pathname?: string;
  readyState?: string;
  title?: string;
  rootFound?: boolean;
  createRootStartedAt?: string;
  createRootDoneAt?: string;
  appRenderDispatchedAt?: string;
  appMountedAt?: string;
  phase?: string;
  rootBranch?: string;
  bootstrapBranch?: string;
  errorType?: string;
  lastErrorMessage?: string;
  lastErrorStack?: string;
  events: NexoAuditEvent[];
};

declare global {
  interface Window {
    __NEXO_AUDIT__?: NexoAuditState;
  }
}

const MAX_EVENTS = 120;

function nowIso() {
  return new Date().toISOString();
}

function getDefaultState(): NexoAuditState {
  return {
    pathname: typeof window !== "undefined" ? window.location.pathname : "unknown",
    readyState: typeof document !== "undefined" ? document.readyState : "unknown",
    title: typeof document !== "undefined" ? document.title : "unknown",
    events: [],
  };
}

export function ensureAuditState() {
  if (typeof window === "undefined") return getDefaultState();
  if (!window.__NEXO_AUDIT__) {
    window.__NEXO_AUDIT__ = getDefaultState();
  }
  if (!Array.isArray(window.__NEXO_AUDIT__.events)) {
    window.__NEXO_AUDIT__.events = [];
  }
  return window.__NEXO_AUDIT__;
}

export function setAuditField<K extends keyof NexoAuditState>(key: K, value: NexoAuditState[K]) {
  if (typeof window === "undefined") return;
  const audit = ensureAuditState();
  audit[key] = value;
}

export function pushAuditEvent(source: string, message: string, payload?: unknown) {
  if (typeof window === "undefined") return;
  const audit = ensureAuditState();
  const event: NexoAuditEvent = {
    at: nowIso(),
    source,
    message,
    payload,
  };
  audit.events = [...audit.events, event].slice(-MAX_EVENTS);
}

export function markAuditError(type: string, errorLike: unknown) {
  if (typeof window === "undefined") return;
  const error = errorLike instanceof Error ? errorLike : null;
  setAuditField("errorType", type);
  setAuditField("lastErrorMessage", error?.message ?? String(errorLike));
  setAuditField("lastErrorStack", error?.stack ?? undefined);
  pushAuditEvent("error", `error:${type}`, {
    message: error?.message ?? String(errorLike),
  });
}

export function getAuditSnapshot() {
  return ensureAuditState();
}
