export const WEBHOOK_STATUSES = ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED"] as const;

export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export type WebhookFilters = {
  status: "ALL" | WebhookStatus;
  provider: string;
  traceId: string;
  providerMessageId: string;
  createdAtFrom: string;
  createdAtTo: string;
  search: string;
};

export type WebhookEvent = {
  id: string;
  status?: WebhookStatus | string | null;
  provider?: string | null;
  traceId?: string | null;
  providerMessageId?: string | null;
  retryAttempts?: number | null;
  createdAt?: string | null;
  processedAt?: string | null;
  updatedAt?: string | null;
  errorMessage?: string | null;
  payloadMetadata?: Record<string, unknown> | null;
  rawPayloadMetadata?: Record<string, unknown> | null;
  replayable?: boolean | null;
  canReplay?: boolean | null;
};

export type ReplayMode = "normal" | "force";

export const defaultWebhookFilters: WebhookFilters = {
  status: "FAILED",
  provider: "",
  traceId: "",
  providerMessageId: "",
  createdAtFrom: "",
  createdAtTo: "",
  search: "",
};

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildWebhookEventListParams(filters: WebhookFilters, cursor?: string | null) {
  return {
    status: filters.status === "ALL" ? undefined : filters.status,
    provider: clean(filters.provider),
    traceId: clean(filters.traceId),
    providerMessageId: clean(filters.providerMessageId),
    createdAtFrom: clean(filters.createdAtFrom),
    createdAtTo: clean(filters.createdAtTo),
    cursor: cursor ?? undefined,
    limit: 50,
  };
}

export function isFailedEvent(event: Pick<WebhookEvent, "status"> | null | undefined) {
  return event?.status === "FAILED";
}

export function isProcessedEvent(event: Pick<WebhookEvent, "status"> | null | undefined) {
  return event?.status === "PROCESSED";
}

export function canReplayEvent(event: Pick<WebhookEvent, "status" | "replayable" | "canReplay"> | null | undefined) {
  if (!event) return false;
  if (event.replayable === false || event.canReplay === false) return false;
  return event.status === "FAILED" || event.status === "PROCESSED";
}

export function getReplayMode(event: Pick<WebhookEvent, "status">): ReplayMode {
  return event.status === "FAILED" ? "normal" : "force";
}

export function forceReplayRequiresConfirmation(event: Pick<WebhookEvent, "status"> | null | undefined) {
  return Boolean(event && event.status !== "FAILED");
}

export function filterEventsBySearch(events: WebhookEvent[], search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return events;
  return events.filter(event =>
    [event.id, event.provider, event.traceId, event.providerMessageId, event.errorMessage]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(needle))
  );
}

export function toArrayMetric(value: unknown): Array<{ label: string; value: number }> {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const label = String(record.provider ?? record.orgId ?? record.orgName ?? record.label ?? record.name ?? "Não informado");
        const count = Number(record.count ?? record.total ?? record.value ?? 0);
        return { label, value: Number.isFinite(count) ? count : 0 };
      })
      .filter((item): item is { label: string; value: number } => Boolean(item));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([label, raw]) => ({
      label,
      value: Number(raw) || 0,
    }));
  }

  return [];
}

export function formatWebhookDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatOldestFailedAge(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Sem falhas";

  if (typeof value === "number") {
    const minutes = Math.max(0, Math.round(value / 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h`;
    return `${Math.round(hours / 24)} dias`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} dias`;
}

export function getErrorPreview(error?: string | null, maxLength = 96) {
  if (!error) return "—";
  const normalized = error.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function getMetadata(event: WebhookEvent | null | undefined) {
  return event?.payloadMetadata ?? event?.rawPayloadMetadata ?? null;
}

export function buildSingleReplayInput(event: WebhookEvent) {
  const force = getReplayMode(event) === "force";
  return { id: event.id, force: force || undefined };
}

export function buildSelectedReplayInput(events: WebhookEvent[]) {
  const replayable = events.filter(canReplayEvent);
  const force = replayable.some(forceReplayRequiresConfirmation);
  return {
    ids: replayable.map(event => event.id),
    force: force || undefined,
  };
}

export function getOperationalState(flags: { isLoading?: boolean; isError?: boolean; events: WebhookEvent[] }) {
  if (flags.isLoading) return "loading" as const;
  if (flags.isError) return "error" as const;
  if (flags.events.length === 0) return "empty" as const;
  return "ready" as const;
}
