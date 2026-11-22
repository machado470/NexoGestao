import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveConsentBannerPlacement } from "./ConsentBanner.placement";

// Regression: the fixed consent banner covered the "Entrar" button on phones, so taps never
// reached the login form. On narrow viewports and on public/auth pages it must be in-flow.
describe("consent banner placement", () => {
  it.each([
    "/login", "/login?redirect=%2Fcustomers", "/register", "/forgot-password", "/reset-password",
    "/auth/accept-invite", "/auth/confirm-email", "/", "/precos", "/privacidade",
    "/quote-approval", "/service-acceptance", "/onboarding", "/executive-dashboard", "/customers",
  ])("narrow viewport %s → inline", (pathname) => {
    expect(resolveConsentBannerPlacement({ pathname, wideViewport: false })).toBe("inline");
  });

  it.each(["/login", "/register", "/forgot-password", "/auth/accept-invite", "/", "/produto", "/quote-approval", "/service-acceptance?token=x"])(
    "wide viewport public/auth page %s → inline",
    (pathname) => {
      expect(resolveConsentBannerPlacement({ pathname, wideViewport: true })).toBe("inline");
    },
  );

  it.each(["/executive-dashboard", "/customers", "/settings", "/admin/ip-diagnostic"])(
    "wide viewport internal page %s → floating",
    (pathname) => {
      expect(resolveConsentBannerPlacement({ pathname, wideViewport: true })).toBe("floating");
    },
  );

  it("is rendered before the routes so the inline banner is the top of the page flow", () => {
    const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    expect(app.indexOf("<ConsentBanner />")).toBeGreaterThan(-1);
    expect(app).toMatch(/<ConsentBanner \/>\s*<Router \/>/);
    expect(app).not.toMatch(/<Router \/>\s*<ConsentBanner \/>/);
  });

  it("keeps the consent actions and never records consent without a user action", () => {
    const banner = readFileSync(resolve(__dirname, "ConsentBanner.tsx"), "utf8");
    for (const text of ["Somente essenciais", "Personalizar", "Aceitar tudo", "Fechar banner de cookies", "Política de Privacidade"]) {
      expect(banner).toContain(text);
    }
    // recordConsents only runs from click handlers; the mount effect only reads stored consent.
    const mountEffect = banner.slice(banner.indexOf("useEffect(() => {\n    const stored"), banner.indexOf("const closeBanner"));
    expect(mountEffect).toContain("readStoredConsent()");
    expect(mountEffect).not.toMatch(/saveConsent|recordConsents|persistLocalConsent/);
    // Inline placement has no fixed/absolute overlay.
    expect(banner).toMatch(/\? "relative w-full border-b/);
  });
});
