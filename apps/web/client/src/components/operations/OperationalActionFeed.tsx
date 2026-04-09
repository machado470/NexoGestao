import { useMemo } from "react";
import { OperationalCard } from "@/components/operations/OperationalCard";
import { useExecutionMemory } from "@/lib/execution/execution-memory";
import type { ExecutionPlan } from "@/lib/execution/types";

type OperationalActionFeedProps = {
  plan: ExecutionPlan;
};

export function OperationalActionFeed({ plan }: OperationalActionFeedProps) {
  const { logs } = useExecutionMemory();

  const executionState = useMemo(() => {
    const decisionIds = new Set(plan.decisions.map(decision => decision.id));
    const scoped = logs.filter(log => decisionIds.has(log.decisionId));

    const executed = scoped.filter(log => log.status === "success").length;
    const failed = scoped.filter(log => log.status === "failed").length;
    const totalActions = plan.decisions.reduce((acc, decision) => acc + decision.actions.length, 0);
    const pending = Math.max(totalActions - executed - failed, 0);

    return { executed, failed, pending };
  }, [logs, plan.decisions]);

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
        <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">
          Falhadas: {executionState.failed}
        </span>
        <span className="inline-flex rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-1 text-zinc-700 dark:text-zinc-300">
          Pendentes: {executionState.pending}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {plan.decisions.map((decision) => (
          <OperationalCard
            key={decision.id}
            decision={decision}
            source={plan.source}
          />
        ))}
      </div>
    </section>
  );
}
