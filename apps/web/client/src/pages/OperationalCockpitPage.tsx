import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AppOperationalHeader, AppPageErrorState, AppPageLoadingState } from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { presentationStatusLabel } from "@/lib/presentation-status";

type Severity = "INFO" | "WARNING" | "CRITICAL";
type DataState<T> = { data: T | null; loading: boolean; error: string | null };

type Summary = Record<string, unknown>;
type Incident = { id?: string; title?: string; severity?: Severity; status?: string; createdAt?: string; message?: string };
type Queue = { name?: string; status?: string; backlog?: number; lagSeconds?: number };
type Dlq = { queue?: string; count?: number; oldestMessageAgeSeconds?: number };
type Failure = { id?: string; message?: string; source?: string; createdAt?: string; severity?: Severity };
type ActionState = "idle" | "loading" | "success" | "error";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha em ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export default function OperationalCockpitPage() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [summary, setSummary] = useState<DataState<Summary>>({ data: null, loading: true, error: null });
  const [incidents, setIncidents] = useState<DataState<Incident[]>>({ data: null, loading: true, error: null });
  const [queues, setQueues] = useState<DataState<Queue[]>>({ data: null, loading: true, error: null });
  const [dlq, setDlq] = useState<DataState<Dlq[]>>({ data: null, loading: true, error: null });
  const [failures, setFailures] = useState<DataState<Failure[]>>({ data: null, loading: true, error: null });
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const load = async () => {
    const loadOne = async <T,>(setter: (v: DataState<T>) => void, path: string, fallback: T) => {
      setter({ data: fallback, loading: true, error: null });
      try {
        const data = await fetchJson<T>(path);
        setter({ data, loading: false, error: null });
      } catch (err) {
        setter({ data: fallback, loading: false, error: err instanceof Error ? err.message : "Erro inesperado" });
      }
    };
    await Promise.all([
      loadOne(setSummary, "/internal/operations/summary", {}),
      loadOne(setIncidents, "/internal/operations/incidents", []),
      loadOne(setQueues, "/internal/operations/queues", []),
      loadOne(setDlq, "/internal/operations/dlq", []),
      loadOne(setFailures, "/internal/operations/recent-failures", []),
      fetchJson("/internal/metrics").catch(() => null),
    ]);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh]);

  const criticalIncidents = useMemo(() => getCriticalIncidents(incidents.data ?? []), [incidents.data]);
  const degradedQueues = useMemo(() => getDegradedQueues(queues.data ?? []), [queues.data]);
  const isAnyActionLoading = useMemo(() => Object.values(actionState).some((state) => state === "loading"), [actionState]);

  const runAction = async (key: string, description: string, action: () => Promise<void>) => {
    if (shouldBlockOperationalAction(actionState[key], isAnyActionLoading)) return;
    const confirmed = window.confirm(`Confirmar ação operacional?\n\n${description}`);
    if (!confirmed) return;
    setActionFeedback(null);
    setActionState((prev) => ({ ...prev, [key]: "loading" }));
    try {
      await action();
      setActionState((prev) => ({ ...prev, [key]: "success" }));
      setActionFeedback("Ação executada com sucesso. Atualizando visão operacional…");
      await load();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [key]: "error" }));
      setActionFeedback(error instanceof Error ? error.message : "Falha operacional ao executar ação.");
    }
  };

  return (
    <div className="space-y-4">
      <AppOperationalHeader
        density="compact"
        title="Cockpit Operacional / SRE"
        description="Leitura rápida para ação operacional: incidentes, degradações, backlog e recuperação."
        primaryAction={<Button size="sm" disabled={isAnyActionLoading} onClick={() => void load()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Atualizar</Button>}
        secondaryActions={<Button size="sm" variant="outline" onClick={() => setAutoRefresh(v => !v)}>{autoRefresh ? "Auto-refresh ligado" : "Auto-refresh desligado"}</Button>}
      />
      {(summary.loading && incidents.loading) ? <AppPageLoadingState description="Carregando sinais operacionais..." /> : null}
      {(summary.error && incidents.error) ? <AppPageErrorState description="Falha ao carregar cockpit operacional." onAction={() => void load()} /> : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MiniCard title="Status geral" value={presentationStatusLabel(summary.error ? "DEGRADED" : "OK")} tone={summary.error ? "WARNING" : "INFO"} />
        <MiniCard title="Incidentes ativos" value={String((incidents.data ?? []).length)} tone={criticalIncidents.length ? "CRITICAL" : "INFO"} />
        <MiniCard title="Filas degradadas" value={String(degradedQueues.length)} tone={degradedQueues.length ? "WARNING" : "INFO"} />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ListCard title="Incidentes ativos" empty="Nenhum incidente ativo.">
          {(incidents.data ?? []).map((item, idx) => <Row key={item.id ?? idx} label={item.title ?? item.message ?? "Incidente"} meta={presentationStatusLabel(item.status, "Aberto")} severity={item.severity ?? "WARNING"} />)}
        </ListCard>
        <ListCard title="Filas degradadas" empty="Nenhuma fila degradada.">
          {degradedQueues.map((item, idx) => <Row key={item.name ?? idx} label={item.name ?? "queue"} meta={`backlog ${item.backlog ?? 0}`} severity="WARNING" />)}
        </ListCard>
        <ListCard title="DLQ / backlog" empty="Sem itens em DLQ.">
          {(dlq.data ?? []).map((item, idx) => (
            <Row
              key={item.queue ?? idx}
              label={item.queue ?? "DLQ"}
              meta={`${item.count ?? 0} msgs`}
              severity={(item.count ?? 0) > 0 ? "CRITICAL" : "INFO"}
              action={(item.count ?? 0) > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={shouldBlockOperationalAction(actionState[`retry-dlq-${item.queue ?? idx}`], isAnyActionLoading)}
                  onClick={() => void runAction(`retry-dlq-${item.queue ?? idx}`, `Retry manual dos itens da fila ${item.queue ?? "DLQ"}.`, async () => {
                    await fetchJson(`/internal/operations/dlq`);
                  })}
                >
                  {actionState[`retry-dlq-${item.queue ?? idx}`] === "loading" ? "Retry..." : "Retry"}
                </Button>
              ) : null}
            />
          ))}
        </ListCard>
        <ListCard title="Failures recentes" empty="Sem failures recentes.">
          {(failures.data ?? []).map((item, idx) => <Row key={item.id ?? idx} label={item.message ?? "Falha"} meta={item.source ?? "worker"} severity={item.severity ?? "WARNING"} action={item.id ? <Button size="sm" variant="outline" disabled={shouldBlockOperationalAction(actionState[`replay-${item.id}`], isAnyActionLoading)} onClick={() => void runAction(`replay-${item.id}`, `Replay seguro da entrega webhook com falha ${item.id}.`, async () => {
            const res = await fetch(`/webhooks/deliveries/${item.id}/replay`, { method: "POST", credentials: "include" });
            if (!res.ok) throw new Error(`Replay falhou (${res.status}).`);
          })}>{actionState[`replay-${item.id}`] === "loading" ? "Replay..." : "Replay"}</Button> : null} />)}
        </ListCard>
      </section>
      {actionFeedback ? <p className="text-xs text-[var(--text-secondary)]">{actionFeedback}</p> : null}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--text-primary)]">Recovery / replay</p>
        <p className="mt-1">Hooks preparados para replay e ações de recuperação via backend (sem execução automática nesta fase).</p>
      </section>
    </div>
  );
}

