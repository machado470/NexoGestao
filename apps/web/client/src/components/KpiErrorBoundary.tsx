import type { ReactNode } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";

export function KpiErrorBoundary({ children, context }: { children: ReactNode; context: string }) {
  return (
    <ErrorBoundary
      routeContext={context}
      fallbackTitle="Erro ao renderizar KPIs"
      fallbackDescription="Os indicadores falharam nesta seção. O restante da página segue operacional."
    >
      {children}
    </ErrorBoundary>
  );
}
