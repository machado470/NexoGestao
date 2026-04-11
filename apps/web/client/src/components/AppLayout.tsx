import type { ReactNode } from "react";
import { NotificationCenter } from "@/components/NotificationCenter";
import { CriticalActionOverlay } from "@/components/CriticalActionOverlay";
import { ThemeProvider } from "@/contexts/ThemeContext";

import { MainLayout } from "./MainLayout";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <ThemeProvider defaultTheme="light">
      <MainLayout>{children}</MainLayout>
      <NotificationCenter />
      <CriticalActionOverlay />
    </ThemeProvider>
  );
}