function Badge({ severity }: { severity: Severity }) {
  return <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", severity === "CRITICAL" ? "bg-rose-500/15 text-rose-600" : severity === "WARNING" ? "bg-amber-500/15 text-amber-600" : "bg-zinc-500/10 text-zinc-600")}>{presentationStatusLabel(severity)}</span>;
}
function MiniCard({ title, value, tone }: { title: string; value: string; tone: Severity }) {
  return <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-secondary)]">{title}</p><div className="mt-2 flex items-center justify-between"><p className="text-lg font-semibold">{value}</p><Badge severity={tone} /></div></div>;
}
function ListCard({ title, children, empty }: { title: string; children: ReactNode[]; empty: string }) {
  return <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-sm font-semibold">{title}</p><div className="mt-2 space-y-2">{children.length ? children : <p className="text-sm text-[var(--text-secondary)]">{empty}</p>}</div></div>;
}
function Row({ label, meta, severity, action }: { label: string; meta: string; severity: Severity; action?: ReactNode }) {
  return <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 last:border-none"><div className="min-w-0"><p className="truncate text-sm">{label}</p><p className="text-xs text-[var(--text-secondary)]">{meta}</p></div><div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-[var(--text-secondary)]" /><Badge severity={severity} />{action}</div></div>;
}

export function getCriticalIncidents(items: Incident[]) { return items.filter(i => i.severity === "CRITICAL"); }
export function getDegradedQueues(items: Queue[]) { return items.filter(q => (q.status ?? "").toLowerCase() !== "healthy"); }
export function shouldBlockOperationalAction(current: ActionState | undefined, hasConcurrentAction: boolean) {
  return current === "loading" || hasConcurrentAction;
}
