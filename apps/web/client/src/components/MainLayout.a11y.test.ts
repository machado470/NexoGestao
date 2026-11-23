import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Source-level guardrails for the main navigation accessibility (NEXO-009).
// The project has no DOM test environment; behaviour is validated in Chromium.
describe("MainLayout navigation accessibility guardrails", () => {
  const source = readFileSync("client/src/components/MainLayout.tsx", "utf8");

  it("renders a skip link to the main content before the navigation", () => {
    const skipLink = source.indexOf("Pular para o conteúdo");
    expect(skipLink).toBeGreaterThan(-1);
    expect(source).toContain("href={`#${MAIN_CONTENT_ID}`}");
    expect(skipLink).toBeLessThan(source.indexOf("<aside"));
    expect(skipLink).toBeLessThan(source.indexOf("<header"));
  });

  it("lets the main landmark receive focus from the skip link", () => {
    expect(source).toMatch(/<main\s+id=\{MAIN_CONTENT_ID\}\s+tabIndex=\{-1\}/);
  });

  it("names the sidebar navigation and wires the toggle to it", () => {
    expect(source).toMatch(/<nav\s+id=\{SIDEBAR_NAV_ID\}\s+aria-label="Navegação principal"/);
    expect(source).toContain("{...resolveSidebarToggleA11y(sidebarCollapsed)}");
  });

  it("gives the logo button an accessible name even when collapsed", () => {
    expect(source).toContain('aria-label="NexoGestão, ir para o Dashboard"');
  });

  it("keeps the overlay backdrop out of the keyboard and screen reader flow", () => {
    expect(source).toMatch(
      /<button\s+type="button"\s+tabIndex=\{-1\}\s+aria-hidden="true"\s+className="fixed inset-0 z-30/
    );
  });
});
