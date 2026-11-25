import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { premiumTokens } from "./tokens";

const read = (file: string) => readFileSync(file, "utf8");
const shellCss = read("client/src/theme/premium/premium-shell.css");
const code = shellCss.replace(/\/\*[\s\S]*?\*\//g, "");

function rules(css: string) {
  const out: Array<{ selectors: string[]; body: string; layered: boolean }> =
    [];
  const layerStart = css.indexOf("@layer components {");
  let depth = 0;
  let layerDepth = -1;
  let buffer = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      if (
        i >= layerStart &&
        layerStart !== -1 &&
        buffer.trim().startsWith("@layer")
      ) {
        layerDepth = depth;
        depth++;
        buffer = "";
        continue;
      }
      const close = css.indexOf("}", i);
      out.push({
        selectors: buffer
          .split(",")
          .map(s => s.trim())
          .filter(Boolean),
        body: css.slice(i + 1, close),
        layered: layerDepth !== -1 && depth > layerDepth,
      });
      i = close;
      buffer = "";
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === layerDepth) layerDepth = -1;
      buffer = "";
      continue;
    }
    buffer += ch;
  }
  return out;
}

const parsed = rules(code);

describe("Premium shell CSS (PR 2)", () => {
  it("has rules for the shell and the shared Dashboard surfaces", () => {
    const all = parsed.flatMap(rule => rule.selectors).join("\n");
    for (const cls of [
      ".nexo-sidebar",
      ".nexo-sidebar-item",
      ".nexo-sidebar-item-active",
      ".nexo-topbar",
      ".nexo-topbar-control",
      ".nexo-card-kpi",
      ".nexo-surface",
      ".nexo-page-shell",
      ".nexo-badge-neutral",
    ]) {
      expect(all, cls).toContain(cls);
    }
    expect(parsed.length).toBeGreaterThan(15);
  });

  it('only applies while data-skin="premium" is set (app shell, or :root for portals)', () => {
    for (const rule of parsed) {
      for (const selector of rule.selectors) {
        expect(selector, selector).toMatch(
          /^(\.app-root|:root)\[data-skin="premium"\]/
        );
      }
    }
  });

  it("uses Premium tokens only: no hard-coded colours", () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/\b(rgba?|hsla?)\(/);
    expect(code).not.toMatch(/!important/);
    const vars = new Set(
      code.match(/var\((--[a-z0-9-]+)/g)!.map(match => match.slice(4))
    );
    for (const name of vars) {
      expect(premiumTokens.light, name).toHaveProperty(name);
    }
  });

  it("keeps surfaces in @layer components so element utilities still win", () => {
    const surfaces = parsed.filter(rule =>
      rule.selectors.some(
        selector =>
          /nexo-(card-kpi|surface|sidebar-item|topbar-control)\b/.test(
            selector
          ) && !/svg$/.test(selector)
      )
    );
    expect(surfaces.length).toBeGreaterThan(5);
    for (const rule of surfaces)
      expect(rule.layered, rule.selectors[0]).toBe(true);
  });

  it("keeps the unlayered overrides to the utility hooks and Button focus", () => {
    const unlayered = parsed
      .filter(rule => !rule.layered)
      .flatMap(rule => rule.selectors);
    expect(unlayered).toEqual([
      '.app-root[data-skin="premium"] .nexo-skip-link:focus',
      '.app-root[data-skin="premium"] .nexo-notification-count',
      '.app-root[data-skin="premium"] .nexo-sidebar-item-active svg',
      '.app-root[data-skin="premium"] .nexo-sidebar-backdrop',
      ':root[data-skin="premium"] [data-slot="button"]:focus-visible',
    ]);
  });

  it("does not change layout or responsive behaviour (colours, borders and shadows only)", () => {
    const allowed =
      /^(background(-color|-image)?|border(-top|-right|-bottom)?(-color)?|box-shadow|color|outline(-offset)?|cursor|font-weight)$/;
    for (const rule of parsed) {
      for (const declaration of rule.body
        .split(";")
        .map(line => line.trim())
        .filter(Boolean)) {
        const property = declaration.split(":")[0].trim();
        expect(property, `${rule.selectors[0]} → ${declaration}`).toMatch(
          allowed
        );
      }
    }
  });

  it("is loaded after the token file, which is loaded after index.css", () => {
    const main = read("client/src/main.tsx");
    const index = main.indexOf('import "./index.css";');
    const skin = main.indexOf('import "./theme/premium/premium-skin.css";');
    const shell = main.indexOf('import "./theme/premium/premium-shell.css";');
    expect(index).toBeGreaterThan(-1);
    expect(skin).toBeGreaterThan(index);
    expect(shell).toBeGreaterThan(skin);
  });

  it("MainLayout exposes the hooks as plain class names (no visual change when off)", () => {
    const layout = read("client/src/components/MainLayout.tsx");
    expect(layout).toMatch(
      /className="nexo-skip-link sr-only focus:not-sr-only/
    );
    expect(layout).toMatch(
      /className="fixed inset-0 z-30 bg-slate-950\/20 nexo-state-transition nexo-sidebar-backdrop"/
    );
    expect(layout).toMatch(
      /className="nexo-notification-count absolute -right-1 -top-1/
    );
    for (const hook of [
      "nexo-skip-link",
      "nexo-sidebar-backdrop",
      "nexo-notification-count",
    ]) {
      expect(read("client/src/index.css"), hook).not.toContain(hook);
    }
  });
});
