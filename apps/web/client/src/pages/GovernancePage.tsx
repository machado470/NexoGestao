// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppFiltersBar,
  AppKpiRow,
  AppOperationalHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { setBootPhase } from "@/lib/bootPhase";

type GovernanceState = "NORMAL" | "WARNING" | "RESTRICTED" | "SUSPENDED";
type Priority = "critical" | "high" | "medium";

type Signal = {
  id: string;
  title: string;
  reason: string;
  impact: string;
  priority: Priority;
  count: number;
  cta: string;
  path: string;
};

function metric(source: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stateFromSignals(signals: Signal[], riskScore: number): GovernanceState {
  if (signals.some(item => item.priority === "critical") || riskScore >= 75) return "SUSPENDED";
  if (riskScore >= 55 || signals.filter(item => item.priority !== "medium").length >= 2) return "RESTRICTED";
  if (signals.length > 0 || riskScore >= 30) return "WARNING";
  return "NORMAL";
}

function stateCopy(state: GovernanceState) {
  if (state === "SUSPENDED") return "A operação exige contenção imediata: há sinais críticos com impacto direto no atendimento ou recebimento.";
  if (state === "RESTRICTED") return "A operação pode seguir, mas a governança recomenda limitar decisões até corrigir os pontos prioritários.";
  if (state === "WARNING") return "A operação está funcionando, porém há desvios que precisam de ação antes que virem bloqueio.";
  return "Operação estável: nenhum sinal relevante exige intervenção neste momento.";
}

function priorityLabel(priority: Priority) {
  if (priority === "critical") return "Crítica";
  if (priority === "high") return "Alta";
  return "Média";
}

export default function GovernancePage() {
  setBootPhase("PAGE:Governança");
  useRenderWatchdog("GovernancePage");

  const [, navigate] = useLocation();
  const summaryQuery = trpc.governance.summary.useQuery(undefined, { retry: false });
  const runsQuery = trpc.governance.runs.useQuery({ limit: 12 }, { retry: false });
  const overdueChargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 20, status: "OVERDUE" }, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 60 }, { retry: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });

  const summary = useMemo(() => normalizeObjectPayload<any>(summaryQuery.data) ?? {}, [summaryQuery.data]);
  const runs = useMemo(() => normalizeArrayPayload<any>(runsQuery.data), [runsQuery.data]);
  const chargesPayload = useMemo(() => normalizeObjectPayload<any>(overdueChargesQuery.data) ?? {}, [overdueChargesQuery.data]);
  const serviceOrdersPayload = useMemo(() => normalizeObjectPayload<any>(serviceOrdersQuery.data) ?? {}, [serviceOrdersQuery.data]);
  const overdueCharges = useMemo(() => normalizeArrayPayload<any>(chargesPayload.data ?? chargesPayload.items ?? overdueChargesQuery.data), [chargesPayload, overdueChargesQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersPayload.data ?? serviceOrdersPayload.items ?? serviceOrdersQuery.data), [serviceOrdersPayload, serviceOrdersQuery.data]);
  const appointments = useMemo(() => normalizeArrayPayload<any>(appointmentsQuery.data), [appointmentsQuery.data]);

  const openOrders = serviceOrders.filter(item => !["DONE", "COMPLETED", "CANCELED", "CANCELLED"].includes(String(item?.status ?? "").toUpperCase()));
  const delayedOrders = openOrders.filter(item => {
    if (!item?.dueDate) return false;
    const due = new Date(String(item.dueDate)).getTime();
    return Number.isFinite(due) && due < Date.now();
  });
  const unassignedOrders = openOrders.filter(item => !item?.assignedToPersonId && !item?.personId && !item?.ownerId);
  const staleAppointments = appointments.filter(item => {
    const status = String(item?.status ?? "").toUpperCase();
    if (["CONFIRMED", "DONE", "COMPLETED", "CANCELED", "CANCELLED"].includes(status)) return false;
    const when = new Date(String(item?.startAt ?? item?.startsAt ?? item?.date ?? "")).getTime();
    return Number.isFinite(when) && when < Date.now();
  });

  const signals = useMemo<Signal[]>(() => {
    const items: Signal[] = [];
    const riskScore = metric(summary, "riskScore", "score", "operationalRiskScore");
    const backendAlerts = metric(summary, "alerts", "openAlerts", "activeAlerts");
    if (overdueCharges.length > 0) {
      items.push({ id: "overdue", title: "Cobranças vencidas sem resolução", reason: `${overdueCharges.length} cobrança(s) vencida(s) aparecem na fonte financeira.`, impact: "Pressiona caixa e pode bloquear continuidade comercial.", priority: overdueCharges.length >= 3 ? "critical" : "high", count: overdueCharges.length, cta: "Priorizar cobrança", path: "/finances?status=OVERDUE&source=governance" });
    }
    if (delayedOrders.length > 0) {
      items.push({ id: "late-orders", title: "O.S. atrasadas", reason: `${delayedOrders.length} O.S. aberta(s) passaram do prazo informado.`, impact: "Aumenta retrabalho, reclamação e perda de previsibilidade.", priority: delayedOrders.length >= 3 ? "critical" : "high", count: delayedOrders.length, cta: "Reorganizar execução", path: "/service-orders?filter=late&source=governance" });
    }
    if (unassignedOrders.length > 0) {
      items.push({ id: "unassigned", title: "O.S. sem responsável", reason: `${unassignedOrders.length} O.S. não têm dono operacional claro.`, impact: "Cria fila invisível e impede cobrança de execução.", priority: "medium", count: unassignedOrders.length, cta: "Atribuir responsáveis", path: "/service-orders?filter=unassigned&source=governance" });
    }
    if (staleAppointments.length > 0) {
      items.push({ id: "appointments", title: "Agendamentos pendentes no passado", reason: `${staleAppointments.length} agenda(s) não foram concluídas nem canceladas.`, impact: "Deixa a agenda pouco confiável para decisão diária.", priority: "medium", count: staleAppointments.length, cta: "Revisar agenda", path: "/appointments?source=governance" });
    }
    if (backendAlerts > 0 || riskScore >= 30) {
      items.push({ id: "risk-score", title: "Sinal de risco consolidado", reason: `Fonte de governança reporta score ${riskScore || "ativo"} e ${backendAlerts} alerta(s).`, impact: "Indica risco transversal que deve ser acompanhado no histórico.", priority: riskScore >= 70 ? "critical" : "high", count: Math.max(backendAlerts, riskScore), cta: "Ver histórico", path: "/timeline?module=governance" });
    }
    return items;
  }, [delayedOrders.length, overdueCharges.length, staleAppointments.length, summary, unassignedOrders.length]);

  const riskScore = Math.max(metric(summary, "riskScore", "score", "operationalRiskScore"), signals.reduce((total, item) => total + (item.priority === "critical" ? 25 : item.priority === "high" ? 15 : 8), 0));
  const state = stateFromSignals(signals, riskScore);
  const executedActions = [
    { label: "Alertas gerados", value: String(signals.length), detail: signals.length ? "Alertas derivados de cobrança, execução e agenda." : "Nenhum alerta necessário agora." },
    { label: "Ações automáticas", value: String(metric(summary, "automaticActions", "actionsExecuted", "autoActions")), detail: "Execuções registradas pela governança quando disponíveis no backend." },
    { label: "Restrições aplicadas", value: state === "SUSPENDED" || state === "RESTRICTED" ? "Sim" : "Não", detail: state === "NORMAL" ? "Sem restrição operacional." : "Revisar prioridades antes de expandir novas ações." },
  ];

  const history = runs.length > 0 ? runs : [{ id: "current", status: state, createdAt: new Date().toISOString(), summary: stateCopy(state), riskScore }];

  return (
    <PageWrapper title="Governança" subtitle="Centro de decisão operacional com sinais, ações e recomendações.">
      <AppPageShell>
        <AppOperationalHeader
          title="Governança operacional"
          description={stateCopy(state)}
          primaryAction={<Button onClick={() => navigate("/timeline?module=governance")}>Abrir trilha de decisões</Button>}
          secondaryActions={<Button variant="outline" onClick={() => void Promise.all([summaryQuery.refetch(), runsQuery.refetch(), overdueChargesQuery.refetch(), serviceOrdersQuery.refetch(), appointmentsQuery.refetch()])}>Atualizar sinais</Button>}
          contextChips={<><AppStatusBadge label={state} /><AppStatusBadge label={`Score ${riskScore}`} /><AppStatusBadge label={`${signals.length} sinal(is)`} /></>}
        />

        <AppFiltersBar>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-4">
            <span><strong>NORMAL:</strong> operação controlada.</span>
            <span><strong>WARNING:</strong> desvio pede ação.</span>
            <span><strong>RESTRICTED:</strong> limitar decisões até correção.</span>
            <span><strong>SUSPENDED:</strong> conter risco crítico.</span>
          </div>
        </AppFiltersBar>

        <AppKpiRow items={[{ title: "Estado atual", value: state, hint: "Estado operacional consolidado." }, { title: "Sinais detectados", value: String(signals.length), hint: "Problemas relevantes nesta leitura." }, { title: "Impacto crítico", value: String(signals.filter(item => item.priority === "critical").length), hint: "Itens que podem suspender a operação." }, { title: "Execuções", value: String(history.length), hint: "Rodadas/eventos de governança." }]} />

        <AppSectionBlock title="Situação atual" subtitle="Sinais detectados, motivos e impacto operacional.">
          <AppDataTable className="min-w-[820px]">
            <thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-3 py-2">Sinal</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2">Impacto</th><th className="px-3 py-2">Prioridade</th></tr></thead>
            <tbody>{signals.length ? signals.map(signal => <tr key={signal.id} className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 font-medium text-[var(--text-primary)]">{signal.title}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{signal.reason}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{signal.impact}</td><td className="px-3 py-3"><AppStatusBadge label={priorityLabel(signal.priority)} /></td></tr>) : <tr><td colSpan={4} className="px-3 py-4 text-[var(--text-muted)]">Nenhum sinal relevante detectado nesta janela.</td></tr>}</tbody>
          </AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock title="Ações executadas" subtitle="Alertas, automações e restrições que o sistema já aplicou ou registrou.">
          <AppKpiRow items={executedActions.map(item => ({ title: item.label, value: item.value, hint: item.detail }))} gridClassName="xl:grid-cols-3" />
        </AppSectionBlock>

        <AppSectionBlock title="Próximas ações recomendadas" subtitle="Priorização objetiva com motivo e CTA operacional.">
          <AppDataTable className="min-w-[760px]"><thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-3 py-2">Prioridade</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2 text-right">CTA</th></tr></thead><tbody>{(signals.length ? signals : [{ id: "monitor", title: "Manter supervisão", reason: "Operação sem desvios relevantes.", impact: "Preserva previsibilidade.", priority: "medium" as Priority, count: 0, cta: "Ver timeline", path: "/timeline?module=governance" }]).map(item => <tr key={item.id} className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3"><AppStatusBadge label={priorityLabel(item.priority)} /></td><td className="px-3 py-3 text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{item.title}.</strong> {item.reason}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => navigate(item.path)}>{item.cta}</Button></td></tr>)}</tbody></AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock title="Histórico de governança" subtitle="Mudanças de estado, execuções anteriores e eventos relevantes.">
          <AppDataTable className="min-w-[760px]"><thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Evento</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Resumo</th></tr></thead><tbody>{history.slice(0, 12).map((run: any, index: number) => <tr key={String(run?.id ?? index)} className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3">{formatDateTime(run?.createdAt ?? run?.startedAt ?? run?.occurredAt)}</td><td className="px-3 py-3 text-[var(--text-primary)]">{String(run?.event ?? run?.type ?? "Execução de governança")}</td><td className="px-3 py-3"><AppStatusBadge label={String(run?.state ?? run?.status ?? state)} /></td><td className="px-3 py-3 text-[var(--text-secondary)]">{String(run?.summary ?? run?.message ?? stateCopy(state))}</td></tr>)}</tbody></AppDataTable>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
