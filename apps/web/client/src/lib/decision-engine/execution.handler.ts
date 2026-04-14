import type { Decision } from "./decision.types";
import { logDecisionStatus } from "./operational-log";

type ExecutionHandlerOptions = {
  onTimelineEvent?: (event: { title: string; description: string; decisionId: string; source: Decision["source"] }) => void;
  autoExecuteNext?: Decision | null;
};

function getTimelineTitle(decision: Decision) {
  if (decision.source === "finance") return "Cobrança executada";
  if (decision.source === "whatsapp") return "Mensagem enviada";
  if (decision.source === "appointment") return "Agendamento confirmado";
  if (decision.source === "service-order") return "Execução da O.S. iniciada";
  return "Ação operacional executada";
}

export function executeDecision(decision: Decision, options?: ExecutionHandlerOptions) {
  if (!decision?.action || typeof decision.action.execute !== "function") {
    throw new Error("Decisão sem ação válida para execução.");
  }

  decision.action.execute();
  logDecisionStatus(decision, "executed", "Decisão executada via motor operacional");

  options?.onTimelineEvent?.({
    title: getTimelineTitle(decision),
    description: decision.title,
    decisionId: decision.id,
    source: decision.source,
  });

  if (options?.autoExecuteNext?.action && typeof options.autoExecuteNext.action.execute === "function") {
    options.autoExecuteNext.action.execute();
    logDecisionStatus(options.autoExecuteNext, "executed", "Encadeamento automático executado");
  }
}

export function ignoreDecision(decision: Decision) {
  logDecisionStatus(decision, "ignored", "Decisão ignorada pelo usuário");
}
