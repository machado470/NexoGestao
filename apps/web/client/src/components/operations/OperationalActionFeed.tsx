import { useMemo } from "react";
import { OperationalCard } from "@/components/operations/OperationalCard";
import { useExecutionMemory } from "@/lib/execution/execution-memory";
import type { ExecutionPlan, RiskOperationalState } from "@/lib/execution/types";

type OperationalActionFeedProps = {
  plan: ExecutionPlan;
  riskOperationalState?: RiskOperationalState;
};

export function OperationalActionFeed({ plan, riskOperationalState }: OperationalActionFeedProps) {
  const { logs } = useExecutionMemory();
  const prioritizedDecisions = useMemo(
    () =>
      [...plan.decisions]
        .sort((a, b) => {
          const scoreA = (a.impactScore ?? 50) + (a.urgencyScore ?? 50) + (a.priority ?? 0);
          const scoreB = (b.impactScore ?? 50) + (b.urgencyScore ?? 50) + (b.priority ?? 0);
          return scoreB - scoreA;
        })
        .filter(item => item.severity !== "normal" || item.state !== "completed"),
    [plan.decisions]
  );

  const executionState = useMemo(() => {
    const decisionIds = new Set(prioritizedDecisions.map(decision => decision.id));
    const scoped = logs.filter(log => decisionIds.has(log.decisionId));

    const executed = scoped.filter(log => log.status === "success").length;
    const failed = scoped.filter(log => log.status === "failed").length;
    const blocked = scoped.filter(
      log => log.status === "blocked" || log.status === "restricted" || log.status === "requires_confirmation"
    ).length;
    const throttled = scoped.filter(log => log.status === "throttled").length;
    const totalActions = prioritizedDecisions.reduce((acc, decision) => acc + decision.actions.length, 0);
    const pending = Math.max(totalActions - executed - failed - blocked - throttled, 0);

    return { executed, failed, blocked, throttled, pending };
  }, [logs, prioritizedDecisions]);

  return (
    <section className="nexo-surface nexo-fade-in p-5">
      <h2 className="nexo-section-title">Próximas ações</h2>
      <p className="mt-1 nexo-section-description">
        Execução operacional orientada por diagnóstico: o que destrava operação e caixa agora.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
          Executadas: {executionState.executed}
        </span>
        <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
          Bloqueadas: {executionState.blocked}
        </span>
        <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">
          Falhadas: {executionState.failed}
        </span>
        <span className="inline-flex rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">
          Throttled: {executionState.throttled}
        </span>
        <span className="inline-flex rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-1 text-zinc-700 dark:text-zinc-300">
          Pendentes: {executionState.pending}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {prioritizedDecisions.map((decision) => (
          <OperationalCard
            key={decision.id}
            decision={decision}
            source={plan.source}
            riskOperationalState={riskOperationalState}
          />
        ))}
      </div>
    </section>
  );
}
