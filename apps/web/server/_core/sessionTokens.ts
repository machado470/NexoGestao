/**
 * Session credentials stay server side: the BFF keeps the JWT only in the httpOnly
 * `nexo_token` cookie and must never echo it to browser JavaScript.
 */
const SESSION_TOKEN_KEYS = new Set([
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
]);
const MAX_DEPTH = 8;

/** Returns a copy of `value` without session token fields at any nesting level. */
export function withoutSessionTokens<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => withoutSessionTokens(item, depth + 1)) as T;
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SESSION_TOKEN_KEYS.has(key)) continue;
    output[key] = withoutSessionTokens(child, depth + 1);
  }
  return output as T;
}

/** Browser-safe auth mutation result: API payload without tokens plus an explicit session flag. */
export function toBrowserAuthResult(result: unknown, sessionEstablished: boolean) {
  const safe = withoutSessionTokens(result);
  return {
    ...(safe && typeof safe === "object" && !Array.isArray(safe) ? (safe as Record<string, unknown>) : {}),
    sessionEstablished,
  };
}
