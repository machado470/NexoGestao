import { OperationalCard } from "@/components/operations/OperationalCard";
import type { ExecutionPlan } from "@/lib/execution/types";

type OperationalActionFeedProps = {
  plan: ExecutionPlan;
};

export function OperationalActionFeed({ plan }: OperationalActionFeedProps) {
  return (
    <section className="nexo-surface nexo-fade-in p-5">
      <h2 className="nexo-section-title">Próximas ações</h2>
      <p className="mt-1 nexo-section-description">
        Execução operacional orientada por diagnóstico: o que destrava operação e caixa agora.
      </p>

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
