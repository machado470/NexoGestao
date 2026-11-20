const READ_RETRY_DELAY_MS = 500;

/** One retry for a temporary read failure; never repeat writes or access failures. */
export function retryTransientRead(
  failureCount: number,
  error: unknown
): boolean {
  if (failureCount >= 1) return false;
  if (!error || typeof error !== "object") return false;
  const value = error as {
    data?: { httpStatus?: number; code?: string; retryAfterSeconds?: number };
    cause?: unknown;
    message?: string;
  };
  // The server asked for a longer wait than our retry delay: retrying now would only be refused.
  const retryAfter = value.data?.retryAfterSeconds;
  if (typeof retryAfter === "number" && retryAfter * 1000 > READ_RETRY_DELAY_MS) return false;
  const status = value.data?.httpStatus;
  if (status !== undefined)
    return [408, 429, 500, 502, 503, 504].includes(status);
  if (value.data?.code)
    return ["TIMEOUT", "TOO_MANY_REQUESTS", "SERVICE_UNAVAILABLE", "INTERNAL_SERVER_ERROR"].includes(
      value.data.code
    );
  return (
    error instanceof TypeError ||
    value.cause instanceof TypeError ||
    /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(
      value.message ?? ""
    )
  );
}

export const transientReadOptions = {
  retry: retryTransientRead,
  retryDelay: READ_RETRY_DELAY_MS,
} as const;
