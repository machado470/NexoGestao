import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDashed,
  Lock,
  ShieldCheck,
  History,
  Zap,
} from "lucide-react";
import { AppSectionCard, AppStatusBadge } from "@/components/app-system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OperationalStateLevel =
  | "NORMAL"
  | "WARNING"
  | "RESTRICTED"
  | "SUSPENDED";

export type OperationalFlowStageState =
  | "done"
  | "active"
  | "warning"
  | "blocked"
  | "idle";

const operationalStateTone: Record<
  OperationalStateLevel,
  {
    label: string;
    badgeTone: "success" | "warning" | "accent" | "danger";
    className: string;
  }
> = {
  NORMAL: {
    label: "Normal",
    badgeTone: "success",
    className: "border-[var(--success)]/30",
  },
  WARNING: {
    label: "Atenção",
    badgeTone: "warning",
    className: "border-[var(--warning)]/35",
  },
  RESTRICTED: {
    label: "Restrita",
    badgeTone: "accent",
    className: "border-[var(--accent-primary)]/35 bg-[var(--accent-soft)]/35",
  },
  SUSPENDED: {
    label: "Suspensa",
    badgeTone: "danger",
    className: "border-[var(--danger)]/40 bg-[var(--danger)]/8",
  },
};

const flowStageTone: Record<
  OperationalFlowStageState,
  { badge: string; container: string; icon: ReactNode; rail: string }
> = {
  done: {
    badge: "Concluído",
    container: "border-[var(--success)]/25 bg-[var(--surface-primary)]/45",
    icon: <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />,
    rail: "bg-[var(--success)]/60",
  },
  active: {
    badge: "Ativo",
    container: "border-[var(--accent-primary)]/35 bg-[var(--accent-soft)]/55",
    icon: <Circle className="h-4 w-4 text-[var(--accent-primary)]" />,
    rail: "bg-[var(--accent-primary)]/70",
  },
  warning: {
    badge: "Atenção",
    container: "border-[var(--warning)]/35 bg-[var(--warning)]/10",
    icon: <CircleAlert className="h-4 w-4 text-[var(--warning)]" />,
    rail: "bg-[var(--warning)]/70",
  },
  blocked: {
    badge: "Bloqueado",
    container: "border-[var(--danger)]/35 bg-[var(--danger)]/8",
    icon: <Lock className="h-4 w-4 text-[var(--danger)]" />,
    rail: "bg-[var(--danger)]/70",
  },
  idle: {
    badge: "Sem sinal",
    container:
      "border-[var(--border-subtle)]/75 bg-[var(--surface-primary)]/35",
    icon: <CircleDashed className="h-4 w-4 text-[var(--text-muted)]" />,
    rail: "bg-[var(--border-strong)]/45",
  },
};

