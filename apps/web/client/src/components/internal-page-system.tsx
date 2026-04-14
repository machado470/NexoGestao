import type { ComponentProps, ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppPageShell, AppSectionCard, AppSkeleton as BaseSkeleton } from "@/components/app-system";
import {
  AppCardCTA,
  AppEmptyState as AppBaseEmptyState,
  AppLoadingState as BaseLoadingState,
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

export function AppFiltersBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("nexo-card-informative flex flex-wrap items-center justify-between gap-2 rounded-xl p-3", className)}>
      {children}
    </div>
  );
}

type MetricTrend = "up" | "down" | "neutral";

export type AppMetricCardItem = {
  title: string;
  value: ReactNode;
  delta?: string;
  trend?: MetricTrend;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "important" | "critical";
  loading?: boolean;
  emphasis?: "strong" | "compact";
  footer?: ReactNode;
  onClick?: () => void;
  ctaLabel?: string;
};

function MetricTrendBadge({ trend, delta }: { trend?: MetricTrend; delta?: string }) {
  if (!delta || !trend) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        trend === "up" && "text-emerald-500",
        trend === "down" && "text-rose-500",
        trend === "neutral" && "text-[var(--text-muted)]"
      )}
    >
      {trend === "up" ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
      {trend === "down" ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
      {trend === "neutral" ? <ArrowRight className="h-3.5 w-3.5" /> : null}
      {delta}
    </span>
  );
}

