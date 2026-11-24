/**
 * NexoGestão Premium — experimental design tokens (PR 0, preview only).
 *
 * Tokens are named by function so both themes swap values only. They are
 * applied as CSS custom properties on the preview root (`.nx-root`) and never
 * touch the production tokens in index.css.
 */
export type PremiumTheme = "dark" | "light";

export const premiumTokens = {
  dark: {
    "--nx-bg": "#08080a", // app background, behind everything
    "--nx-surface": "#111113", // cards, panels, sidebar, topbar
    "--nx-raised": "#18181b", // inputs, hovered rows, chips on top of cards
    "--nx-line": "#26262a", // decorative dividers and card borders
    "--nx-line-strong": "#71717a", // control borders that must be perceived (>=3:1)
    "--nx-text": "#f4f4f5", // headings and primary data
    "--nx-text-2": "#a1a1aa", // supporting text and labels
    "--nx-muted": "#8b8b93", // metadata, dates, captions
    "--nx-brand": "#ff6a01", // primary action fill, active item, highlights
    "--nx-brand-hover": "#ff7d1f",
    "--nx-on-brand": "#0a0a0a", // text/icons on brand fill
    "--nx-brand-text": "#ff8a3d", // orange text and links
    "--nx-brand-soft": "#2a1506", // active item / accent badge background
    "--nx-chart-1": "#ff6a01", // main chart series
    "--nx-ok": "#4ade80",
    "--nx-ok-soft": "#0f2417",
    "--nx-info": "#7cb4ff",
    "--nx-info-soft": "#0f1d33",
    "--nx-warn": "#fbbf24",
    "--nx-warn-soft": "#2a1f06",
    "--nx-bad": "#fb8a8a",
    "--nx-bad-soft": "#2d1212",
    "--nx-focus": "#ff8a3d", // keyboard focus ring
    "--nx-scrim": "rgba(0, 0, 0, 0.66)",
    "--nx-shadow": "none",
  },
  light: {
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
    "--nx-focus": "#b4460f",
    "--nx-scrim": "rgba(24, 24, 27, 0.45)",
    "--nx-shadow": "0 1px 2px rgba(24, 24, 27, 0.06), 0 8px 24px -12px rgba(24, 24, 27, 0.12)",
  },
} as const satisfies Record<PremiumTheme, Record<string, string>>;

export type PremiumTokenName = keyof (typeof premiumTokens)["dark"];

/**
 * Foreground/background pairs actually used by the preview, with the WCAG
 * minimum each must reach: 4.5 for text, 3 for UI components and graphics.
 */
export const premiumContrastPairs: Array<[PremiumTokenName, PremiumTokenName, number]> = [
  ["--nx-text", "--nx-bg", 4.5],
  ["--nx-text", "--nx-surface", 4.5],
  ["--nx-text", "--nx-raised", 4.5],
  ["--nx-text-2", "--nx-surface", 4.5],
  ["--nx-text-2", "--nx-raised", 4.5],
  ["--nx-muted", "--nx-surface", 4.5],
  ["--nx-muted", "--nx-raised", 4.5],
  ["--nx-brand-text", "--nx-surface", 4.5],
  ["--nx-brand-text", "--nx-brand-soft", 4.5],
  ["--nx-text", "--nx-brand-soft", 4.5],
  ["--nx-on-brand", "--nx-brand", 4.5],
  ["--nx-on-brand", "--nx-brand-hover", 4.5],
  ["--nx-ok", "--nx-ok-soft", 4.5],
  ["--nx-info", "--nx-info-soft", 4.5],
  ["--nx-warn", "--nx-warn-soft", 4.5],
  ["--nx-bad", "--nx-bad-soft", 4.5],
  ["--nx-ok", "--nx-surface", 4.5],
  ["--nx-bad", "--nx-surface", 4.5],
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
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

export function premiumThemeStyle(theme: PremiumTheme) {
  return premiumTokens[theme] as unknown as Record<string, string>;
}