export function OperationalStateCard({
  level,
  reason,
  impact,
  title = "Estado da operação",
  detailsLabel = "Ver detalhes",
  onDetails,
  className,
}: {
  level: OperationalStateLevel;
  reason: string;
  impact: string;
  title?: string;
  detailsLabel?: string;
  onDetails?: () => void;
  className?: string;
}) {
  const tone = operationalStateTone[level];

  return (
    <AppSectionCard
      className={cn("flex h-full flex-col gap-4", tone.className, className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="nexo-overline">Comando operacional</p>
          <h3 className="mt-1 text-lg font-semibold leading-tight text-[var(--text-primary)]">
            {title}
          </h3>
        </div>
        <AppStatusBadge label={tone.label} tone={tone.badgeTone} />
      </div>
      <div className="space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
        <p>
          <strong className="text-[var(--text-primary)]">
            Motivo principal:
          </strong>{" "}
          {reason}
        </p>
        <p className="rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface-primary)]/45 p-3">
          <strong className="text-[var(--text-primary)]">
            Impacto operacional:
          </strong>{" "}
          {impact}
        </p>
      </div>
      {onDetails ? (
        <Button
          className="mt-auto w-full justify-between"
          variant="secondary"
          onClick={onDetails}
        >
          {detailsLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}
    </AppSectionCard>
  );
}

export function NextBestActionCard({
  title,
  entity,
  reason,
  impact,
  safetyNote,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: {
  title: string;
  entity: string;
  reason: string;
  impact: string;
  safetyNote?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}) {
  return (
    <AppSectionCard
      className={cn(
        "flex h-full flex-col gap-4 border-[var(--accent-primary)]/35 bg-[var(--accent-soft)]/35",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-primary)]/25 bg-[var(--surface-primary)]/60">
          <Zap className="h-5 w-5 text-[var(--accent-primary)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="nexo-overline">Próxima Melhor Ação</p>
          <h3 className="mt-1 text-lg font-semibold leading-tight text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
            Entidade: {entity}
          </p>
        </div>
      </div>
      <div className="grid gap-3 text-sm leading-6 text-[var(--text-secondary)] md:grid-cols-2">
        <p>
          <strong className="text-[var(--text-primary)]">Motivo:</strong>{" "}
          {reason}
        </p>
        <p>
          <strong className="text-[var(--text-primary)]">
            Impacto esperado:
          </strong>{" "}
          {impact}
        </p>
      </div>
      {safetyNote ? (
        <p className="rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface-primary)]/50 p-3 text-xs leading-5 text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Segurança:</strong>{" "}
          {safetyNote}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1 justify-between" onClick={onPrimaryAction}>
          {primaryActionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
        {secondaryActionLabel && onSecondaryAction ? (
          <Button
            className="flex-1"
            variant="secondary"
            onClick={onSecondaryAction}
          >
            {secondaryActionLabel}
          </Button>
        ) : null}
      </div>
    </AppSectionCard>
  );
}

export function OperationalFlowCard({
  title = "Fluxo operacional transversal",
  subtitle = "Cliente → Agendamento → O.S. → Cobrança → Pagamento → Timeline → Risco/Governança",
  stages,
  className,
}: {
  title?: string;
  subtitle?: string;
  stages: Array<{
    id: string;
    label: string;
    summary: string;
    state: OperationalFlowStageState;
    countOrValue?: string;
    hrefLabel?: string;
    onClick?: () => void;
  }>;
  className?: string;
}) {
  return (
    <AppSectionCard className={cn("space-y-4", className)}>
      <div>
        <p className="nexo-overline">Cadeia viva da operação</p>
        <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          {subtitle}
        </p>
      </div>
      <div className="grid gap-2 lg:grid-cols-7">
        {stages.map((stage, index) => {
          const tone = flowStageTone[stage.state];
          return (
            <article
              key={stage.id}
              className={cn(
                "relative min-w-0 rounded-xl border p-3",
                tone.container
              )}
            >
              {index < stages.length - 1 ? (
                <span
                  className={cn(
                    "absolute -right-1 top-6 hidden h-0.5 w-2 lg:block",
                    tone.rail
                  )}
                />
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {tone.icon}
                  <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    {stage.label}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {tone.badge}
                </span>
              </div>
              {stage.countOrValue ? (
                <p className="mt-2 text-xl font-semibold leading-tight text-[var(--text-primary)]">
                  {stage.countOrValue}
                </p>
              ) : null}
              <p className="mt-1 min-h-[40px] text-xs leading-5 text-[var(--text-secondary)]">
                {stage.summary}
              </p>
              {stage.onClick ? (
                <Button
                  className="mt-2 h-auto px-0 py-0 text-[var(--accent-primary)]"
                  variant="link"
                  size="sm"
                  onClick={stage.onClick}
                >
                  {stage.hrefLabel ?? "Abrir etapa"}
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>
    </AppSectionCard>
  );
}

export function EntityTimelineCard({
  title = "Últimos eventos oficiais",
  subtitle = "Prova operacional recente usada para sustentar a leitura transversal.",
  events,
  fullTimelineLabel = "Abrir Timeline completa",
  onFullTimeline,
  className,
}: {
  title?: string;
  subtitle?: string;
  events: Array<{
    id: string;
    type: string;
    occurredAt: string;
    entity: string;
    actor?: string;
    summary: string;
  }>;
  fullTimelineLabel?: string;
  onFullTimeline?: () => void;
  className?: string;
}) {
  return (
    <AppSectionCard className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="nexo-overline">Prova operacional</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {subtitle}
          </p>
        </div>
        <History className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
      </div>
      {events.length > 0 ? (
        <ol className="space-y-2">
          {events.map(event => (
            <li
              key={event.id}
              className="rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface-primary)]/45 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <AppStatusBadge label={event.type} tone="neutral" />
                <span className="text-xs text-[var(--text-muted)]">
                  {event.occurredAt}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {event.entity}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                {event.summary}
              </p>
              {event.actor ? (
                <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Responsável: {event.actor}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface-primary)]/45 p-4 text-sm leading-6 text-[var(--text-secondary)]">
          Nenhum evento oficial foi retornado nesta leitura. O Nexo não cria
          histórico fictício; abra a Timeline para investigar a trilha completa.
        </div>
      )}
      {onFullTimeline ? (
        <Button
          className="w-full justify-between"
          variant="secondary"
          onClick={onFullTimeline}
        >
          {fullTimelineLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}
    </AppSectionCard>
  );
}

export function OperationalRiskCard({
  title,
  reason,
  impact,
  ctaLabel,
  onClick,
  className,
}: {
  title: string;
  reason: string;
  impact: string;
  ctaLabel: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <AppSectionCard
      className={cn(
        "flex h-full flex-col gap-3 border-[var(--danger)]/30",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" />
        <div>
          <p className="nexo-overline">Maior risco agora</p>
          <h3 className="mt-1 text-lg font-semibold leading-tight text-[var(--text-primary)]">
            {title}
          </h3>
        </div>
      </div>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        <strong className="text-[var(--text-primary)]">Motivo:</strong> {reason}
      </p>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        <strong className="text-[var(--text-primary)]">Impacto:</strong>{" "}
        {impact}
      </p>
      <Button
        className="mt-auto justify-between"
        variant="secondary"
        onClick={onClick}
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </AppSectionCard>
  );
}
