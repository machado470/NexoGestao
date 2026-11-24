import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guardrails for the NEXO-017 dashboard fixes. The project has no DOM test
// environment, so layout and contrast are protected at source level; the
// rendered behaviour was validated in Chromium at 390–1920px, both themes.
const dashboard = readFileSync("client/src/pages/ExecutiveDashboard.tsx", "utf8");
const commandLayer = readFileSync(
  "client/src/components/app/OperationalCommandLayer.tsx",
  "utf8"
);
const pageSystem = readFileSync("client/src/components/internal-page-system.tsx", "utf8");
const css = readFileSync("client/src/index.css", "utf8");

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Accent tint rgba(232,119,46,alpha) composited over an opaque background. */
function accentTint(alpha: number, background: string) {
  const accent = [232, 119, 46];
  return (
    "#" +
    [1, 3, 5]
      .map((i, k) =>
        Math.round(accent[k] * alpha + parseInt(background.slice(i, i + 2), 16) * (1 - alpha))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function tokenIn(selector: string, token: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}", start));
  const match = block.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
  expect(match, `${token} in ${selector}`).not.toBeNull();
  return match![1];
}

describe("Dashboard attention row", () => {
  it("bounds the action column so the text column never collapses", () => {
    expect(dashboard).toContain("md:grid-cols-[auto_minmax(0,1fr)_minmax(8rem,14rem)]");
    expect(dashboard).not.toContain("md:grid-cols-[auto_minmax(0,1fr)_auto]");
  });

  it("lets the action label wrap instead of forcing its width", () => {
    expect(dashboard).toMatch(
      /className="h-auto min-h-9 w-full whitespace-normal[^"]*"\s+size="sm"\s+onClick=\{\(\) => navigate\(item\.path\)\}/
    );
  });
});

describe("Next best action panel", () => {
  it("wraps long codes in the problem and consequence columns", () => {
    const wrapped = commandLayer.match(
      /<p className="min-w-0 \[overflow-wrap:anywhere\]">\s*<strong className="text-\[var\(--text-primary\)\]">(Problema|Consequência):/g
    );
    expect(wrapped).toHaveLength(4);
  });

  it("keeps the primary action inside the card", () => {
    expect(commandLayer).toContain(
      "h-auto min-h-9 min-w-0 flex-[1.35] justify-between whitespace-normal"
    );
  });
});

describe("Accent badges", () => {
  it("defines --accent-text for both app themes", () => {
    expect(tokenIn(".app-root", "--accent-text")).toBe("#9a4a16");
    expect(tokenIn('.app-root[data-theme="dark"]', "--accent-text")).toBe("#f4a46c");
  });

  it("uses the token for the light .nexo-badge-accent and keeps the dark tone", () => {
    expect(css).toMatch(
      /\.app-root\[data-theme="light"\] \.nexo-badge-accent \{\s*color: var\(--accent-text\);/
    );
    expect(css).toMatch(/\.nexo-badge-accent \{\s*color: #ffd6bd;/);
    expect(pageSystem).toContain("bg-[var(--accent-soft)] text-[var(--accent-text)]");
  });

  it("reaches WCAG AA (4.5:1) on the accent surfaces measured in the app", () => {
    const light = tokenIn(".app-root", "--accent-text");
    const dark = tokenIn('.app-root[data-theme="dark"]', "--accent-text");
    // --accent-soft as rendered (axe) and the .nexo-badge-accent tint over the app surfaces.
    for (const background of ["#f3e6df", accentTint(0.18, "#ffffff"), accentTint(0.18, "#fbfdff")]) {
      expect(contrast(light, background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of ["#392d2e", accentTint(0.18, "#152036"), accentTint(0.18, "#0f172b")]) {
      expect(contrast(dark, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("#ffd6bd", accentTint(0.18, "#152036"))).toBeGreaterThanOrEqual(4.5);
  });
});
