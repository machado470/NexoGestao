import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  rankPriorityProblems,
  type PriorityPageContext,
  type PriorityProblem,
} from "@/lib/priorityEngine";
import {
  getNextActionSuggestion,
  registerActionFlowEvent,
} from "@/lib/actionFlow";
import {
  getActionIntentClasses,
  getActionIntentLabel,
} from "@/lib/operations/action-intent";
import {
  sortSmartActions,
  type SmartActionWithExecution,
} from "@/lib/smartActions";
import {
  AlertCard,
  GhostButton,
  PageHeader,
  PrimaryButton,
  PriorityList,
  SecondaryButton,
  SurfaceCard,
  TimelineList,
} from "@/components/design-system";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="nexo-page-shell nexo-section-reveal min-w-0 max-w-full space-y-4">
      {children}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title={
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              {eyebrow}
            </div>
          ) : null}
          {title}
        </div>
      }
      subtitle={description}
      actions={actions}
    />
  );
}

export function SmartPage({
  pageContext,
  headline,
  dominantProblem,
  dominantImpact,
  dominantCta,
  priorities,
  operationalActions = [],
}: {
  pageContext: PriorityPageContext;
  headline: string;
  dominantProblem: string;
  dominantImpact: string;
  dominantCta: { label: string; onClick: () => void; path?: string };
  priorities: PriorityProblem[];
  operationalActions?: SmartActionWithExecution[];
}) {
  const [, navigate] = useLocation();
  const topPriorities = rankPriorityProblems(priorities, {
    pageContext,
    limit: 3,
  });
  const nextActionSuggestion = getNextActionSuggestion(pageContext);
  const orderedActions = sortSmartActions(operationalActions);
  const primaryAction = orderedActions[0];
  const resolvedDominantProblem = primaryAction?.label ?? dominantProblem;
  const resolvedDominantImpact = primaryAction
    ? `Impacto ${primaryAction.impact} • prioridade ${primaryAction.priority}`
    : dominantImpact;

  return (
    <section className="nexo-card-operational nexo-cockpit-zone nexo-section-reveal space-y-3">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] dark:text-orange-300">
          Prioridade operacional
        </p>
        <h2 className="nexo-text-wrap text-lg font-semibold text-[var(--text-primary)]">
          {headline}
        </h2>
        <p className="nexo-text-wrap text-sm text-[var(--text-secondary)]">
          {resolvedDominantProblem}
        </p>
        <p className="nexo-text-wrap text-sm font-medium text-[var(--warning)]">
          Impacto: {resolvedDominantImpact}
        </p>
      </div>

      {primaryAction ? (
        <AlertCard className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)] dark:text-orange-300">
            Ação principal
          </p>
          <p className="nexo-text-wrap mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {primaryAction.label}
          </p>
          <p className="nexo-text-wrap text-xs text-[var(--text-secondary)]">
            {primaryAction.reason}
          </p>
          <div className="mt-3">
            <PrimaryButton
              type="button"
              className="h-9 px-3 text-xs"
              onClick={primaryAction.onExecute}
            >
              Executar agora
            </PrimaryButton>
          </div>
        </AlertCard>
      ) : null}

      {orderedActions.length > 0 ? (
        <PriorityList>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Ações ordenadas
          </p>
          <div className="grid gap-2">
            {orderedActions.map(action => (
              <div
                key={action.id}
                className="nexo-card-informative rounded-lg p-3"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="nexo-text-wrap text-sm font-medium text-[var(--text-primary)]">
                      {action.label}
                    </p>
                    <p className="nexo-text-wrap text-xs text-[var(--text-secondary)]">
                      {action.reason}
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {action.impact} • prioridade {action.priority}
                      {action.auto ? " • auto" : ""}
                    </p>
                  </div>
                  <SecondaryButton
                    type="button"
                    onClick={action.onExecute}
                    className="h-9 px-3 text-xs"
                  >
                    Executar
                  </SecondaryButton>
                </div>
              </div>
            ))}
          </div>
        </PriorityList>
      ) : null}

      <SurfaceCard className="nexo-card-informative p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Próxima ação automática
        </p>
        <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
          {nextActionSuggestion.title}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {nextActionSuggestion.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${getActionIntentClasses(nextActionSuggestion.intent)}`}
          >
            Intent: {getActionIntentLabel(nextActionSuggestion.intent)}
          </span>
          <GhostButton
            type="button"
            onClick={() => navigate(nextActionSuggestion.ctaPath)}
            className="h-8 px-2 text-xs"
          >
            {nextActionSuggestion.ctaLabel}
          </GhostButton>
        </div>
      </SurfaceCard>

      <TimelineList>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Top 3 prioridades
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {topPriorities.map(item => (
            <div key={item.id} className="nexo-card-informative rounded-lg p-3">
              <p className="nexo-text-wrap text-sm font-medium text-[var(--text-primary)]">
                {item.title}
              </p>
              <p className="nexo-text-wrap text-xs text-[var(--text-secondary)]">
                {item.helperText}
              </p>
            </div>
          ))}
        </div>
      </TimelineList>

      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-2 md:border-none md:bg-transparent md:p-0">
        <PrimaryButton
          type="button"
          className="nexo-cta-dominant nexo-state-transition min-h-10 w-full gap-2"
          onClick={() => {
            registerActionFlowEvent("page_primary_cta_clicked", {
              pageContext,
              ctaPath: dominantCta.path,
            });
            if (primaryAction) {
              primaryAction.onExecute();
              return;
            }
            dominantCta.onClick();
          }}
        >
          {primaryAction ? "Executar ação principal" : dominantCta.label}
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </section>
  );
}

export function SurfaceSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <SurfaceCard className={cn("p-4 md:p-5", className)}>{children}</SurfaceCard>;
}
