import { useLocation } from "wouter";
import { AppNextActionCard } from "@/components/internal-page-system";
import { executeDecision } from "@/lib/decision-engine/execution.handler";
import type { Decision } from "@/lib/decision-engine/decision.types";
import { appendOperationalLog } from "@/lib/decision-engine/operational-log";
import { useNextExecution } from "@/lib/decision-engine/useNextExecution";

export function toNextActionCardProps(decision: Decision) {
  return {
    title: decision.title,
    description: decision.description,
    severity: decision.severity,
    metadata: decision.source,
    action: {
      label: decision.action.label,
      onClick: () => undefined,
    },
  } as const;
}

export function GlobalNextAction({ customerId, className }: { customerId?: string | null; className?: string }) {
  const [, navigate] = useLocation();
  const { nextDecision } = useNextExecution({ navigate, customerId });

  if (!nextDecision) return null;

  const cardProps = toNextActionCardProps(nextDecision);

  return (
    <div className={className}>
      <AppNextActionCard
        {...cardProps}
        action={{
          ...cardProps.action,
          onClick: () => {
            executeDecision(nextDecision, {
              onTimelineEvent: (event) => {
                appendOperationalLog({
                  decision_id: event.decisionId,
                  status: "executed",
                  timestamp: new Date().toISOString(),
                  source: event.source,
                  entityId: nextDecision.entityId,
                  message: event.title,
                });
              },
            });
          },
        }}
      />
    </div>
  );
}
