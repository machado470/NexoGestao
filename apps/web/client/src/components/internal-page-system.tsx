import type { ComponentProps, ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AppPageShell,
  AppSectionCard,
  AppSkeleton as BaseSkeleton,
} from "@/components/app-system";
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

export function AppFiltersBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "nexo-card-informative flex flex-wrap items-center justify-between gap-2 rounded-xl p-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AppSecondaryTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/35 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      aria-label="Navegação secundária"
    >
      <div className="flex min-w-max items-center gap-1.5">
        {items.map(item => {
          const isActive = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                "relative inline-flex h-9 shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors",
                isActive
                  ? "border-[var(--accent-primary)]/35 bg-[var(--surface-primary)] text-white shadow-[inset_0_-2px_0_0_var(--accent-primary)]"
                  : "border-transparent bg-transparent text-white/70 hover:border-[var(--border-subtle)] hover:bg-[var(--surface-primary)]/40 hover:text-white"
              )}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
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

function MetricTrendBadge({
  trend,
  delta,
}: {
  trend?: MetricTrend;
  delta?: string;
}) {
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
        "nexo-card-kpi flex h-full min-h-[138px] flex-col p-4 md:p-5",
        tone === "important" && "nexo-card-kpi--important",
        tone === "critical" && "nexo-card-kpi--critical"
      )}
    >
      <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            {title}
          </p>
          {loading ? (
            <div
              className="h-8 w-28 rounded-md bg-[var(--surface-elevated)]/70"
              aria-hidden
            />
          ) : (
            <p
              className={cn(
                "font-semibold leading-none tracking-tight text-[var(--text-primary)]",
                emphasis === "strong" ? "text-3xl md:text-[2rem]" : "text-2xl"
              )}
            >
              {value}
            </p>
          )}
          {hint ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
          ) : null}
        </div>
        {icon ? <div className="nexo-icon-tile">{icon}</div> : null}
      </div>

      {delta || footer || onClick ? (
        <div className="mt-4 flex min-h-7 flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)]/70 pt-3">
          <div className="min-w-0">
            <MetricTrendBadge trend={trend} delta={delta} />
            {footer ? (
              <div className="truncate text-xs text-[var(--text-muted)]">
                {footer}
              </div>
            ) : null}
          </div>
          {onClick ? (
            <AppCardCTA label={ctaLabel ?? "Abrir"} onClick={onClick} />
          ) : null}
        </div>
      ) : null}
    </article>
  );

  if (!onClick) return content;
  return (
    <button type="button" className="h-full w-full text-left" onClick={onClick}>
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
  const direction: MetricTrend =
    trend > 0 ? "up" : trend < 0 ? "down" : "neutral";
  const delta = Number.isFinite(trend)
    ? `${trend >= 0 ? "+" : ""}${trend.toFixed(1).replace(".", ",")}%`
    : undefined;
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
  gridClassName,
}: {
  items: Array<
    | AppMetricCardItem
    | {
        label: string;
        value: string;
        trend?: number;
        context?: string;
        onClick?: () => void;
      }
  >;
  emphasis?: "strong" | "compact";
  gridClassName?: string;
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section
      className={cn(
        "grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]",
        gridClassName
      )}
    >
      {safeItems.map((item, index) => {
        if (!item || typeof item !== "object") {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error("[kpi] item inválido recebido em AppKpiRow", {
              item,
              index,
            });
          }
          return null;
        }

        const normalized: AppMetricCardItem =
          "title" in item
            ? item
            : {
                title: item.label,
                value: item.value,
                hint: item.context,
                onClick: item.onClick,
                delta:
                  typeof item.trend === "number"
                    ? `${item.trend >= 0 ? "+" : ""}${item.trend.toFixed(1).replace(".", ",")}%`
                    : undefined,
                trend:
                  typeof item.trend === "number"
                    ? item.trend > 0
                      ? "up"
                      : item.trend < 0
                        ? "down"
                        : "neutral"
                    : undefined,
              };

        const safeTitle =
          typeof normalized.title === "string" &&
          normalized.title.trim().length > 0
            ? normalized.title
            : `Métrica ${index + 1}`;

        return (
          <AppMetricCard
            key={`${safeTitle}-${index}`}
            {...normalized}
            title={safeTitle}
            emphasis={normalized.emphasis ?? emphasis}
          />
        );
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
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        </div>
        {typeof trendValue === "number" ? (
          <AppTrendIndicator value={trendValue} />
        ) : null}
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
  compact = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  compact?: boolean;
}) {
  return (
    <AppSectionCard
      className={cn(
        compact
          ? "min-h-0 rounded-xl p-4 md:p-5"
          : "min-h-[240px] rounded-xl p-5 md:p-6",
        className
      )}
    >
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3 border-b border-[var(--border-subtle)]/70 pb-3">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]"
            title={title}
          >
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {onCtaClick ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onCtaClick}
            className="max-w-full shrink-0"
          >
            <span className="truncate">
              {ctaLabel ?? "Ver detalhes da operação"}
            </span>
          </Button>
        ) : null}
      </div>
      {children}
    </AppSectionCard>
  );
}