export function AppMetricCard({
  title,
  value,
  delta,
  trend,
  hint,
  icon,
  tone = "default",
  loading = false,
  emphasis = "compact",
  footer,
  onClick,
  ctaLabel,
}: AppMetricCardItem) {
  const content = (
    <article
      className={cn(
        "nexo-card-kpi h-full p-4",
        tone === "important" && "nexo-card-kpi--important",
        tone === "critical" && "nexo-card-kpi--critical"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{title}</p>
          {loading ? (
            <div className="mt-3 h-8 w-28 rounded-md bg-[var(--surface-elevated)]/70" aria-hidden />
          ) : (
            <p className={cn("mt-2 font-semibold tracking-tight text-[var(--text-primary)]", emphasis === "strong" ? "text-3xl md:text-[2rem]" : "text-2xl")}>{value}</p>
          )}
          {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
        </div>
        {icon ? <div className="nexo-icon-tile">{icon}</div> : null}
      </div>

      {delta || footer || onClick ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <MetricTrendBadge trend={trend} delta={delta} />
          {footer ? <div className="text-xs text-[var(--text-muted)]">{footer}</div> : null}
          {onClick ? <AppCardCTA label={ctaLabel ?? "Abrir"} onClick={onClick} /> : null}
        </div>
      ) : null}
    </article>
  );

  if (!onClick) return content;
  return (
    <button type="button" className="text-left" onClick={onClick}>
      {content}
    </button>
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
  const direction: MetricTrend = trend > 0 ? "up" : trend < 0 ? "down" : "neutral";
  const delta = Number.isFinite(trend) ? `${trend >= 0 ? "+" : ""}${trend.toFixed(1).replace(".", ",")}%` : undefined;
  return (
    <AppMetricCard
      title={label}
      value={value}
      trend={delta ? direction : undefined}
      delta={delta}
      hint={context}
      onClick={onClick}
    />
  );
}

export function AppKpiRow({
  items,
  emphasis = "compact",
}: {
  items: Array<AppMetricCardItem | { label: string; value: string; trend?: number; context?: string; onClick?: () => void }>;
  emphasis?: "strong" | "compact";
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {safeItems.map((item, index) => {
        if (!item || typeof item !== "object") {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error("[kpi] item inválido recebido em AppKpiRow", { item, index });
          }
          return null;
        }

        const normalized: AppMetricCardItem = "title" in item
          ? item
          : {
              title: item.label,
              value: item.value,
              hint: item.context,
              onClick: item.onClick,
              delta: typeof item.trend === "number" ? `${item.trend >= 0 ? "+" : ""}${item.trend.toFixed(1).replace(".", ",")}%` : undefined,
              trend: typeof item.trend === "number" ? (item.trend > 0 ? "up" : item.trend < 0 ? "down" : "neutral") : undefined,
            };

        const safeTitle =
          typeof normalized.title === "string" && normalized.title.trim().length > 0
            ? normalized.title
            : `Métrica ${index + 1}`;

        return <AppMetricCard key={`${safeTitle}-${index}`} {...normalized} title={safeTitle} emphasis={normalized.emphasis ?? emphasis} />;
      })}
    </section>
  );
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
      {trendLabel || onCtaClick ? (
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
  saudável: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  atenção: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  "em risco": "bg-rose-500/15 text-rose-500 border-rose-500/30",
  bloqueado: "bg-rose-500/20 text-rose-500 border-rose-500/40",
  concluído: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  pendente: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
  urgente: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  alta: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  média: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  atrasado: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  baixa: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
  pago: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  falhou: "bg-rose-500/15 text-rose-500 border-rose-500/30",
};

function normalizeStatusLabel(label: string) {
  const raw = label.trim().toLowerCase();
  if (raw === "critical" || raw === "crítico") return "Em risco";
  if (raw === "overdue" || raw === "atrasado") return "Atenção";
  if (raw === "healthy") return "Saudável";
  if (raw === "warning") return "Atenção";
  if (raw === "done" || raw === "paid") return "Concluído";
  if (raw === "pending") return "Pendente";
  if (raw === "blocked") return "Bloqueado";
  return label;
}

export function AppStatusBadge({ label }: { label: string }) {
  const normalized = typeof label === "string" && label.trim().length > 0 ? normalizeStatusLabel(label) : "Pendente";
  const safeLabel = normalized.trim().length > 0 ? normalized : "Pendente";
  return <Badge className={cn("border", statusTone[safeLabel.toLowerCase()] ?? "")}>{safeLabel}</Badge>;
}

export const AppPriorityBadge = AppStatusBadge;

type AppNextActionSeverity = "low" | "medium" | "high" | "critical";

const nextActionTone: Record<AppNextActionSeverity, { container: string; badge: string }> = {
  low: {
    container: "border-emerald-500/30 bg-emerald-500/10",
    badge: "text-emerald-300",
  },
  medium: {
    container: "border-amber-500/35 bg-amber-500/10",
    badge: "text-amber-300",
  },
  high: {
    container: "border-orange-500/35 bg-orange-500/10",
    badge: "text-orange-300",
  },
  critical: {
    container: "border-rose-500/40 bg-rose-500/12",
    badge: "text-rose-300",
  },
};

export function AppNextActionCard({
  title,
  description,
  severity,
  action,
  metadata,
}: {
  title: string;
  description: string;
  severity: AppNextActionSeverity;
  action: { label: string; onClick: () => void };
  metadata?: string;
}) {
  const tone = nextActionTone[severity];

  return (
    <div className={cn("rounded-lg border p-3", tone.container)}>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", tone.badge)}>{severity.toUpperCase()}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{description}</p>
      {metadata ? <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Origem: {metadata}</p> : null}
      <Button className="mt-2" type="button" variant="default" onClick={action.onClick}>
        {action.label}
      </Button>
    </div>
  );
}

export function AppInsightPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-orange-500/25 bg-orange-500/8 p-3 text-sm text-[var(--text-primary)]">{children}</div>;
}

export function AppEmptyState({ title, description }: { title: string; description: string }) {
  return <AppBaseEmptyState title={title} description={description} />;
}

export function AppPageLoadingState({
  title = "Carregando",
  description = "Carregando dados operacionais...",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <AppSectionCard className="space-y-2">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      <BaseLoadingState rows={4} />
    </AppSectionCard>
  );
}

export function AppPageErrorState({
  title = "Falha ao carregar",
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <AppSectionCard className="space-y-3">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      <Button variant="outline" onClick={onAction}>{actionLabel}</Button>
    </AppSectionCard>
  );
}

export function AppPageEmptyState({ title, description }: { title: string; description: string }) {
  return <AppBaseEmptyState title={title} description={description} />;
}

export function AppSkeleton({ className, ...props }: ComponentProps<typeof BaseSkeleton>) {
  return <BaseSkeleton className={cn("bg-[var(--surface-elevated)]/70", className)} {...props} />;
}

export { AppPageShell, Input, AppRowActions };
export const AppLoadingState = BaseLoadingState;
