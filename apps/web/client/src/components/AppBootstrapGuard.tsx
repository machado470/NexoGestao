import type { ReactNode } from "react";
import { AppPageErrorState, AppPageLoadingState, AppPageShell } from "@/components/internal-page-system";

export type AppBootstrapState = "booting" | "ready" | "failed";

export function AppBootstrapGuard({
  state,
  reason,
  onReload,
  children,
}: {
  state: AppBootstrapState;
  reason?: string;
  onReload: () => void;
  children: ReactNode;
}) {
  if (state === "booting") {
    return (
      <AppPageShell>
        <AppPageLoadingState
          title="Inicializando aplicação"
          description="Estamos preparando autenticação e provedores principais."
        />
      </AppPageShell>
    );
  }

  if (state === "failed") {
    return (
      <AppPageShell>
        <AppPageErrorState
          title="Falha ao iniciar a aplicação"
          description={reason ?? "Não foi possível concluir o bootstrap inicial."}
          actionLabel="Recarregar aplicação"
          onAction={onReload}
        />
      </AppPageShell>
    );
  }

  return <>{children}</>;
}
