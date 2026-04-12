import { describe, expect, it } from "vitest";
import {
  buildLoginRedirectPath,
  getRequiresOnboarding,
  readSafeRedirectFromPath,
} from "./App";

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
});
