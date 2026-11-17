import { beforeEach, describe, expect, it, vi } from "vitest";
import { settingsRouter } from "./routers/settings";
import { authedGet } from "./_core/nexoTransport";
vi.mock("./_core/nexoTransport", () => ({
  authedGet: vi.fn(),
  authedPatch: vi.fn(),
  authedPost: vi.fn(),
}));
const caller = settingsRouter.createCaller({
  user: { id: "user-1", token: "session", validated: true },
} as any);
describe("limited display preferences transport", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses the protected limited endpoint", async () => {
    vi.mocked(authedGet).mockResolvedValue({
      timezone: "America/Sao_Paulo",
      currency: "BRL",
    });
    await expect(caller.displayPreferences()).resolves.toEqual({
      timezone: "America/Sao_Paulo",
      currency: "BRL",
    });
    expect(authedGet).toHaveBeenCalledWith(
      expect.anything(),
      "/organization-settings/display-preferences"
    );
  });
  it.each([
    { timezone: "Mars/Olympus", currency: "BRL" },
    { timezone: "UTC", currency: "BAD" },
    { timezone: "UTC", currency: "USD", secret: "must-not-pass" },
  ])("rejects invalid or expanded contracts", async response => {
    vi.mocked(authedGet).mockResolvedValue(response);
    await expect(caller.displayPreferences()).rejects.toThrow();
  });
  it("requires an authenticated session", async () => {
    await expect(
      settingsRouter.createCaller({ user: null } as any).displayPreferences()
    ).rejects.toThrow();
    expect(authedGet).not.toHaveBeenCalled();
  });
});
