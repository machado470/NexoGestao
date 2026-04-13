import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AppPageErrorState, AppPageShell } from "@/components/internal-page-system";
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

  const guardBranch = useMemo(() => {
    if (state === "error" && !isPublicBootstrapPath) return "blocking_error";
    return "pass_through";
  }, [isPublicBootstrapPath, state]);

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
