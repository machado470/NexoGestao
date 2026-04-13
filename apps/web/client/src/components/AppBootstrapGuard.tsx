import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AppPageErrorState, AppPageShell } from "@/components/internal-page-system";
import { useAuth } from "@/contexts/AuthContext";
import { extractPathname, isPublicOrAuthPath } from "@/lib/routeAccess";

export type AppBootstrapState =
  | "initializing"
  | "unauthenticated"
  | "authenticated"
  | "error";


export type AppBootstrapGuardBranch = "blocking_error" | "pass_through";

export function resolveAppBootstrapGuardBranch(params: {
  state: AppBootstrapState;
  isPublicBootstrapPath: boolean;
}): AppBootstrapGuardBranch {
  if (params.state === "error" && !params.isPublicBootstrapPath) return "blocking_error";
  return "pass_through";
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
  const [location] = useLocation();
  const pathname = extractPathname(location);
  const isPublicBootstrapPath = isPublicOrAuthPath(pathname);

  const guardBranch = useMemo(() => resolveAppBootstrapGuardBranch({
    state,
    isPublicBootstrapPath,
  }), [isPublicBootstrapPath, state]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.info("[BOOT GUARD] evaluate", {
      route: pathname,
      appBootstrapState: state,
      authState,
      isPublicBootstrapPath,
      branch: guardBranch,
    });
  }, [authState, guardBranch, isPublicBootstrapPath, pathname, state]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.info("[BOOT GUARD] mounted");
    return () => {
      // eslint-disable-next-line no-console
      console.info("[BOOT GUARD] unmounted");
    };
  }, []);

  if (state === "initializing" && !isPublicBootstrapPath) {
    return (
      <>
        {children}
        <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-white/95 px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-sm backdrop-blur dark:border-orange-500/20 dark:bg-[var(--surface-base)]">
            Inicializando autenticação em segundo plano...
          </div>
        </div>
      </>
    );
  }

  if (state === "error" && !isPublicBootstrapPath) {
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
