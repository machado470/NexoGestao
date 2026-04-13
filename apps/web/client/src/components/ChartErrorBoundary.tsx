import type { ReactNode } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";

export function ChartErrorBoundary({ children, context }: { children: ReactNode; context: string }) {
  setBootPhase(`CHART_RENDER:${context}`);

  return (
    <ErrorBoundary
      routeContext={context}
      fallbackMode="inline"
      fallbackTitle={`Erro no gráfico (${context})`}
      fallbackDescription="Este gráfico falhou, mas a página continua disponível."
    >
      {children}
    </ErrorBoundary>
  );
}
