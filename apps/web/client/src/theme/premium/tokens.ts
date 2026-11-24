/**
 * NexoGestão Premium — design tokens (PR 1, infrastructure only).
 *
 * Single source of truth for the Premium skin. `premium-skin.css` is generated
 * from this file (see `buildPremiumSkinCss`) and a test keeps both in sync.
 * Nothing here is applied unless the skin flag is on (see `flag.ts`).
 */

export type PremiumTheme = "dark" | "light";

const darkTokens = {
  "--nx-bg": "#08080a",
  "--nx-surface": "#111113",
  "--nx-raised": "#18181b",
  "--nx-line": "#26262a",
  "--nx-line-strong": "#71717a",
  "--nx-text": "#f4f4f5",
  "--nx-text-2": "#a1a1aa",
  "--nx-muted": "#8b8b93",
  "--nx-brand": "#ff6a01",
  "--nx-brand-hover": "#ff7d1f",
  "--nx-on-brand": "#0a0a0a",
  "--nx-brand-text": "#ff8a3d",
  "--nx-brand-soft": "#2a1506",
  "--nx-chart-1": "#ff6a01",
  "--nx-ok": "#4ade80",
  "--nx-ok-soft": "#0f2417",
  "--nx-info": "#7cb4ff",
  "--nx-info-soft": "#0f1d33",
  "--nx-warn": "#fbbf24",
  "--nx-warn-soft": "#2a1f06",
  "--nx-bad": "#fb8a8a",
  "--nx-bad-soft": "#2d1212",
  "--nx-on-bad": "#0a0a0a",
  "--nx-focus": "#ff8a3d",
  "--nx-scrim": "rgba(0, 0, 0, 0.66)",
  "--nx-shadow": "none",
} as const;

export type PremiumTokenName = keyof typeof darkTokens;

const lightTokens: Record<PremiumTokenName, string> = {
  "--nx-bg": "#f7f7f8",
  "--nx-surface": "#ffffff",
  "--nx-raised": "#f1f1f3",
  "--nx-line": "#e4e4e7",
  "--nx-line-strong": "#7a7a82",
  "--nx-text": "#18181b",
  "--nx-text-2": "#52525b",
  "--nx-muted": "#6b6b74",
  "--nx-brand": "#ff6a01",
  "--nx-brand-hover": "#e85f00",
  "--nx-on-brand": "#0a0a0a",
  "--nx-brand-text": "#b4460f",
  "--nx-brand-soft": "#fff1e6",
  "--nx-chart-1": "#c2410c",
  "--nx-ok": "#166534",
  "--nx-ok-soft": "#e6f4ea",
  "--nx-info": "#1d4ed8",
  "--nx-info-soft": "#e8efff",
  "--nx-warn": "#854d0e",
  "--nx-warn-soft": "#fdf3dc",
  "--nx-bad": "#b91c1c",
  "--nx-bad-soft": "#fdecec",
  "--nx-on-bad": "#ffffff",
  "--nx-focus": "#b4460f",
  "--nx-scrim": "rgba(24, 24, 27, 0.45)",
  "--nx-shadow":
    "0 1px 2px rgba(24, 24, 27, 0.06), 0 8px 24px -12px rgba(24, 24, 27, 0.12)",
};

export const premiumTokens: Record<
  PremiumTheme,
  Record<PremiumTokenName, string>
> = {
  dark: darkTokens,
  light: lightTokens,
};

/** Typography: DM Sans is already loaded by index.css (Google Fonts). */
export const premiumFontStack =
  '"DM Sans", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Existing aliases used by current pages, re-pointed to Premium tokens when the
 * skin is on. Aliases keep their names, so no component has to change.
 */
