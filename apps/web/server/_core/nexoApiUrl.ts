const DEFAULT_NEXO_API_URL = "http://127.0.0.1:3000";

function normalizeLocalhostHostname(hostname: string): string {
  return hostname.trim().toLowerCase() === "localhost" ? "127.0.0.1" : hostname;
}

export function resolveNexoApiUrl(raw = process.env.NEXO_API_URL): string {
  const fallback = DEFAULT_NEXO_API_URL;
  const base = (raw ?? "").trim() || fallback;

  try {
    const parsed = new URL(base);
    parsed.hostname = normalizeLocalhostHostname(parsed.hostname);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
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
