import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { rankPriorityProblems, type PriorityPageContext, type PriorityProblem } from "@/lib/priorityEngine";
import { getNextActionSuggestion, registerActionFlowEvent } from "@/lib/actionFlow";
import { getActionIntentClasses, getActionIntentLabel } from "@/lib/operations/action-intent";
import { sortSmartActions, type SmartActionWithExecution } from "@/lib/smartActions";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="nexo-page-shell">{children}</div>;
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
    <section className="nexo-page-header">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_24%)]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
          ) : null}

          <h1 className="nexo-page-header-title">
            {title}
          </h1>

          {description ? (
            <p className="nexo-page-header-description">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
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
  const topPriorities = rankPriorityProblems(priorities, { pageContext, limit: 3 });
  const nextActionSuggestion = getNextActionSuggestion(pageContext);
  const orderedActions = sortSmartActions(operationalActions);
  const primaryAction = orderedActions[0];
  const resolvedDominantProblem = primaryAction?.label ?? dominantProblem;
  const resolvedDominantImpact = primaryAction
    ? `Impacto ${primaryAction.impact} • prioridade ${primaryAction.priority}`
    : dominantImpact;

  return (
    <section className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">
          Prioridade operacional
        </p>
        <h2 className="nexo-text-wrap text-lg font-semibold text-zinc-900 dark:text-zinc-100">{headline}</h2>
        <p className="nexo-text-wrap text-sm text-zinc-700 dark:text-zinc-300">{resolvedDominantProblem}</p>
        <p className="nexo-text-wrap text-sm font-medium text-red-700 dark:text-red-300">Impacto: {resolvedDominantImpact}</p>
      </div>

      {primaryAction ? (
        <div className="rounded-xl border border-orange-300 bg-white/90 p-3 dark:border-orange-800/60 dark:bg-zinc-900/70">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">Ação principal</p>
          <p className="nexo-text-wrap mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{primaryAction.label}</p>
          <p className="nexo-text-wrap text-xs text-zinc-600 dark:text-zinc-300">{primaryAction.reason}</p>
          <div className="mt-3">
            <Button type="button" size="sm" className="bg-orange-500 text-white" onClick={primaryAction.onExecute}>
              Executar agora
            </Button>
          </div>
        </div>
      ) : null}

      {orderedActions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Ações ordenadas</p>
          <div className="grid gap-2">
            {orderedActions.map((action) => (
              <div key={action.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="nexo-text-wrap text-sm font-medium text-zinc-900 dark:text-zinc-100">{action.label}</p>
                    <p className="nexo-text-wrap text-xs text-zinc-600 dark:text-zinc-400">{action.reason}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      {action.impact} • prioridade {action.priority}{action.auto ? " • auto" : ""}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={action.onExecute}>
                    Executar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-3 dark:border-white/10 dark:bg-zinc-900/70">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Próxima ação automática</p>
        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{nextActionSuggestion.title}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{nextActionSuggestion.description}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${getActionIntentClasses(nextActionSuggestion.intent)}`}>
            Intent: {getActionIntentLabel(nextActionSuggestion.intent)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate(nextActionSuggestion.ctaPath)}
          >
            {nextActionSuggestion.ctaLabel}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Top 3 prioridades</p>
        <div className="grid gap-2 md:grid-cols-3">
          {topPriorities.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="nexo-text-wrap text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
              <p className="nexo-text-wrap text-xs text-zinc-600 dark:text-zinc-400">{item.helperText}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-3 z-20 md:static">
        <Button
          type="button"
          className="min-h-12 w-full gap-2 bg-orange-500 text-white"
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
        </Button>
      </div>
    </section>
  );
}

export function SurfaceSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`nexo-surface p-5 ${className}`.trim()}>{children}</section>;
}