export function AppDataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]">
      {children}
    </div>
  );
}

export function AppListBlock({
  items,
  className,
  maxItems = 8,
  minItems = 5,
  compact = false,
  showPlaceholders = true,
}: {
  items: Array<{
    title: string;
    subtitle?: string;
    right?: ReactNode;
    action?: ReactNode;
  }>;
  className?: string;
  maxItems?: number;
  minItems?: number;
  compact?: boolean;
  showPlaceholders?: boolean;
}) {
  const normalizedItems = items.slice(0, maxItems).map((item, index) => ({
    ...item,
    subtitle:
      item.subtitle ?? "Ação operacional disponível para execução imediata.",
    action: item.action ?? (
      <Button size="sm" variant="outline">
        Executar
      </Button>
    ),
    __key: `${item.title}-${index}`,
  }));
  while (showPlaceholders && normalizedItems.length < minItems) {
    const idx = normalizedItems.length + 1;
    normalizedItems.push({
      title: `Ação complementar ${idx}`,
      subtitle:
        "Preencha este espaço com uma ação direta do fluxo operacional.",
      action: (
        <Button size="sm" variant="outline">
          Definir ação
        </Button>
      ),
      __key: `placeholder-${idx}`,
    });
  }

  return (
    <div
      className={cn(
        compact
          ? "min-h-0 space-y-2"
          : "min-h-[220px] space-y-2.5",
        className
      )}
    >
      {normalizedItems.map(item => (
        <div
          key={item.__key}
          className={cn(
            "rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/70",
            compact ? "px-3 py-2.5" : "px-3.5 py-3"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-5 text-[var(--text-primary)]">
                {item.title}
              </p>
              {item.subtitle ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted)]">
                  {item.subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 self-center">
              {item.right ? <div className="shrink-0">{item.right}</div> : null}
              <div className="shrink-0">{item.action}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AppAlertList({
  alerts,
}: {
  alerts: Array<{ text: string; tone?: "warning" | "danger" | "info" }>;
}) {
  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <div
          key={alert.text}
          className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/70 p-3"
        >
          <TriangleAlert
            className={cn(
              "mt-0.5 h-4 w-4",
              alert.tone === "danger"
                ? "text-rose-500"
                : alert.tone === "warning"
                  ? "text-amber-500"
                  : "text-sky-500"
            )}
          />
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
        <li
          key={item}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3 text-sm text-[var(--text-secondary)]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

const statusTone: Record<string, string> = {
  "prioridade alta":
    "bg-[var(--dashboard-danger)]/16 text-[var(--dashboard-danger)] border-[var(--dashboard-danger)]/38",
  "em risco":
    "bg-[var(--dashboard-danger)]/14 text-[var(--dashboard-danger)] border-[var(--dashboard-danger)]/35",
  bloqueado:
    "bg-[var(--dashboard-danger)]/18 text-[var(--dashboard-danger)] border-[var(--dashboard-danger)]/44",
  urgente:
    "bg-[var(--dashboard-danger)]/16 text-[var(--dashboard-danger)] border-[var(--dashboard-danger)]/38",
  atenção:
    "bg-[var(--dashboard-warning)]/14 text-[var(--dashboard-warning)] border-[var(--dashboard-warning)]/34",
  pendente:
    "bg-[var(--dashboard-neutral)]/14 text-[var(--dashboard-neutral)] border-[var(--dashboard-neutral)]/34",
  confirmado:
    "bg-[var(--dashboard-info)]/16 text-[var(--dashboard-info)] border-[var(--dashboard-info)]/34",
  ok: "bg-[var(--dashboard-success)]/16 text-[var(--dashboard-success)] border-[var(--dashboard-success)]/36",
  saudável:
    "bg-[var(--dashboard-success)]/16 text-[var(--dashboard-success)] border-[var(--dashboard-success)]/36",
  concluído:
    "bg-[var(--dashboard-success)]/16 text-[var(--dashboard-success)] border-[var(--dashboard-success)]/36",
  pago: "bg-[var(--dashboard-success)]/16 text-[var(--dashboard-success)] border-[var(--dashboard-success)]/36",
  médio:
    "bg-[var(--dashboard-warning)]/14 text-[var(--dashboard-warning)] border-[var(--dashboard-warning)]/34",
  alta: "bg-[var(--dashboard-danger)]/16 text-[var(--dashboard-danger)] border-[var(--dashboard-danger)]/38",
  alto: "bg-[var(--dashboard-danger)]/16 text-[var(--dashboard-danger)] border-[var(--dashboard-danger)]/38",
  falhou:
    "bg-[var(--dashboard-danger)]/14 text-[var(--dashboard-danger)] border-[var(--dashboard-danger)]/35",
};

function normalizeStatusLabel(label: string) {
  const raw = label.trim().toLowerCase();
  if (raw === "high priority" || raw === "prioridade alta")
    return "Prioridade alta";
  if (raw === "critical" || raw === "crítico") return "Em risco";
  if (raw === "overdue" || raw === "atrasado") return "Atenção";
  if (raw === "healthy") return "Saudável";
  if (raw === "warning") return "Atenção";
  if (raw === "done" || raw === "paid") return "Concluído";
  if (raw === "pending") return "Pendente";
  if (raw === "blocked") return "Bloqueado";
  if (raw === "confirmed") return "Confirmado";
  if (raw === "medium") return "Médio";
  if (raw === "high") return "Alto";
  if (raw === "success") return "OK";
  return label;
}

export function AppStatusBadge({ label }: { label: string }) {
  const normalized =
    typeof label === "string" && label.trim().length > 0
      ? normalizeStatusLabel(label)
      : "Pendente";
  const safeLabel = normalized.trim().length > 0 ? normalized : "Pendente";
  return (
    <Badge
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 py-0 text-[10px] font-semibold uppercase tracking-[0.08em]",
        statusTone[safeLabel.toLowerCase()] ??
          "bg-[var(--dashboard-neutral)]/14 text-[var(--dashboard-neutral)] border-[var(--dashboard-neutral)]/34"
      )}
    >
      {safeLabel}
    </Badge>
  );
}

export function AppPriorityBadge({ label }: { label: string }) {
  const normalized = String(label ?? "").trim().toLowerCase();
  const mapped =
    normalized === "critical" || normalized === "urgent" || normalized === "p0"
      ? "Urgente"
      : normalized === "high" || normalized === "alta" || normalized === "p1"
        ? "Alta"
        : normalized === "medium" ||
            normalized === "média" ||
            normalized === "p2"
          ? "Médio"
          : normalized === "low" || normalized === "baixa" || normalized === "p3"
            ? "Baixo"
            : label;

  return <AppStatusBadge label={mapped} />;
}

type AppNextActionSeverity = "low" | "medium" | "high" | "critical";

const nextActionTone: Record<
  AppNextActionSeverity,
  { container: string; badge: string }
> = {
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
  automationStatus,
}: {
  title: string;
  description: string;
  severity: AppNextActionSeverity;
  action: { label: string; onClick: () => void };
  metadata?: string;
  automationStatus?: string;
}) {
  const tone = nextActionTone[severity];

  return (
    <div className={cn("min-w-0 rounded-lg border p-3", tone.container)}>
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.12em]",
          tone.badge
        )}
      >
        {severity.toUpperCase()}
      </p>
      <p
        className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]"
        title={title}
      >
        {title}
      </p>
      <p
        className="mt-1 text-xs leading-5 text-[var(--text-secondary)]"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {description}
      </p>
      {metadata ? (
        <p className="mt-1 truncate text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Origem: {metadata}
        </p>
      ) : null}
      {automationStatus ? (
        <p className="mt-1 truncate text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {automationStatus}
        </p>
      ) : null}
      <Button
        className="mt-2 max-w-full"
        size="sm"
        type="button"
        variant="default"
        onClick={action.onClick}
      >
        <span className="truncate">{action.label}</span>
      </Button>
    </div>
  );
}

export function AppInsightPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-orange-500/25 bg-orange-500/8 p-3 text-sm text-[var(--text-primary)]">
      {children}
    </div>
  );
}

export function AppEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
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
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </p>
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
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      <Button variant="outline" onClick={onAction}>
        {actionLabel}
      </Button>
    </AppSectionCard>
  );
}

export function AppPageEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <AppBaseEmptyState title={title} description={description} />;
}

export function AppSkeleton({
  className,
  ...props
}: ComponentProps<typeof BaseSkeleton>) {
  return (
    <BaseSkeleton
      className={cn("bg-[var(--surface-elevated)]/70", className)}
      {...props}
    />
  );
}

export { AppPageShell, Input, AppRowActions };
export const AppLoadingState = BaseLoadingState;
