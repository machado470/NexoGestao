import type { ReactNode } from "react";
import { MobileUpcomingAppointment } from "@/components/MobileUpcomingAppointment";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  UserPlus,
} from "lucide-react";
import { can, type Permission, type Role } from "@/lib/rbac";
import { canVisitMobileRoute } from "@/lib/mobile-navigation";
import { Button } from "@/components/ui/button";

type Action = {
  title: string;
  reason: string;
  path: string;
  ctaLabel: string;
  entity?: string;
};
export function MobileHome({
  role,
  name,
  summary,
  action,
  actionLoading,
  actionError,
  attention,
  attentionError,
  attentionLoading,
  operationalQueue,
  empty,
  loading,
  failed,
  partial,
  onRetry,
  navigate,
}: {
  role: Role | null;
  name?: string;
  summary: { label: string; value: string; path: string }[];
  action: Action | null;
  actionLoading: boolean;
  actionError: boolean;
  attention: Action[];
  attentionError: boolean;
  attentionLoading: boolean;
  operationalQueue?: ReactNode;
  empty: boolean;
  loading: boolean;
  failed: boolean;
  partial: boolean;
  onRetry: () => void;
  navigate: (path: string) => void;
}) {
  const isMobile = useIsMobile();
  const shortcuts: {
    label: string;
    path: string;
    permission: Permission;
    Icon: typeof UserPlus;
  }[] = [
    {
      label: "Cliente",
      path: "/customers?action=create",
      permission: "customers:create",
      Icon: UserPlus,
    },
    {
      label: "Agendar",
      path: "/appointments?action=create",
      permission: "appointments:create",
      Icon: CalendarDays,
    },
    {
      label: "Nova O.S.",
      path: "/service-orders?action=create",
      permission: "orders:create",
      Icon: ClipboardList,
    },
    {
      label: "Cobrar",
      path: "/finances?action=create",
      permission: "finance:update",
      Icon: CircleDollarSign,
    },
  ];
  const allowed = shortcuts.filter(item => role && can(role, item.permission));
  return (
    <div className="mobile-home space-y-5 md:hidden">
      <header className="pt-2">
        <p className="text-sm text-[var(--text-muted)]">
          Olá{name ? `, ${name.split(" ")[0]}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Sua operação hoje
        </h1>
      </header>
      {!empty && summary.length > 0 ? (
        <section
          aria-label="Resumo da operação"
          className={`mobile-home-summary grid ${summary.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-4 rounded-2xl bg-[var(--surface-elevated)] p-4`}
        >
          {summary.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              className="min-h-16 min-w-0 text-left"
            >
              <span className="block text-xs text-[var(--text-muted)]">
                {item.label}
              </span>
              <strong className="mt-1 block break-words text-xl font-semibold tabular-nums">
                {item.value}
              </strong>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--nx-brand-text,var(--accent-primary))]">
                Consultar <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </section>
      ) : null}
      {!empty && allowed.length > 0 ? (
        <nav aria-label="Ações rápidas" className="grid grid-cols-4 gap-2">
          {allowed.map(({ label, path, Icon }) => (
            <button
              type="button"
              key={path}
              onClick={() => navigate(path)}
              className="flex min-h-20 min-w-0 flex-col items-center justify-start gap-2 text-center text-xs font-medium"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--nx-brand-text,var(--accent-primary))]">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </button>
          ))}
        </nav>
      ) : null}
      {loading ? (
        <p role="status" className="py-4 text-sm text-[var(--text-muted)]">
          Carregando sua operação…
        </p>
      ) : null}
      {failed || partial ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--border-subtle)] p-3 text-sm"
        >
          <p>
            {failed
              ? "Não foi possível atualizar a operação."
              : "Algumas informações estão indisponíveis. Os dados disponíveis continuam abaixo."}
          </p>
          <Button variant="outline" className="mt-2 min-h-11" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {!empty && !failed ? (
        <>
          <section aria-labelledby="mobile-next-action">
            <h2
              id="mobile-next-action"
              className="mb-3 text-base font-semibold"
            >
              Próxima ação
            </h2>
            {actionLoading ? (
              <p role="status" className="text-sm text-[var(--text-muted)]">
                Consultando a próxima ação…
              </p>
            ) : actionError ? (
              <p className="text-sm text-[var(--text-muted)]">
                A próxima ação está indisponível.
              </p>
            ) : action ? (
              <div className="rounded-2xl bg-[var(--surface-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">
                  {action.entity}
                </p>
                <h3 className="mt-1 break-words text-lg font-semibold">
                  {action.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {action.reason}
                </p>
                {canVisitMobileRoute(role, action.path) ? (
                  <Button
                    className="mt-4 h-auto min-h-11 w-full whitespace-normal break-words text-center"
                    onClick={() => navigate(action.path)}
                  >
                    {action.ctaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    A ação requer outro perfil de acesso.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma ação prioritária retornada para o período.
              </p>
            )}
          </section>
          <section aria-labelledby="mobile-pending">
            <h2 id="mobile-pending" className="mb-2 text-base font-semibold">
              Precisa de atenção
            </h2>
            {attentionLoading ? (
              <p role="status" className="text-sm text-[var(--text-muted)]">
                Consultando pendências…
              </p>
            ) : attentionError ? (
              <p className="text-sm text-[var(--text-muted)]">
                Não foi possível consultar as pendências.
              </p>
            ) : attention.length ? (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {attention.slice(0, 3).map((item, index) => (
                  <li key={`${item.path}-${index}`} className="py-3">
                    <h3 className="break-words text-sm font-medium">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {item.reason}
                    </p>
                    {canVisitMobileRoute(role, item.path) ? (
                      <button
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="mt-1 flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--nx-brand-text,var(--accent-primary))]"
                      >
                        {item.ctaLabel}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma pendência retornada pela fonte de sinais.
              </p>
            )}
          </section>
          {operationalQueue}
        </>
      ) : null}
      {isMobile ? <MobileUpcomingAppointment navigate={navigate} /> : null}
      <details className="border-t border-[var(--border-subtle)] pt-4">
        <summary className="min-h-11 text-sm font-medium">
          Mais áreas da operação
        </summary>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {[
            { label: "Ordens de serviço", path: "/service-orders" },
            { label: "Calendário", path: "/calendar" },
            { label: "Timeline", path: "/timeline" },
            { label: "Governança", path: "/governance" },
          ]
            .filter(item => canVisitMobileRoute(role, item.path))
            .map(item => (
              <Button
                key={item.path}
                variant="outline"
                className="min-h-11 whitespace-normal"
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </Button>
            ))}
        </div>
      </details>
    </div>
  );
}
