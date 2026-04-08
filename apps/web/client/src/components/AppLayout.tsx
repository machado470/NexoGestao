import type { ReactNode } from "react";

import { MainLayout } from "./MainLayout";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return <MainLayout>{children}</MainLayout>;
}
