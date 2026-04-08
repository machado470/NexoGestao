import type { ConsentPreferences } from "./ConsentBanner.logic";

export type ConsentStorage = {
  timestamp: string;
  preferences: ConsentPreferences;
};

export const CONSENT_STORAGE_KEY = "nexo:privacy-consent:v1";
const LEGACY_CONSENT_KEYS = ["nexo:privacy-consent"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConsentPreferences(value: unknown): value is ConsentPreferences {
  if (!isRecord(value)) return false;

  return (
    typeof value.marketing === "boolean" &&
    typeof value.analytics === "boolean" &&
    value.cookies === true
  );
}

export function parseStoredConsent(raw: string): ConsentStorage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (isConsentPreferences(parsed)) {
      return {
        timestamp: new Date(0).toISOString(),
        preferences: parsed,
      };
    }

    if (!isRecord(parsed)) return null;

    if (!isConsentPreferences(parsed.preferences)) return null;

    return {
      timestamp:
        typeof parsed.timestamp === "string" && parsed.timestamp.trim().length > 0
          ? parsed.timestamp
          : new Date(0).toISOString(),
      preferences: parsed.preferences,
    };
  } catch {
    return null;
  }
}

export function readStoredConsent(): ConsentStorage | null {
  if (typeof window === "undefined") return null;

  const primaryRaw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (primaryRaw) {
    const parsed = parseStoredConsent(primaryRaw);
    if (parsed) return parsed;

    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  }

  for (const legacyKey of LEGACY_CONSENT_KEYS) {
    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (!legacyRaw) continue;

    const parsedLegacy = parseStoredConsent(legacyRaw);
    if (!parsedLegacy) {
      window.localStorage.removeItem(legacyKey);
      continue;
    }

    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(parsedLegacy));
    window.localStorage.removeItem(legacyKey);
    return parsedLegacy;
  }

  return null;
}

export function persistLocalConsent(prefs: ConsentPreferences) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      preferences: prefs,
    } satisfies ConsentStorage)
  );
}
