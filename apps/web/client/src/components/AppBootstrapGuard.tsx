import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
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
  const [location] = useLocation();
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  const isPublicBootstrapPath =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/sobre" ||
    pathname === "/produto" ||
    pathname === "/precos" ||
    pathname === "/contato" ||
    pathname === "/funcionalidades" ||
    pathname === "/privacy" ||
    pathname === "/privacidade" ||
    pathname === "/terms" ||
    pathname === "/termos" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/");
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (authState === "initializing") {
      // eslint-disable-next-line no-console
      console.log("[AUTH] loading");
    }
  }, [authState]);

  if (state === "initializing") {
    if (isPublicBootstrapPath) {
      return <>{children}</>;
    }

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
