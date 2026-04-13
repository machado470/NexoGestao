import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";
import { CriticalActionOverlay } from "@/components/CriticalActionOverlay";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LayoutProtectionGuard } from "@/components/LayoutProtectionGuard";

import { MainLayout } from "./MainLayout";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const renderAudit =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("renderAudit") === "1" ||
      new URLSearchParams(window.location.search).has("renderAuditMode"));
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] app", { pathname: location, hasChildren: Boolean(children) });
  }
  return (
    <ThemeProvider defaultTheme="light">
      {renderAudit ? (
        <div style={{ position: "fixed", left: 8, bottom: 72, zIndex: 2147483645, background: "#9a3412", color: "#ffedd5", padding: "4px 8px", borderRadius: 6, font: "600 11px/1.2 system-ui" }}>
          LAYOUT: app
        </div>
      ) : null}
      <LayoutProtectionGuard />
      <MainLayout>{children}</MainLayout>
      <NotificationCenter />
      <CriticalActionOverlay />
    </ThemeProvider>
  );
}