export const premiumAliasMap: Record<string, PremiumTokenName> = {
  // Page backgrounds
  "--bg-app": "--nx-bg",
  "--bg-page": "--nx-bg",
  "--nexo-app-bg": "--nx-bg",
  "--background": "--nx-bg",
  // Surfaces
  "--surface-base": "--nx-surface",
  "--surface-primary": "--nx-surface",
  "--bg-surface": "--nx-surface",
  "--app-surface": "--nx-surface",
  "--app-surface-1": "--nx-surface",
  "--app-card": "--nx-surface",
  "--nexo-card-surface": "--nx-surface",
  "--card": "--nx-surface",
  "--field-bg": "--nx-surface",
  "--surface-elevated": "--nx-raised",
  "--surface-subtle": "--nx-raised",
  "--modal-section-bg": "--nx-raised",
  "--app-overlay-surface": "--nx-raised",
  "--popover": "--nx-raised",
  "--secondary": "--nx-raised",
  "--muted": "--nx-raised",
  // Text
  "--text-primary": "--nx-text",
  "--app-text": "--nx-text",
  "--field-text": "--nx-text",
  "--modal-section-text": "--nx-text",
  "--app-overlay-text": "--nx-text",
  "--foreground": "--nx-text",
  "--card-foreground": "--nx-text",
  "--popover-foreground": "--nx-text",
  "--secondary-foreground": "--nx-text",
  "--accent-foreground": "--nx-text",
  "--text-secondary": "--nx-text-2",
  "--text-muted": "--nx-muted",
  "--nexo-text-muted": "--nx-muted",
  "--modal-section-muted": "--nx-muted",
  "--muted-foreground": "--nx-muted",
  // Borders
  "--border": "--nx-line",
  "--border-subtle": "--nx-line",
  "--border-soft": "--nx-line",
  "--app-border": "--nx-line",
  "--nexo-border-soft": "--nx-line",
  "--modal-section-border": "--nx-line",
  "--app-overlay-border": "--nx-line",
  "--field-border": "--nx-line-strong",
  "--input": "--nx-line-strong",
  // Brand and interaction
  "--accent-primary": "--nx-brand",
  "--primary": "--nx-brand",
  "--accent-primary-hover": "--nx-brand-hover",
  "--primary-foreground": "--nx-on-brand",
  "--accent-text": "--nx-brand-text",
  // Today `--accent` is the orange used as text/marks (badge, links, spinner).
  "--accent": "--nx-brand-text",
  "--accent-soft": "--nx-brand-soft",
  "--ring": "--nx-focus",
  // States
  "--success": "--nx-ok",
  "--warning": "--nx-warn",
  "--danger": "--nx-bad",
  "--destructive": "--nx-bad",
  "--destructive-foreground": "--nx-on-bad",
  // Overlays
  "--app-overlay-shadow": "--nx-shadow",
  "--app-overlay-scrim": "--nx-scrim",
  // Shell (PR 2): app background, sidebar, topbar, shared cards and depth
  "--app-bg": "--nx-bg",
  "--app-shell": "--nx-bg",
  "--nexo-surface-0": "--nx-bg",
  "--app-sidebar": "--nx-surface",
  "--app-sidebar-surface": "--nx-surface",
  "--bg-sidebar": "--nx-surface",
  "--app-topbar": "--nx-surface",
  "--bg-header": "--nx-surface",
  "--card-bg": "--nx-surface",
  "--bg-card": "--nx-surface",
  "--surface-card-light": "--nx-surface",
  "--surface-elevated-light": "--nx-surface",
  "--surface-contrast": "--nx-surface",
  "--nexo-card-muted": "--nx-raised",
  "--bg-surface-hover": "--nx-raised",
  "--app-border-subtle": "--nx-line",
  "--nexo-border-strong": "--nx-line-strong",
  "--neutral": "--nx-text-2",
  "--nexo-focus-ring": "--nx-focus",
  "--app-shadow-soft": "--nx-shadow",
  "--shadow-soft": "--nx-shadow",
  "--nexo-depth-subtle": "--nx-shadow",
  "--nexo-depth-hover": "--nx-shadow",
  "--nexo-shadow-elev-1": "--nx-shadow",
  "--modal-card-shadow-light": "--nx-shadow",
};

export const premiumFontAliases = [
  "--nexo-body-font",
  "--nexo-title-font",
  "--nexo-font-body",
  "--nexo-font-title",
] as const;

