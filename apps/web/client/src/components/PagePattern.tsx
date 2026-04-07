import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rankPriorityProblems, type PriorityPageContext, type PriorityProblem } from "@/lib/priorityEngine";
import { getNextActionSuggestion, registerActionFlowEvent } from "@/lib/actionFlow";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="space-y-8 p-6 pb-24 md:pb-6">{children}</div>;
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
    <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%)]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
          ) : null}

          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
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
}: {
  pageContext: PriorityPageContext;
  headline: string;
  dominantProblem: string;
  dominantImpact: string;
  dominantCta: { label: string; onClick: () => void; path?: string };
  priorities: PriorityProblem[];
}) {
  const topPriorities = rankPriorityProblems(priorities, { pageContext, limit: 3 });
  const nextActionSuggestion = getNextActionSuggestion(pageContext);

  return (
    <section className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">
          SmartPage
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{headline}</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{dominantProblem}</p>
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Impacto: {dominantImpact}</p>
      </div>

      <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-3 dark:border-white/10 dark:bg-zinc-900/70">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Próxima ação automática</p>
        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{nextActionSuggestion.title}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{nextActionSuggestion.description}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Top 3 prioridades</p>
        <div className="grid gap-2 md:grid-cols-3">
          {topPriorities.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{item.helperText}</p>
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
            dominantCta.onClick();
          }}
        >
          {dominantCta.label}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

export function SurfaceSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`nexo-surface p-5 ${className}`.trim()}>{children}</section>;
}
