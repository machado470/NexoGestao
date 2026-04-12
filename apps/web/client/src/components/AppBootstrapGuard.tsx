import { useEffect, type ReactNode } from "react";
import { AppPageErrorState, AppPageLoadingState, AppPageShell } from "@/components/internal-page-system";
import { useAuth } from "@/contexts/AuthContext";

export type AppBootstrapState =
  | "booting"
  | "unauthenticated"
  | "authenticated"
  | "failed";
const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

export function shouldBypassFatalBootstrapForAnonymous(params: {
  state: AppBootstrapState;
  isPublicRoute: boolean;
  authState: "unauthenticated" | "authenticated" | "booting" | "failed";
}) {
  return (
    params.state === "failed" &&
    params.isPublicRoute &&
    params.authState === "unauthenticated"
  );
}

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
  const pathname =
    typeof window === "undefined" ? "/" : window.location.pathname;
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const shouldBypassFatalForAnonymous = shouldBypassFatalBootstrapForAnonymous({
    state,
    isPublicRoute,
    authState,
  });

  useEffect(() => {
    if (authState !== "unauthenticated" || !isPublicRoute) return;
    // eslint-disable-next-line no-console
    console.info("[auth] public_route_allowed", { pathname });
  }, [authState, isPublicRoute, pathname]);

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

  if (state === "failed" && !shouldBypassFatalForAnonymous) {
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