/** Text needs 4.5:1; borders, focus rings and chart marks need 3:1 (WCAG 2.2 AA). */
export const premiumContrastPairs: Array<
  [PremiumTokenName, PremiumTokenName, number]
> = [
  ["--nx-text", "--nx-bg", 4.5],
  ["--nx-text", "--nx-surface", 4.5],
  ["--nx-text", "--nx-raised", 4.5],
  ["--nx-text-2", "--nx-surface", 4.5],
  ["--nx-text-2", "--nx-raised", 4.5],
  ["--nx-muted", "--nx-bg", 4.5],
  ["--nx-muted", "--nx-surface", 4.5],
  ["--nx-muted", "--nx-raised", 4.5],
  ["--nx-brand-text", "--nx-surface", 4.5],
  ["--nx-brand-text", "--nx-raised", 4.5],
  ["--nx-brand-text", "--nx-brand-soft", 4.5],
  ["--nx-text", "--nx-brand-soft", 4.5],
  ["--nx-on-brand", "--nx-brand", 4.5],
  ["--nx-on-brand", "--nx-brand-hover", 4.5],
  ["--nx-on-bad", "--nx-bad", 4.5],
  ["--nx-ok", "--nx-ok-soft", 4.5],
  ["--nx-info", "--nx-info-soft", 4.5],
  ["--nx-warn", "--nx-warn-soft", 4.5],
  ["--nx-bad", "--nx-bad-soft", 4.5],
  ["--nx-ok", "--nx-surface", 4.5],
  ["--nx-warn", "--nx-surface", 4.5],
  ["--nx-bad", "--nx-surface", 4.5],
  ["--nx-info", "--nx-surface", 4.5],
  ["--nx-line-strong", "--nx-surface", 3],
  ["--nx-line-strong", "--nx-raised", 3],
  ["--nx-chart-1", "--nx-surface", 3],
  ["--nx-focus", "--nx-bg", 3],
  ["--nx-focus", "--nx-surface", 3],
];

function luminance(hex: string) {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(foreground: string, background: string) {
  const [high, low] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a
  );
  return (high + 0.05) / (low + 0.05);
}

/**
 * Selectors: the app shell (`.app-root`) and the document root, so Radix
 * portals rendered in <body> inherit the same values. They only match while
 * `data-skin="premium"` is present, which the flag controls.
 */
const scope = (theme: PremiumTheme) =>
  theme === "light"
    ? ':root[data-skin="premium"],\n.app-root[data-skin="premium"]'
    : ':root[data-skin="premium"][data-theme="dark"],\n.app-root[data-skin="premium"][data-theme="dark"]';

export function buildPremiumSkinCss() {
  const block = (theme: PremiumTheme) => {
    const lines = Object.entries(premiumTokens[theme]).map(
      ([name, value]) => `  ${name}: ${value};`
    );
    if (theme === "light") {
      lines.push("", "  /* Existing aliases → Premium tokens */");
      for (const [alias, token] of Object.entries(premiumAliasMap))
        lines.push(`  ${alias}: var(${token});`);
      lines.push("", "  /* Typography */", `  --nx-font: ${premiumFontStack};`);
      for (const alias of premiumFontAliases)
        lines.push(`  ${alias}: var(--nx-font);`);
      lines.push("  color-scheme: light;");
    } else {
      lines.push("  color-scheme: dark;");
    }
    return `${scope(theme)} {\n${lines.join("\n")}\n}`;
  };
  return [
    "/*",
    " * NexoGestão Premium skin — GENERATED from theme/premium/tokens.ts. Do not edit by hand.",
    ' * Inert unless data-skin="premium" is set (flag off by default, see flag.ts).',
    " * Unlayered on purpose: it must win over the @layer base theme blocks in index.css.",
    " * Rollback: remove the import in main.tsx (or revert the PR).",
    " */",
    "",
    block("light"),
    "",
    block("dark"),
    "",
  ].join("\n");
}
