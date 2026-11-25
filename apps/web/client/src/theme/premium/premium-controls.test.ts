import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, premiumTokens } from "./tokens";

const read = (file: string) => readFileSync(`client/src/${file}`, "utf8");

function sourceFiles(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry);
    if (statSync(file).isDirectory()) sourceFiles(file, out);
    else if (/\.tsx$/.test(entry) && !/\.test\./.test(entry)) out.push(file);
  }
  return out;
}

const ON_BRAND = "text-[var(--nx-on-brand,#fff)]";
const BRAND_TEXT = "text-[var(--nx-brand-text,var(--accent-primary))]";

/** Central components and the Dashboard, migrated in PR 3. */
const central = [
  "components/app-system.tsx",
  "components/internal-page-system.tsx",
  "components/operational/index.tsx",
  "components/app/OperationalCommandLayer.tsx",
  "components/MobileHome.tsx",
  "components/MobileUpcomingAppointment.tsx",
  "components/MainLayout.tsx",
  "pages/ExecutiveDashboard.tsx",
];

describe("Premium controls (PR 3): flag OFF keeps today's colours", () => {
  it("the Premium tokens used as fallbacks exist only under data-skin", () => {
    const index = read("index.css");
    for (const token of ["--nx-on-brand", "--nx-brand-text"]) {
      expect(index).not.toContain(`${token}:`);
    }
    const skin = read("theme/premium/premium-skin.css");
    const selectors = skin
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .match(/[^{}]+(?=\{)/g)!;
    for (const selector of selectors.flatMap(s => s.split(","))) {
      expect(selector.trim()).toMatch(/\[data-skin="premium"\]/);
    }
  });

  it("Button primary/default: dark text on orange in Premium, white otherwise", () => {
    const button = read("components/ui/button.tsx");
    expect(button).not.toMatch(/\btext-white\b/);
    expect(
      button.split(`bg-[var(--accent-primary)] ${ON_BRAND}`).length - 1
    ).toBe(2);
  });

  it("Button link: accessible orange text in Premium, --primary otherwise", () => {
    expect(read("components/ui/button.tsx")).toContain(
      'link: "text-[var(--nx-brand-text,var(--primary))] underline-offset-4 hover:underline"'
    );
  });

  it("Tabs active trigger: dark text on orange in Premium, white otherwise", () => {
    const tabs = read("components/ui/tabs.tsx");
    expect(tabs).not.toMatch(/\btext-white\b/);
    expect(tabs).toContain(`data-[state=active]:${ON_BRAND}`);
  });

  it("central components no longer paint text with raw --accent-primary", () => {
    for (const file of central) {
      const source = read(file);
      expect(source, file).not.toContain("text-[var(--accent-primary)]");
      expect(source, file).toContain(BRAND_TEXT);
    }
  });

  it("every Premium fallback falls back to the exact colour used before", () => {
    const all = sourceFiles("client/src")
      .map(file => readFileSync(file, "utf8"))
      .join("\n");
    const fallbacks = all.match(/text-\[var\(--nx-[a-z-]+,[^\]]+\)\]/g) ?? [];
    expect(fallbacks.length).toBeGreaterThanOrEqual(21);
    for (const usage of new Set(fallbacks)) {
      expect([
        ON_BRAND,
        BRAND_TEXT,
        "text-[var(--nx-brand-text,var(--primary))]",
      ]).toContain(usage);
    }
  });
});

