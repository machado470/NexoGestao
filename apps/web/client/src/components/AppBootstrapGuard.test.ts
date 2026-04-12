import { describe, expect, it } from "vitest";
import { shouldBypassFatalBootstrapForAnonymous } from "./AppBootstrapGuard";

describe("AppBootstrapGuard", () => {
  it("libera rota pública quando estado é unauthenticated", () => {
    expect(
      shouldBypassFatalBootstrapForAnonymous({
        state: "failed",
        isPublicRoute: true,
        authState: "unauthenticated",
      })
    ).toBe(true);
  });

  it("mantém fallback fatal em erro real para rota protegida", () => {
    expect(
      shouldBypassFatalBootstrapForAnonymous({
        state: "failed",
        isPublicRoute: false,
        authState: "unauthenticated",
      })
    ).toBe(false);
  });

  it("não ignora falha fatal quando usuário já autenticado", () => {
    expect(
      shouldBypassFatalBootstrapForAnonymous({
        state: "failed",
        isPublicRoute: true,
        authState: "authenticated",
      })
    ).toBe(false);
  });
});
