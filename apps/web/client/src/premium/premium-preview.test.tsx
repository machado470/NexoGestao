import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PremiumPreviewPage from "./PremiumPreviewPage";
import { contrastRatio, premiumContrastPairs, premiumTokens } from "./tokens";

describe("Premium tokens", () => {
  it("defines the same tokens in both themes", () => {
    expect(Object.keys(premiumTokens.light).sort()).toEqual(Object.keys(premiumTokens.dark).sort());
  });

  for (const theme of ["dark", "light"] as const) {
    it.each(premiumContrastPairs)(`${theme}: %s on %s reaches %s:1`, (fg, bg, minimum) => {
      const ratio = contrastRatio(premiumTokens[theme][fg], premiumTokens[theme][bg]);
      expect(ratio).toBeGreaterThanOrEqual(minimum);
    });
  }

  it("never puts white text on the brand orange (2.87:1)", () => {
    expect(premiumTokens.dark["--nx-on-brand"]).not.toBe("#ffffff");
    expect(premiumTokens.light["--nx-on-brand"]).not.toBe("#ffffff");
  });
});

describe("Premium preview isolation", () => {
  const css = readFileSync("client/src/premium/premium.css", "utf8");

  it("scopes every CSS rule to the preview (.nx-*)", () => {
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "")
      .match(/[^{}]+(?=\{)/g)!
      .map(selector => selector.trim())
      .filter(selector => selector && !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(50);
    for (const selector of selectors) {
      for (const part of selector.split(/,(?![^(]*\))/)) {
        expect(part, part).toMatch(/\.nx-/);
      }
    }
  });

  it("registers /premium-preview only in development", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toMatch(
      /const PremiumPreviewPage = import\.meta\.env\.DEV\s*\?\s*lazy\(\(\) => import\("\.\/premium\/PremiumPreviewPage"\)\)\s*:\s*null;/
    );
    expect(app).toMatch(/\{PremiumPreviewPage \? \(\s*<Route\s+path="\/premium-preview"/);
  });

  it("is imported by App.tsx only", () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const file = path.join(dir, entry);
        if (statSync(file).isDirectory()) {
          if (!file.endsWith(`${path.sep}premium`)) walk(file);
          continue;
        }
        if (!/\.(tsx?|css)$/.test(entry) || /\.test\./.test(entry)) continue;
        if (/(["'])(\.\/|@\/)premium\//.test(readFileSync(file, "utf8"))) importers.push(file);
      }
    };
    walk("client/src");
    expect(importers).toEqual([path.join("client", "src", "App.tsx")]);
  });
});

describe("Premium preview content", () => {
  const html = renderToStaticMarkup(<PremiumPreviewPage />);

  it("labels everything as demonstration data", () => {
    expect(html).toContain("Laboratório visual NexoGestão Premium");
    expect(html).toContain("dados de demonstração");
  });

  it("renders the five demonstrated modules and shared components", () => {
    for (const id of ["visao-geral", "financas", "clientes", "agenda", "ordens", "governanca", "componentes"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("does not invent modules or decorative data from the reference", () => {
    for (const forbidden of ["Relatórios", "Tráfego", "Orgânico", "Referral", "Saiba mais"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it("keeps the real navigation labels", () => {
    for (const label of ["Dashboard", "Clientes", "Agendamentos", "Ordens de Serviço", "Financeiro", "Governança", "Configurações"]) {
      expect(html).toContain(label);
    }
  });
});
