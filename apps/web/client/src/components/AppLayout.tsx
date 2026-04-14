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
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] AppLayout mounted", { pathname: location, hasChildren: Boolean(children) });
  }
  return (
    <ThemeProvider defaultTheme="light">
      <LayoutProtectionGuard />
      <MainLayout>{children}</MainLayout>
      <NotificationCenter />
      <CriticalActionOverlay />
    </ThemeProvider>
  );
}
