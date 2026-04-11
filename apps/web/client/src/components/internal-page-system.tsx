import type { ComponentProps, ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppPageShell, AppSectionCard, AppSkeleton as BaseSkeleton } from "@/components/app-system";
import {
  AppActionCard,
  AppCardCTA,
  AppEmptyState as AppBaseEmptyState,
  AppLoadingState,
  AppRowActions,
  AppTrendIndicator,
} from "@/components/app";

export function AppPageHeader({
  title,
  description,
  ctaLabel,
  onCta,
  secondaryActions,
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryActions?: ReactNode;
}) {
  return (
    <header className="nexo-page-header nexo-section-reveal">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nexo-page-header-title">{title}</h1>
          <p className="nexo-page-header-description">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions}
          {ctaLabel ? <Button onClick={onCta}>{ctaLabel}</Button> : null}
        </div>
      </div>
    </header>
  );
}

export function AppKpiCard({
  label,
  value,
  trend,
  context,
  onClick,
}: {
  label: string;
  value: string;
  trend: number;
  context: string;
  onClick?: () => void;
}) {
  return (
    <AppActionCard title={label} description={context} onClick={onClick ?? (() => undefined)}>
      <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
      <div className="flex items-center gap-2">
        <AppTrendIndicator value={trend} />
        {onClick ? <AppCardCTA label="Abrir" onClick={onClick} /> : null}
      </div>
    </AppActionCard>
  );
}

export function AppKpiRow({ items }: { items: Array<{ label: string; value: string; trend: number; context: string; onClick?: () => void }> }) {
  return <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map(item => <AppKpiCard key={item.label} {...item} />)}</section>;
}

export function AppChartPanel({
  title,
  description,
  children,
  trendLabel,
  trendValue,
  ctaLabel = "Ver detalhes",
  onCtaClick,
}: {
  title: string;
  description: string;
  children: ReactNode;
  trendLabel?: string;
  trendValue?: number;
  ctaLabel?: string;
  onCtaClick?: () => void;
}) {
  return (
    <AppSectionCard>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
        </div>
        {typeof trendValue === "number" ? <AppTrendIndicator value={trendValue} /> : null}
      </div>
      {children}
      {(trendLabel || onCtaClick) ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">{trendLabel}</span>
          {onCtaClick ? (
            <Button size="sm" variant="ghost" onClick={onCtaClick}>
              {ctaLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </AppSectionCard>
  );
}

export function AppSectionBlock({
  title,
  subtitle,
  children,
  className,
  ctaLabel,
  onCtaClick,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}) {
  return (
    <AppSectionCard className={className}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {subtitle ? <p className="text-xs text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
        {onCtaClick ? (
          <Button size="sm" variant="ghost" onClick={onCtaClick}>
            {ctaLabel ?? "Ver detalhes da operação"}
          </Button>
        ) : null}
      </div>
      {children}
    </AppSectionCard>
  );
}

export function AppDataTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">{children}</div>;
}

export function AppListBlock({ items }: { items: Array<{ title: string; subtitle?: string; right?: ReactNode; action?: ReactNode }> }) {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.title} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/70 p-3">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
            {item.subtitle ? <p className="text-xs text-[var(--text-muted)]">{item.subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {item.action}
            {item.right}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AppAlertList({ alerts }: { alerts: Array<{ text: string; tone?: "warning" | "danger" | "info" }> }) {
  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <div key={alert.text} className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/70 p-3">
          <TriangleAlert className={cn("mt-0.5 h-4 w-4", alert.tone === "danger" ? "text-rose-500" : alert.tone === "warning" ? "text-amber-500" : "text-sky-500")} />
          <p className="text-sm text-[var(--text-primary)]">{alert.text}</p>
        </div>
      ))}
    </div>
  );
}

export function AppRecentActivity({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={item} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3 text-sm text-[var(--text-secondary)]">{item}</li>
      ))}
    </ul>
  );
}

const statusTone: Record<string, string> = {
  urgente: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  alta: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  "em risco": "bg-amber-500/15 text-amber-500 border-amber-500/30",
  média: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  atrasado: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  concluído: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  pendente: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
  baixa: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
  pago: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  falhou: "bg-rose-500/15 text-rose-500 border-rose-500/30",
};

export function AppStatusBadge({ label }: { label: string }) {
  return <Badge className={cn("border", statusTone[label.toLowerCase()] ?? "")}>{label}</Badge>;
}

export const AppPriorityBadge = AppStatusBadge;

export function AppInsightPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-orange-500/25 bg-orange-500/8 p-3 text-sm text-[var(--text-primary)]">{children}</div>;
}

export function AppEmptyState({ title, description }: { title: string; description: string }) {
  return <AppBaseEmptyState title={title} description={description} />;
}

export function AppSkeleton(props: ComponentProps<typeof BaseSkeleton>) {
  return <BaseSkeleton {...props} />;
}

export { AppLoadingState, AppRowActions, AppTrendIndicator };

export function AppFiltersBar({ children }: { children: ReactNode }) {
  return <div className="nexo-card-informative flex flex-wrap items-center gap-2 p-3">{children}</div>;
}

export { AppPageShell, Input };
