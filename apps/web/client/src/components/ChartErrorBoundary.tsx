import type { ReactNode } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";

export function ChartErrorBoundary({ children, context }: { children: ReactNode; context: string }) {
  return (
    <ErrorBoundary
      routeContext={context}
      fallbackTitle="Erro ao renderizar gráfico"
      fallbackDescription="Este gráfico falhou, mas a página continua disponível. Verifique o stack abaixo para corrigir o componente."
    >
      {children}
    </ErrorBoundary>
  );
}
