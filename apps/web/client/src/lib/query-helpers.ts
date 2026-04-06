function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapTrpcPayload(payload: unknown): unknown {
  let current = payload;
  let guard = 0;

  while (guard < 10 && isObject(current)) {
    guard += 1;

    if (
      isObject((current as Record<string, unknown>).result) &&
      isObject(
        ((current as Record<string, unknown>).result as Record<string, unknown>)
          .data
      ) &&
      "json" in
        (((current as Record<string, unknown>).result as Record<string, unknown>)
          .data as Record<string, unknown>)
    ) {
      current = (
        ((current as Record<string, unknown>).result as Record<string, unknown>)
          .data as Record<string, unknown>
      ).json;
      continue;
    }

    if (
      isObject((current as Record<string, unknown>).data) &&
      "json" in ((current as Record<string, unknown>).data as Record<string, unknown>)
    ) {
      current = ((current as Record<string, unknown>).data as Record<string, unknown>)
        .json;
      continue;
    }

    if (
      isObject((current as Record<string, unknown>).result) &&
      "json" in
        ((current as Record<string, unknown>).result as Record<string, unknown>)
    ) {
      current = ((current as Record<string, unknown>).result as Record<string, unknown>)
        .json;
      continue;
    }

    if ("json" in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>).json;
      continue;
    }

    break;
  }

  return current;
}

function extractArrayCandidate(payload: unknown): unknown[] {
  const raw = unwrapTrpcPayload(payload);

  if (Array.isArray(raw)) {
    return raw;
  }

  if (!isObject(raw)) {
    return [];
  }

  if (Array.isArray(raw.items)) {
    return raw.items;
  }

  if (Array.isArray(raw.data)) {
    return raw.data;
  }

  if (Array.isArray(raw.rows)) {
    return raw.rows;
  }

  if (Array.isArray(raw.results)) {
    return raw.results;
  }

  if (isObject(raw.data)) {
    const nested = raw.data as Record<string, unknown>;

    if (Array.isArray(nested.items)) {
      return nested.items;
    }

    if (Array.isArray(nested.data)) {
      return nested.data;
    }

    if (Array.isArray(nested.rows)) {
      return nested.rows;
    }

    if (Array.isArray(nested.results)) {
      return nested.results;
    }
  }

  return [];
}

function extractObjectCandidate(payload: unknown): Record<string, unknown> | null {
  const raw = unwrapTrpcPayload(payload);

  if (!isObject(raw)) {
    return null;
  }

  if (isObject(raw.data) && !Array.isArray(raw.data)) {
    return raw.data as Record<string, unknown>;
  }

  return raw;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

export function normalizeArrayPayload<T = any>(payload: unknown): T[] {
  return extractArrayCandidate(payload) as T[];
}

export function normalizeObjectPayload<T = any>(payload: unknown): T | null {
  return (extractObjectCandidate(payload) as T | null) ?? null;
}

export function normalizeAlertsPayload<T = any>(payload: unknown): T {
  const raw = unwrapTrpcPayload(payload);

  if (isObject(raw)) {
    return raw as T;
  }

  return {} as T;
}

export function getPayloadValue<T = unknown>(payload: unknown): T | null {
  const raw = unwrapTrpcPayload(payload);
  return (raw as T) ?? null;
}
