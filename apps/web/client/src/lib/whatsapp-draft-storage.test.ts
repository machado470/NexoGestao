import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAppStorage } from "./app-storage";
import {
  persistWhatsAppDrafts,
  readWhatsAppDrafts,
  whatsappDraftStorageKey,
} from "./whatsapp-draft-storage";

function makeStorage() {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("WhatsApp draft identity and logout", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: makeStorage(), sessionStorage: makeStorage() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("separates the same conversation across users and organizations", () => {
    const owner = whatsappDraftStorageKey({ id: "a", organizationId: "org-1" });
    const otherUser = whatsappDraftStorageKey({ id: "b", organizationId: "org-1" });
    const otherOrg = whatsappDraftStorageKey({ id: "a", organizationId: "org-2" });
    persistWhatsAppDrafts(owner, { conversation: "Rascunho A", second: "Rascunho B" });
    expect(readWhatsAppDrafts(otherUser)).toEqual({});
    expect(readWhatsAppDrafts(otherOrg)).toEqual({});
    expect(readWhatsAppDrafts(owner)).toEqual({ conversation: "Rascunho A", second: "Rascunho B" });
  });

  it("does not restore or persist drafts without a complete identity", () => {
    expect(whatsappDraftStorageKey(null)).toBeNull();
    expect(whatsappDraftStorageKey({ id: "a" })).toBeNull();
    expect(whatsappDraftStorageKey({ organizationId: "org-1" })).toBeNull();
    persistWhatsAppDrafts(null, { conversation: "Texto" });
    expect(readWhatsAppDrafts(null)).toEqual({});
    expect(window.localStorage.length).toBe(0);
  });

  it("does not associate legacy drafts with the current account", () => {
    window.localStorage.setItem("nexo.whatsapp.composer.v2", JSON.stringify("Texto antigo"));
    window.localStorage.setItem("nexo.whatsapp.composer.v3", JSON.stringify({ conversation: "Texto antigo" }));
    expect(readWhatsAppDrafts(whatsappDraftStorageKey({ id: "a", organizationId: "org-1" }))).toEqual({});
  });

  it("removes current and legacy application data from both storages on logout", () => {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      storage.setItem("nexo.whatsapp.composer.v3", "legacy");
      storage.setItem("nexo:whatsapp:composer:v4:org-1:a", "draft");
      storage.setItem("nexogestao_old", "legacy");
      storage.setItem("pilot-onboarding:state", "state");
      storage.setItem("unrelated-app", "preserve");
    }
    clearAppStorage();
    for (const storage of [window.localStorage, window.sessionStorage]) {
      expect(storage.length).toBe(1);
      expect(storage.getItem("unrelated-app")).toBe("preserve");
    }
  });

  it.each(["null", "[]", '"text"', "bad JSON", '{"conversation":42}'])(
    "handles invalid stored draft data: %s", raw => {
      const key = whatsappDraftStorageKey({ id: "a", organizationId: "org-1" })!;
      window.localStorage.setItem(key, raw);
      expect(readWhatsAppDrafts(key)).toEqual({});
    }
  );

  it("keeps storage keys distinct when identifiers contain separators", () => {
    expect(whatsappDraftStorageKey({ id: "b:c", organizationId: "a" }))
      .not.toBe(whatsappDraftStorageKey({ id: "c", organizationId: "a:b" }));
  });

  it("tolerates blocked browser storage", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage { throw new Error("Storage unavailable"); },
    });
    const key = whatsappDraftStorageKey({ id: "a", organizationId: "org-1" });
    expect(readWhatsAppDrafts(key)).toEqual({});
    expect(() => persistWhatsAppDrafts(key, { conversation: "Texto" })).not.toThrow();
  });
});
