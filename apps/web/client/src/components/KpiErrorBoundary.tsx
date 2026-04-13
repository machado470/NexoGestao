import type { ReactNode } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";

export function KpiErrorBoundary({ children, context }: { children: ReactNode; context: string }) {
  setBootPhase(`KPI_RENDER:${context}`);

  return (
    <ErrorBoundary
      routeContext={context}
      fallbackMode="inline"
      fallbackTitle={`Erro nos KPIs (${context})`}
      fallbackDescription="Esta seção de indicadores falhou, mas o restante da página segue operacional."
    >
      {children}
    </ErrorBoundary>
  );
}
