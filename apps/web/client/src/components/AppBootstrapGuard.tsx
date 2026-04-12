import { useEffect, type ReactNode } from "react";
import { AppPageErrorState, AppPageLoadingState, AppPageShell } from "@/components/internal-page-system";
import { useAuth } from "@/contexts/AuthContext";

export type AppBootstrapState =
  | "initializing"
  | "unauthenticated"
  | "authenticated"
  | "error";

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
  const { authState } = useAuth();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (authState === "initializing") {
      // eslint-disable-next-line no-console
      console.log("[boot] auth loading");
    }
  }, [authState]);

  if (state === "initializing") {
    return (
      <AppPageShell>
        <AppPageLoadingState
          title="Inicializando aplicação"
          description="Estamos preparando autenticação e provedores principais."
        />
      </AppPageShell>
    );
  }

  if (state === "error") {
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
