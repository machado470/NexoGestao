import { describe, expect, it } from "vitest";
import {
  buildLoginRedirectPath,
  getRequiresOnboarding,
  readSafeRedirectFromPath,
  resolveRootRouteBranch,
} from "./App";
import { resolveAppBootstrapGuardBranch } from "./components/AppBootstrapGuard";

describe("App routing/auth guard helpers", () => {
  it("monta redirect para login de forma determinística", () => {
    expect(buildLoginRedirectPath("/customers?tab=active")).toBe(
      "/login?redirect=%2Fcustomers%3Ftab%3Dactive"
    );
    expect(buildLoginRedirectPath("/login")).toBe("/login");
    expect(buildLoginRedirectPath("   ")).toBe("/login");
  });

  it("bloqueia redirect inseguro ou que causa loop", () => {
    expect(readSafeRedirectFromPath("/login?redirect=https://evil.com")).toBeNull();
    expect(readSafeRedirectFromPath("/login?redirect=//evil.com")).toBeNull();
    expect(readSafeRedirectFromPath("/login?redirect=/login")).toBeNull();
    expect(readSafeRedirectFromPath("/login?redirect=/forgot-password")).toBeNull();
    expect(readSafeRedirectFromPath("/login?redirect=/executive-dashboard")).toBe(
      "/executive-dashboard"
    );
  });

  it("resolve flag de onboarding para payload válido e envelope nested", () => {
    expect(getRequiresOnboarding({ requiresOnboarding: true })).toBe(true);
    expect(getRequiresOnboarding({ data: { data: { requiresOnboarding: true } } })).toBe(
      true
    );
    expect(getRequiresOnboarding({})).toBe(false);
    expect(getRequiresOnboarding(undefined)).toBe(false);
  });

  it("define branch explícito para RootRoute sem render vazio", () => {
    expect(resolveRootRouteBranch("initializing")).toBe("initializing_landing");
    expect(resolveRootRouteBranch("error")).toBe("error_screen");
    expect(resolveRootRouteBranch("unauthenticated")).toBe("unauthenticated_landing");
    expect(resolveRootRouteBranch("authenticated")).toBe("authenticated_redirect");
    expect(resolveRootRouteBranch("qualquer-coisa")).toBe("unknown_state_fallback");
  });

  it("AppBootstrapGuard nunca entra em branch silencioso para erro interno", () => {
    expect(
      resolveAppBootstrapGuardBranch({
        state: "error",
        isPublicBootstrapPath: false,
      })
    ).toBe("blocking_error");

    expect(
      resolveAppBootstrapGuardBranch({
        state: "initializing",
        isPublicBootstrapPath: true,
      })
    ).toBe("pass_through");
  });
});
