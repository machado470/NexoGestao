import { beforeEach, describe, expect, it } from "vitest";

import {
  CONSENT_STORAGE_KEY,
  parseStoredConsent,
  persistLocalConsent,
  readStoredConsent,
} from "./ConsentBanner.storage";

const LEGACY_KEY = "nexo:privacy-consent";

type MemoryStorage = {
  clear: () => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>();

  return {
    clear: () => store.clear(),
    getItem: key => (store.has(key) ? store.get(key) ?? null : null),
    removeItem: key => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

describe("ConsentBanner.storage", () => {
  const memoryStorage = createMemoryStorage();

  beforeEach(() => {
    memoryStorage.clear();
    Object.assign(globalThis, {
      window: {
        localStorage: memoryStorage,
      },
    });
  });

  it("considera inválido payload legado primitivo para evitar falso positivo", () => {
    memoryStorage.setItem(CONSENT_STORAGE_KEY, "true");

    const stored = readStoredConsent();

    expect(stored).toBeNull();
    expect(memoryStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it("migra chave legada válida para chave versionada", () => {
    memoryStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ marketing: false, analytics: true, cookies: true })
    );

    const stored = readStoredConsent();

    expect(stored?.preferences).toEqual({
      marketing: false,
      analytics: true,
      cookies: true,
    });
    expect(memoryStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(memoryStorage.getItem(CONSENT_STORAGE_KEY)).toBeTruthy();
  });

  it("persiste consentimento versionado com preferências", () => {
    persistLocalConsent({ marketing: true, analytics: false, cookies: true });

    const raw = memoryStorage.getItem(CONSENT_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = parseStoredConsent(raw ?? "");
    expect(parsed?.preferences).toEqual({
      marketing: true,
      analytics: false,
      cookies: true,
    });
  });
});
