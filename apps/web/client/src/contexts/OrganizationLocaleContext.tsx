import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type Locale = {
  timezone?: string;
  currency?: string;
  ready: boolean;
  retry?: () => void;
  loading?: boolean;
};
const OrganizationLocaleContext = createContext<Locale>({ ready: false });
export function OrganizationLocaleProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const query = trpc.settings.displayPreferences.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const preferences = query.isError ? undefined : query.data;
  return (
    <OrganizationLocaleContext.Provider
      value={{
        ...preferences,
        ready: Boolean(preferences),
        loading: query.isLoading,
        retry: () => void query.refetch(),
      }}
    >
      {children}
    </OrganizationLocaleContext.Provider>
  );
}
export function useOrganizationLocale() {
  return useContext(OrganizationLocaleContext);
}
export function OrganizationLocaleStatus() {
  const locale = useOrganizationLocale();
  return locale.ready ? (
    <p className="mb-2 text-xs text-[var(--text-muted)]">
      Horários em {locale.timezone}
    </p>
  ) : (
    <div
      role="status"
      className="mb-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm"
    >
      {locale.loading
        ? "Carregando o fuso da empresa..."
        : "Não foi possível confirmar o fuso da empresa. A consulta usa o fuso deste dispositivo; novos horários ficam bloqueados até a confirmação."}
      {!locale.loading ? (
        <Button variant="outline" className="ml-2" onClick={locale.retry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
