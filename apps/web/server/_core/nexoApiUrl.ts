const DEFAULT_NEXO_API_URL = "http://127.0.0.1:3000";
const API_PREFIX = "/v1";

function normalizeLocalhostHostname(hostname: string): string {
  return hostname.trim().toLowerCase() === "localhost" ? "127.0.0.1" : hostname;
}

export function resolveNexoApiUrl(raw = process.env.NEXO_API_URL): string {
  const fallback = DEFAULT_NEXO_API_URL;
  const base = (raw ?? "").trim() || fallback;

  try {
    const parsed = new URL(base);
    parsed.hostname = normalizeLocalhostHostname(parsed.hostname);
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = normalizedPathname.endsWith(API_PREFIX)
      ? normalizedPathname
      : `${normalizedPathname}${API_PREFIX}`;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return `${fallback}${API_PREFIX}`;
  }
}

export function getNexoApiResolutionMetadata(raw = process.env.NEXO_API_URL) {
  const resolved = resolveNexoApiUrl(raw);
  return {
    configured: (raw ?? "").trim() || null,
    resolved,
    usedFallback: !(raw ?? "").trim(),
    normalizedLocalhost:
      Boolean(raw) &&
      (() => {
        try {
          return new URL(String(raw)).hostname.trim().toLowerCase() === "localhost";
        } catch {
          return false;
        }
      })(),
  };
}
