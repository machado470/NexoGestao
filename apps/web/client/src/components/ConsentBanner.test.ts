import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveConsent, type ConsentPreferences } from "./ConsentBanner.logic";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const validPrefs: ConsentPreferences = {
  marketing: true,
  analytics: true,
  cookies: true,
};

describe("ConsentBanner", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("sucesso ao salvar consentimento", async () => {
    const persistLocal = vi.fn();
    const saved = await saveConsent(validPrefs, {
      fetchImpl: vi.fn(async () => ({ ok: true, status: 200 }) as Response),
      persistLocalImpl: persistLocal,
      timeoutMs: 20,
    });

    expect(saved).toBe(true);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(persistLocal).toHaveBeenCalledWith(validPrefs);
  });

  it.each([
    { marketing: false, analytics: false, cookies: true },
    { marketing: true, analytics: true, cookies: true },
    { marketing: false, analytics: true, cookies: true },
  ] satisfies ConsentPreferences[])(
    "salva preferências %j no Pages sem API",
    async prefs => {
      const fetchImpl = vi.fn();
      const persistLocal = vi.fn();
      const saved = await saveConsent(prefs, {
        staticHosting: true,
        fetchImpl,
        persistLocalImpl: persistLocal,
      });

      expect(saved).toBe(true);
      expect(persistLocal).toHaveBeenCalledWith(prefs);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalledWith(
        "Preferências de privacidade salvas neste navegador."
      );
      expect(toastError).not.toHaveBeenCalled();
    }
  );

  it("não confirma consentimento local quando armazenamento está bloqueado", async () => {
    const fetchImpl = vi.fn();
    const saved = await saveConsent(validPrefs, {
      staticHosting: true,
      fetchImpl,
      persistLocalImpl: () => {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });

    expect(saved).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("mantém a exigência de registro no backend fora do Pages", async () => {
    const persistLocal = vi.fn();
    const saved = await saveConsent(validPrefs, {
      staticHosting: false,
      fetchImpl: vi.fn(async () => ({ ok: false, status: 404 }) as Response),
      persistLocalImpl: persistLocal,
    });

    expect(saved).toBe(false);
    expect(persistLocal).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("falha ao salvar quando backend responde erro", async () => {
    const onClose = vi.fn();
    const saved = await saveConsent(validPrefs, {
      fetchImpl: vi.fn(async () => ({ ok: false, status: 500 }) as Response),
      timeoutMs: 20,
    });

    if (saved) onClose();

    expect(saved).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("não fecha indevidamente em erro de rede", async () => {
    const onClose = vi.fn();
    const saved = await saveConsent(validPrefs, {
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }),
      timeoutMs: 20,
    });

    if (saved) onClose();

    expect(saved).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
