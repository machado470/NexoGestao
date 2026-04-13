import type { ReactNode } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";

export function TrpcSectionErrorBoundary({ children, context }: { children: ReactNode; context: string }) {
  setBootPhase(`TRPC_SECTION_RENDER:${context}`);

  return (
    <ErrorBoundary
      routeContext={context}
      fallbackMode="inline"
      fallbackTitle={`Erro em seção tRPC (${context})`}
      fallbackDescription="Falha isolada em dados desta seção. A página principal continua ativa."
    >
      {children}
    </ErrorBoundary>
  );
}
