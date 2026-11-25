import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, premiumAliasMap, premiumTokens } from "./tokens";

const read = (file: string) => readFileSync(`client/src/${file}`, "utf8");
const css = read("theme/premium/premium-overlays.css");
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

const selectors = code
  .replace(/@layer components \{/, "")
  .match(/[^{}]+(?=\{)/g)!
  .flatMap(selector => selector.split(/,(?![^(]*\))/))
  .map(selector => selector.trim())
  .filter(Boolean);

describe("Premium overlays (PR 4a): modal and overlay aliases", () => {
  const modalSurfaces = [
    "--modal-bg",
    "--modal-header-bg",
    "--modal-body-bg",
    "--modal-footer-bg",
    "--app-overlay-bg",
    "--app-overlay-header",
    "--app-overlay-body",
    "--app-overlay-footer",
  ];

  it("paints every modal section with the same elevated surface as menus and popovers", () => {
    for (const alias of modalSurfaces)
      expect(premiumAliasMap[alias], alias).toBe("--nx-raised");
    expect(premiumAliasMap["--app-overlay-surface"]).toBe("--nx-raised");
    expect(premiumAliasMap["--popover"]).toBe("--nx-raised");
    expect(premiumAliasMap["--modal-section-bg"]).toBe("--nx-raised");
  });

  it("maps the feedback aliases (app-*) to Premium state tokens", () => {
    expect(premiumAliasMap).toMatchObject({
      "--app-text-primary": "--nx-text",
      "--app-text-secondary": "--nx-text-2",
      "--app-text-muted": "--nx-muted",
      "--app-success": "--nx-ok",
      "--app-warning": "--nx-warn",
      "--app-danger": "--nx-bad",
      "--app-surface-success": "--nx-ok-soft",
      "--app-surface-warning": "--nx-warn-soft",
      "--app-surface-critical": "--nx-bad-soft",
      "--app-accent": "--nx-brand-text",
    });
  });

  it("modal and overlay aliases also apply on :root, so Radix portals inherit them", () => {
    const skin = read("theme/premium/premium-skin.css");
    const light = skin.slice(
      skin.indexOf(':root[data-skin="premium"],'),
      skin.indexOf("}")
    );
    for (const alias of modalSurfaces)
      expect(light, alias).toContain(`${alias}: var(--nx-raised);`);
  });

  it("text on overlays meets WCAG AA in both themes", () => {
    for (const theme of ["dark", "light"] as const) {
      const t = premiumTokens[theme];
      for (const fg of [
        "--nx-text",
        "--nx-text-2",
        "--nx-muted",
        "--nx-brand-text",
      ] as const) {
        expect(
          contrastRatio(t[fg], t["--nx-raised"]),
          `${theme} ${fg}`
        ).toBeGreaterThanOrEqual(4.5);
      }
      for (const [fg, bg] of [
        ["--nx-ok", "--nx-ok-soft"],
        ["--nx-warn", "--nx-warn-soft"],
        ["--nx-bad", "--nx-bad-soft"],
      ] as const) {
        expect(
          contrastRatio(t[fg], t[bg]),
          `${theme} ${fg}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("Premium overlays (PR 4a): premium-overlays.css", () => {
  it('only applies under :root[data-skin="premium"] (portals included)', () => {
    expect(selectors.length).toBeGreaterThanOrEqual(4);
    for (const selector of selectors) {
      expect(selector, selector).toMatch(/^:root\[data-skin="premium"\]/);
    }
  });

  it("lives in @layer components: replaces @layer base rules, still loses to utilities", () => {
    expect(code.trim()).toMatch(/^@layer components \{[\s\S]*\}$/);
    expect(code).not.toMatch(/!important/);
  });

  it("uses Premium tokens only and changes colours only", () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/\b(rgba?|hsla?)\(/);
    for (const name of new Set(
      code.match(/var\((--[a-z0-9-]+)/g)!.map(m => m.slice(4))
    )) {
      expect(premiumTokens.light, name).toHaveProperty(name);
    }
    for (const declaration of code.match(/[a-z-]+(?=\s*:\s)/g)!) {
      expect(declaration).toMatch(/^(background(-color)?|color)$/);
    }
  });

  it("covers the html/body background and the skeleton shimmer hard-coded in index.css", () => {
    const index = read("index.css");
    expect(index).toMatch(
      /html,\s*body \{\s*min-height: 100vh;\s*background-color: #f8f9fb;/
    );
    expect(index).toMatch(/rgba\(255, 255, 255, 0\.42\) 50%/);
    expect(selectors).toEqual(
      expect.arrayContaining([
        ':root[data-skin="premium"]',
        ':root[data-skin="premium"] body',
        ':root[data-skin="premium"] .nexo-skeleton',
        ':root[data-skin="premium"] .nexo-skeleton::after',
      ])
    );
  });

  it("is loaded after the shell rules", () => {
    const main = read("main.tsx");
    const shell = main.indexOf('import "./theme/premium/premium-shell.css";');
    const overlays = main.indexOf(
      'import "./theme/premium/premium-overlays.css";'
    );
    expect(shell).toBeGreaterThan(-1);
    expect(overlays).toBeGreaterThan(shell);
  });

  it("does not touch component sources (no props or behaviour change)", () => {
    for (const file of [
      "components/ui/dialog.tsx",
      "components/ui/alert-dialog.tsx",
      "components/ui/dropdown-menu.tsx",
      "components/ui/popover.tsx",
      "components/ui/sonner.tsx",
      "components/ui/skeleton.tsx",
      "components/app-modal-system.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/--nx-|data-skin/);
    }
  });
});
