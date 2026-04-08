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
    const saved = await saveConsent(validPrefs, {
      fetchImpl: vi.fn(async () => ({ ok: true, status: 200 } as Response)),
      timeoutMs: 20,
    });

    expect(saved).toBe(true);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("falha ao salvar quando backend responde erro", async () => {
    const onClose = vi.fn();
    const saved = await saveConsent(validPrefs, {
      fetchImpl: vi.fn(async () => ({ ok: false, status: 500 } as Response)),
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
