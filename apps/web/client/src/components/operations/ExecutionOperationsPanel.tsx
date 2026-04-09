import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { getPayloadValue, normalizeArrayPayload } from "@/lib/query-helpers";
import { Loader2 } from "lucide-react";

type ExecutionMode = "manual" | "semi_automatic" | "automatic";

type ModePayload = {
  mode?: ExecutionMode;
  policy?: {
    allowAutomaticCharge?: boolean;
    allowWhatsAppAuto?: boolean;
    maxRetries?: number;
    throttleWindowMs?: number;
  };
};

type ExecutionStateSummary = {
  pending?: number;
  executed?: number;
  failed?: number;
  blocked?: number;
  throttled?: number;
};

type ExecutionEvent = {
  id: string;
  actionId?: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  reasonCode?: string | null;
  timestamp?: string;
};

function modeLabel(mode?: ExecutionMode) {
  if (mode === "automatic") return "Automático";
  if (mode === "semi_automatic") return "Semi-automático";
  return "Manual";
}

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function toneFromStatus(status?: string) {
  if (status === "executed") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (status === "failed") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (status === "throttled") return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  if (status === "blocked" || status === "requires_confirmation") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  }
  return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
}

export function ExecutionOperationsPanel() {
  const modeQuery = trpc.nexo.executions.mode.useQuery(undefined, { retry: false });
  const summaryQuery = trpc.nexo.executions.stateSummary.useQuery({ sinceMs: 1000 * 60 * 60 * 24 }, { retry: false });
  const eventsQuery = trpc.nexo.executions.events.useQuery({ limit: 30 }, { retry: false });

  const modePayload = useMemo(() => getPayloadValue<ModePayload>(modeQuery.data) ?? {}, [modeQuery.data]);
  const summary = useMemo(() => getPayloadValue<ExecutionStateSummary>(summaryQuery.data) ?? {}, [summaryQuery.data]);
  const events = useMemo(() => normalizeArrayPayload<ExecutionEvent>(eventsQuery.data), [eventsQuery.data]);

  const isLoading = modeQuery.isLoading || summaryQuery.isLoading || eventsQuery.isLoading;

  return (
    <section className="nexo-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="nexo-section-title">Execution Control v5</h2>
          <p className="nexo-section-description mt-1">Modo por organização, estado operacional e trilha de execução em tempo real.</p>
        </div>
        <div className="rounded-lg border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-200">
          Modo atual: <strong>{modeLabel(modePayload.mode)}</strong>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[120px] items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando execution...
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3 text-sm">Pending: <strong>{Number(summary.pending ?? 0)}</strong></div>
        <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 p-3 text-sm">Executed: <strong>{Number(summary.executed ?? 0)}</strong></div>
        <div className="rounded-lg border border-red-700/60 bg-red-900/20 p-3 text-sm">Failed: <strong>{Number(summary.failed ?? 0)}</strong></div>
        <div className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-sm">Blocked: <strong>{Number(summary.blocked ?? 0)}</strong></div>
        <div className="rounded-lg border border-orange-700/60 bg-orange-900/20 p-3 text-sm">Throttled: <strong>{Number(summary.throttled ?? 0)}</strong></div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Timeline operacional</h3>
        <p className="mt-1 text-xs text-zinc-400">Decisão → execução → bloqueio/falha. Cada item mostra ação, entidade, status e motivo.</p>

        <div className="mt-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem eventos recentes da execution.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-100">{event.actionId || "ação_não_informada"}</p>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${toneFromStatus(event.status)}`}>
                    {event.status || "pending"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-300">
                  Entidade: <strong>{event.entityType || "—"}</strong> · {event.entityId || "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  Motivo: {event.reasonCode || "—"} · {formatTimestamp(event.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
