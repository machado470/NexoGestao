import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useExecutionHandler } from "@/hooks/useExecutionHandler";
import { useExecutionMemory } from "@/lib/execution/execution-memory";
import { trackExecutionEvent } from "@/lib/execution/telemetry";
import type {
  ExecutionAction,
  ExecutionSource,
  OperationalDecision,
} from "@/lib/execution/types";

type OperationalCardProps = {
  decision: OperationalDecision;
  source: ExecutionSource;
};

function getSeverityClasses(severity: OperationalDecision["severity"]) {
  if (severity === "critical") {
    return "border-red-300 bg-red-50/90 dark:border-red-800/70 dark:bg-red-950/30";
  }

  if (severity === "warning") {
    return "border-amber-300 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20";
  }

  return "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40";
}

function getSeverityLabel(severity: OperationalDecision["severity"]) {
  if (severity === "critical") return "Crítico";
  if (severity === "warning") return "Atenção";
  return "Normal";
}

function getStateLabel(state: OperationalDecision["state"]) {
  if (state === "ready") return "Pronto";
  if (state === "blocked") return "Bloqueado";
  if (state === "invalid") return "Inválido";
  return "Concluído";
}

function getActionButtonClass(action: ExecutionAction, suggestedActionId?: string) {
  const isSuggested = suggestedActionId === action.id;

  if (!action.enabled) {
    return "nexo-cta-secondary !h-9 !rounded-lg !px-3 !text-xs opacity-50 cursor-not-allowed";
  }

  if (action.intent === "danger") {
    return "!h-9 !rounded-lg !px-3 !text-xs border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
  }

  if (action.intent === "primary" || isSuggested) {
    return "nexo-cta-primary !h-9 !rounded-lg !px-3 !text-xs";
  }

  return "nexo-cta-secondary !h-9 !rounded-lg !px-3 !text-xs";
}

function getModeLabel(mode: ExecutionAction["mode"]) {
  if (mode === "automatic") return "Automática";
  if (mode === "semi_automatic") return "Semi";
  return "Manual";
}

export function OperationalCard({ decision, source }: OperationalCardProps) {
  const { execute } = useExecutionHandler();
  const { logs } = useExecutionMemory();
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [lastExecutionStatus, setLastExecutionStatus] = useState<"executed" | "failed" | null>(
    null
  );

  const latestDecisionLog = useMemo(
    () => logs.find(log => log.decisionId === decision.id),
    [logs, decision.id]
  );

  useEffect(() => {
    decision.actions.forEach(action => {
      trackExecutionEvent({
        event: "action_shown",
        decisionId: decision.id,
        actionId: action.id,
        source,
        telemetryKey: action.telemetryKey,
      });
    });
  }, [decision.actions, decision.id, source]);

  async function handleExecute(action: ExecutionAction) {
    setExecutingActionId(action.id);

    const result = await execute(action, {
      source,
      decisionId: decision.id,
      entityType: decision.entityType,
      entityId: decision.entityId,
    });

    if (!result.ok && result.message) {
      toast.warning(result.message);
    }
    setLastExecutionStatus(result.ok ? "executed" : "failed");

    setExecutingActionId(null);
  }

  return (
    <article className={`rounded-xl border p-4 ${getSeverityClasses(decision.severity)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-black/10 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:border-white/15 dark:bg-zinc-950/60 dark:text-zinc-200">
          {getSeverityLabel(decision.severity)}
        </span>
        <span className="inline-flex rounded-full border border-black/10 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:border-white/15 dark:bg-zinc-950/60 dark:text-zinc-200">
          {getStateLabel(decision.state)}
        </span>
        {decision.state === "invalid" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" />
            Correção obrigatória
          </span>
        ) : null}
        {decision.state === "completed" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3" />
            Sem pendência crítica
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {decision.title}
      </h3>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{decision.summary}</p>
      {lastExecutionStatus === "executed" || latestDecisionLog?.status === "success" ? (
        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Ação executada com sucesso.
        </p>
      ) : null}
      {lastExecutionStatus === "failed" || latestDecisionLog?.status === "failed" ? (
        <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
          Última execução falhou. Revise os dados e tente novamente.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {decision.actions.map((action) => {
          const isLoading = executingActionId === action.id;
          const isSuggested = decision.suggestedActionId === action.id;

          return (
            <button
              key={action.id}
              type="button"
              disabled={!action.enabled || isLoading}
              onClick={() => handleExecute(action)}
              className={getActionButtonClass(action, decision.suggestedActionId)}
              title={!action.enabled ? action.disabledReason : undefined}
            >
              {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {action.label}
              {isSuggested ? " • recomendado" : ""}
              {` • ${getModeLabel(action.mode)}`}
            </button>
          );
        })}
      </div>
    </article>
  );
}
