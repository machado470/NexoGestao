import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getPayloadValue, normalizeArrayPayload } from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type ExecutionMode = "manual" | "semi_automatic" | "automatic";

type ExecutionPolicy = {
  allowAutomaticCharge?: boolean;
  allowWhatsAppAuto?: boolean;
  allowOverdueReminderAuto?: boolean;
  allowFinanceTeamNotifications?: boolean;
  allowGovernanceFollowup?: boolean;
  maxRetries?: number;
  throttleWindowMs?: number;
};
type PolicyBooleanKey =
  | "allowAutomaticCharge"
  | "allowWhatsAppAuto"
  | "allowOverdueReminderAuto"
  | "allowFinanceTeamNotifications"
  | "allowGovernanceFollowup";

type ModePayload = { mode?: ExecutionMode; policy?: ExecutionPolicy };
type ExecutionStateSummary = { pending?: number; executed?: number; failed?: number; blocked?: number; throttled?: number };
type ExecutionEvent = {
  id: string;
  actionId?: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  reasonCode?: string | null;
  timestamp?: string;
  diagnostics?: { executionKey?: string | null };
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
  if (status === "blocked" || status === "requires_confirmation") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
}

export function ExecutionOperationsPanel() {
  const { role } = useAuth();
  const canEdit = role ? can(role, "governance:update") || role === "MANAGER" : false;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const [draftMode, setDraftMode] = useState<ExecutionMode>("manual");
  const [draftPolicy, setDraftPolicy] = useState<ExecutionPolicy>({});

  const utils = trpc.useUtils();
  const modeQuery = trpc.nexo.executions.mode.useQuery(undefined, { retry: false });
  const summaryQuery = trpc.nexo.executions.stateSummary.useQuery({ sinceMs: 1000 * 60 * 60 * 24 }, { retry: false });
  const eventsQuery = trpc.nexo.executions.events.useQuery(
    {
      limit: 60,
      status: statusFilter === "all" ? undefined : statusFilter,
      actionId: actionFilter.trim() || undefined,
      entityType: entityFilter === "all" ? undefined : entityFilter,
    },
    { retry: false }
  );

  const updateMode = trpc.nexo.executions.updateMode.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.nexo.executions.mode.invalidate(),
        utils.nexo.executions.events.invalidate(),
        utils.nexo.executions.stateSummary.invalidate(),
      ]);
    },
  });

  const modePayload = useMemo(() => getPayloadValue<ModePayload>(modeQuery.data) ?? {}, [modeQuery.data]);
  const summary = useMemo(() => getPayloadValue<ExecutionStateSummary>(summaryQuery.data) ?? {}, [summaryQuery.data]);
  const events = useMemo(() => normalizeArrayPayload<ExecutionEvent>(eventsQuery.data), [eventsQuery.data]);

  const isLoading = modeQuery.isLoading || summaryQuery.isLoading || eventsQuery.isLoading;

  useEffect(() => {
    if (modePayload.mode) setDraftMode(modePayload.mode);
    if (modePayload.policy) setDraftPolicy(modePayload.policy);
  }, [modePayload.mode, modePayload.policy]);

  const saveConfig = async () => {
    const retries = Number(draftPolicy.maxRetries ?? 0);
    const throttle = Number(draftPolicy.throttleWindowMs ?? 5000);
    if (!Number.isInteger(retries) || retries < 0 || retries > 20) return;
    if (!Number.isInteger(throttle) || throttle < 5000 || throttle > 86400000) return;

    await updateMode.mutateAsync({
      mode: draftMode,
      policy: {
        allowAutomaticCharge: Boolean(draftPolicy.allowAutomaticCharge),
        allowWhatsAppAuto: Boolean(draftPolicy.allowWhatsAppAuto),
        allowOverdueReminderAuto: Boolean(draftPolicy.allowOverdueReminderAuto),
        allowFinanceTeamNotifications: Boolean(draftPolicy.allowFinanceTeamNotifications),
        allowGovernanceFollowup: Boolean(draftPolicy.allowGovernanceFollowup),
        maxRetries: retries,
        throttleWindowMs: throttle,
      },
    });
  };

  return (
    <section className="nexo-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="nexo-section-title">Execution Control v5</h2>
          <p className="nexo-section-description mt-1">Controle administrativo por organização, policy segura e diagnóstico operacional.</p>
        </div>
        <div className="rounded-lg border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-200">Modo atual: <strong>{modeLabel(modePayload.mode)}</strong></div>
      </div>

      {isLoading ? <div className="flex min-h-[120px] items-center justify-center gap-2 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando execution...</div> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3 text-sm">Pending: <strong>{Number(summary.pending ?? 0)}</strong></div>
        <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 p-3 text-sm">Executed: <strong>{Number(summary.executed ?? 0)}</strong></div>
        <div className="rounded-lg border border-red-700/60 bg-red-900/20 p-3 text-sm">Failed: <strong>{Number(summary.failed ?? 0)}</strong></div>
        <div className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-sm">Blocked: <strong>{Number(summary.blocked ?? 0)}</strong></div>
        <div className="rounded-lg border border-orange-700/60 bg-orange-900/20 p-3 text-sm">Throttled: <strong>{Number(summary.throttled ?? 0)}</strong></div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-zinc-100">Administração de mode/policy</h3>{!canEdit ? <span className="text-xs text-zinc-400">Sem permissão de edição</span> : null}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={draftMode} onValueChange={(v) => setDraftMode(v as ExecutionMode)} disabled={!canEdit || updateMode.isPending}>
            <SelectTrigger><SelectValue placeholder="Modo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="semi_automatic">Semi-automático</SelectItem>
              <SelectItem value="automatic">Automático</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" min={0} max={20} value={String(draftPolicy.maxRetries ?? 3)} disabled={!canEdit || updateMode.isPending} onChange={(e) => setDraftPolicy((prev) => ({ ...prev, maxRetries: Number(e.target.value) }))} placeholder="maxRetries" />
          <Input type="number" min={5000} max={86400000} step={1000} value={String(draftPolicy.throttleWindowMs ?? 1800000)} disabled={!canEdit || updateMode.isPending} onChange={(e) => setDraftPolicy((prev) => ({ ...prev, throttleWindowMs: Number(e.target.value) }))} placeholder="throttleWindowMs" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {([
            ["allowAutomaticCharge", "Cobrança automática"],
            ["allowWhatsAppAuto", "WhatsApp link automático"],
            ["allowOverdueReminderAuto", "Lembrete de vencida"],
            ["allowFinanceTeamNotifications", "Notificar equipe financeira"],
            ["allowGovernanceFollowup", "Marcar atenção operacional"],
          ] as [PolicyBooleanKey, string][]).map(([key, label]) => (
            <label key={key} className="rounded-lg border border-zinc-700 p-2 flex items-center justify-between gap-2">
              <span>{label}</span>
              <Switch
                checked={Boolean(draftPolicy[key])}
                disabled={!canEdit || updateMode.isPending}
                onCheckedChange={(checked) => setDraftPolicy((prev) => ({ ...prev, [key]: checked }))}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end"><Button onClick={() => void saveConfig()} disabled={!canEdit || updateMode.isPending}>{updateMode.isPending ? "Salvando..." : "Salvar configuração"}</Button></div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-100">Timeline operacional</h3>
        <div className="grid gap-2 md:grid-cols-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="executed">executed</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
              <SelectItem value="blocked">blocked</SelectItem>
              <SelectItem value="throttled">throttled</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Filtrar por action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas entidades</SelectItem>
              <SelectItem value="charge">charge</SelectItem>
              <SelectItem value="serviceOrder">serviceOrder</SelectItem>
              <SelectItem value="system">system</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void eventsQuery.refetch()}>Atualizar</Button>
        </div>

        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem eventos recentes da execution.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-100">{event.actionId || "ação_não_informada"}</p>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${toneFromStatus(event.status)}`}>{event.status || "pending"}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-300">Entidade: <strong>{event.entityType || "—"}</strong> · {event.entityId || "—"}</div>
                <div className="mt-1 text-xs text-zinc-400">Motivo (reasonCode): <strong>{event.reasonCode || "—"}</strong> · {formatTimestamp(event.timestamp)}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Diagnóstico: executionKey {event.diagnostics?.executionKey ?? "—"}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
