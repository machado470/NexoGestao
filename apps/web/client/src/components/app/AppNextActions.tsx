import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppPrimaryAction } from "@/components/app/AppPrimaryAction";
import { useActionHandler } from "@/hooks/useActionHandler";
import {
  buildOperationalRecommendations,
  type OperationEngineInput,
  type OperationRecommendation,
} from "@/lib/operationEngine/operationEngine";

type ExecutionLog = {
  id: string;
  label: string;
  suggestedAt: string;
  executedAt: string;
  timeToExecutionMs: number;
};

export function AppNextActions({
  engineInput,
  title = "Próximas ações",
}: {
  engineInput: OperationEngineInput;
  title?: string;
}) {
  const { executeAction, isExecuting } = useActionHandler();
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const suggestions = useMemo(
    () =>
      buildOperationalRecommendations(engineInput)
        .filter(action => !executedIds.has(action.id))
        .slice(0, 6),
    [engineInput, executedIds]
  );

  useEffect(() => {
    if (!engineInput.autoExecute) return;

    const localAuto = suggestions.find(item => item.execution.mode === "local");
    if (!localAuto) return;

    setExecutedIds(prev => new Set(prev).add(localAuto.id));
    setFeedback(`✔ ${localAuto.label}`);
    setLogs(prev => [
      {
        id: localAuto.id,
        label: localAuto.label,
        suggestedAt: localAuto.suggestedAt,
        executedAt: new Date().toISOString(),
        timeToExecutionMs: Math.max(0, Date.now() - new Date(localAuto.suggestedAt).getTime()),
      },
      ...prev,
    ]);
    toast.success("Zero cliques: ação simples executada automaticamente.");
  }, [engineInput.autoExecute, suggestions]);

  const executeRecommendation = async (action: OperationRecommendation) => {
    if (action.execution.mode === "local") {
      setExecutedIds(prev => new Set(prev).add(action.id));
      setFeedback(`✔ ${action.label}`);
    } else {
      const result = await executeAction(action.execution.action);
      if (!result.ok) return;
      setExecutedIds(prev => new Set(prev).add(action.id));
      setFeedback(`✔ ${action.label}`);
    }

    const next = suggestions.find(item => item.id !== action.id);
    if (next) {
      setFeedback(`✔ ${action.label}\n→ Próxima: ${next.label}`);
    }

    setLogs(prev => [
      {
        id: action.id,
        label: action.label,
        suggestedAt: action.suggestedAt,
        executedAt: new Date().toISOString(),
        timeToExecutionMs: Math.max(0, Date.now() - new Date(action.suggestedAt).getTime()),
      },
      ...prev,
    ]);
  };

  const executeNext = async () => {
    const next = suggestions[0];
    if (!next) {
      toast.message("Sem ação pendente no momento.");
      return;
    }

    await executeRecommendation(next);
  };

  return (
    <section className="nexo-card-panel min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <AppPrimaryAction label="Executar próxima ação" action={executeNext} loadingLabel="Executando sequência..." />
      </div>

      {feedback ? <p className="mt-2 whitespace-pre-line text-xs text-[var(--text-muted)]">{feedback}</p> : null}

      <div className="mt-3 space-y-2">
        {suggestions.map(item => (
          <div key={item.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] p-3">
            <div className="min-w-0">
              <p className="nexo-truncate text-sm font-medium text-[var(--text-primary)]" title={item.label}>{item.label}</p>
              <p className="text-xs text-[var(--text-muted)] nexo-text-wrap">{item.description}</p>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => void executeRecommendation(item)}
              isLoading={item.execution.mode === "app_action" ? isExecuting(item.execution.action.id) : false}
            >
              Executar
            </Button>
          </div>
        ))}

        {suggestions.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Sem ações pendentes no momento.</p> : null}
      </div>

      {logs.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--border-subtle)] p-2">
          <p className="text-xs font-medium text-[var(--text-primary)]">Log de execução</p>
          <div className="mt-1 space-y-1">
            {logs.slice(0, 3).map(item => (
              <p key={item.id} className="text-[11px] text-[var(--text-muted)]">
                {item.label} · {Math.round(item.timeToExecutionMs / 1000)}s até execução
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