describe("Premium controls (PR 3): WCAG AA with the flag ON", () => {
  for (const theme of ["dark", "light"] as const) {
    const t = premiumTokens[theme];
    it(`${theme}: Button primary text on orange (default and hover) ≥ 4.5:1`, () => {
      expect(
        contrastRatio(t["--nx-on-brand"], t["--nx-brand"])
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(t["--nx-on-brand"], t["--nx-brand-hover"])
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: orange links and actions ≥ 4.5:1 on every Premium surface`, () => {
      for (const bg of [
        "--nx-bg",
        "--nx-surface",
        "--nx-raised",
        "--nx-brand-soft",
      ] as const) {
        expect(
          contrastRatio(t["--nx-brand-text"], t[bg]),
          bg
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${theme}: focus ring ≥ 3:1 against the page and surfaces`, () => {
      for (const bg of ["--nx-bg", "--nx-surface", "--nx-raised"] as const) {
        expect(
          contrastRatio(t["--nx-focus"], t[bg]),
          bg
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("documents the failures being fixed (before: white on orange, raw orange text)", () => {
    expect(contrastRatio("#ffffff", "#ff6a01")).toBeLessThan(3);
    expect(
      contrastRatio("#ff6a01", premiumTokens.light["--nx-raised"])
    ).toBeLessThan(3);
    expect(
      contrastRatio("#ff6a01", premiumTokens.light["--nx-bg"])
    ).toBeLessThan(3);
  });

  it("Button has a visible keyboard focus in Premium (also inside portals)", () => {
    const shell = read("theme/premium/premium-shell.css");
    expect(shell).toMatch(
      /:root\[data-skin="premium"\] \[data-slot="button"\]:focus-visible \{\s*outline: 2px solid var\(--nx-focus\);\s*outline-offset: 2px;\s*\}/
    );
  });

  it("mobile bottom navigation: accessible active and focus colours", () => {
    const shell = read("theme/premium/premium-shell.css");
    expect(shell).toMatch(
      /\.mobile-app-nav button\[aria-current="page"\] \{\s*background: var\(--nx-brand-soft\);\s*color: var\(--nx-brand-text\);/
    );
    expect(shell).toMatch(
      /\.mobile-app-nav button:focus-visible \{\s*outline: 2px solid var\(--nx-focus\);/
    );
  });
});

describe("Premium controls (PR 3): shared status badges", () => {
  const shell = read("theme/premium/premium-shell.css");
  const tones = {
    success: "ok",
    warning: "warn",
    danger: "bad",
    info: "info",
  } as const;

  for (const [tone, token] of Object.entries(tones)) {
    it(`nexo-badge-${tone} uses --nx-${token} on --nx-${token}-soft (≥ 4.5:1 in both themes)`, () => {
      expect(shell).toMatch(
        new RegExp(
          `\\.nexo-badge-${tone} \\{\\s*color: var\\(--nx-${token}\\);\\s*background: var\\(--nx-${token}-soft\\);`
        )
      );
      for (const theme of ["dark", "light"] as const) {
        const t = premiumTokens[theme];
        const fg = t[`--nx-${token}` as keyof typeof t];
        const bg = t[`--nx-${token}-soft` as keyof typeof t];
        expect(contrastRatio(fg, bg), theme).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("nexo-badge-accent uses the accessible orange text", () => {
    expect(shell).toMatch(
      /\.nexo-badge-accent \{\s*color: var\(--nx-brand-text\);\s*background: var\(--nx-brand-soft\);/
    );
  });

  it("--info follows the Premium info token", () => {
    expect(read("theme/premium/tokens.ts")).toContain('"--info": "--nx-info"');
  });
});

describe("Premium controls (PR 3): remaining work is tracked, not hidden", () => {
  it("raw orange text outside the central components stays at or below today's count", () => {
    const remaining = sourceFiles("client/src").filter(file =>
      readFileSync(file, "utf8").includes("text-[var(--accent-primary)]")
    );
    // Module pages and modals, to be handled by each module's migration.
    const count = remaining
      .map(
        file =>
          readFileSync(file, "utf8").split("text-[var(--accent-primary)]")
            .length - 1
      )
      .reduce((a, b) => a + b, 0);
    expect(count).toBeLessThanOrEqual(16);
    for (const file of central) {
      expect(remaining).not.toContain(path.join("client", "src", file));
    }
  });
});
