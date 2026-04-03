export function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

export function normalizeArrayPayload<T = any>(payload: any): T[] {
  if (Array.isArray(payload?.data?.data?.items)) {
    return payload.data.data.items as T[];
  }

  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items as T[];
  }

  if (Array.isArray(payload?.data?.data)) {
    return payload.data.data as T[];
  }

  if (Array.isArray(payload?.data)) {
    return payload.data as T[];
  }

  if (Array.isArray(payload?.items)) {
    return payload.items as T[];
  }

  if (Array.isArray(payload)) {
    return payload as T[];
  }

  return [];
}

export function normalizeObjectPayload<T = any>(payload: any): T | null {
  if (payload?.data?.data && typeof payload.data.data === "object") {
    return payload.data.data as T;
  }

  if (payload?.data && typeof payload.data === "object") {
    return payload.data as T;
  }

  if (payload && typeof payload === "object") {
    return payload as T;
  }

  return null;
}

export function normalizeAlertsPayload<T = any>(payload: any): T {
  return (payload?.data?.data ?? payload?.data ?? payload ?? {}) as T;
}
