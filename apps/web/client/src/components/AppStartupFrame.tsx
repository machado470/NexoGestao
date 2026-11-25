import type { ReactNode } from "react";
import { readStoredTheme } from "@/contexts/ThemeContext";
import { isPremiumSkinEnabled, premiumSkinAttribute } from "@/theme/premium/flag";

export function AppStartupFrame({ children }: { children: ReactNode }) {
  const theme = readStoredTheme();

  return (
    <div
      data-theme={theme}
      data-skin={premiumSkinAttribute(isPremiumSkinEnabled())}
      className="app-root flex min-h-dvh items-center justify-center bg-[var(--bg-app)] p-4 text-[var(--text-primary)]"
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
