import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/design-system";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { AppStatCard, AppTimeline, AppTimelineItem, AppToolbar } from "@/components/app-system";
import {
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";

type PersonItem = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  active: boolean;
  operationalState?: string | null;
  updatedAt?: string | null;
};

type LinkedStatsResponse = { count: number };

type NormalizedPersonRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operador" | "financeiro" | "outro";
  roleLabel: string;
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning" | "danger";
  workload: number;
  assignedServiceOrders: number;
  pendingServiceOrders: number;
  appointmentsToday: number;
  delays: number;
  riskLevel: "alto" | "medio" | "baixo";
  performanceLabel: string;
  lastActivityLabel: string;
  isInactive: boolean;
  governanceSummary: string;
};

function toArray<T>(value: unknown): T[] {
  return normalizeArrayPayload<T>(value);
}

function getDateCandidate(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value) {
      const dt = new Date(value);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }
  return null;
}

function isServiceOrderClosed(status: unknown) {
  const text = String(status ?? "").toUpperCase();
  return ["DONE", "COMPLETED", "CLOSED", "FINISHED", "CANCELLED", "CANCELED"].includes(text);
}

function normalizeRole(role: string | null | undefined): NormalizedPersonRow["role"] {
  const value = String(role ?? "").toUpperCase();
  if (value.includes("ADMIN") || value.includes("MANAGER")) return "admin";
  if (value.includes("FINANCE")) return "financeiro";
  if (value.includes("STAFF") || value.includes("OP") || value.includes("OPER")) return "operador";
  return "outro";
}

function roleLabel(role: NormalizedPersonRow["role"]) {
  if (role === "admin") return "Admin";
  if (role === "financeiro") return "Financeiro";
  if (role === "operador") return "Operador";
  return "Suporte";
}

export default function PeoplePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const [periodFilter, setPeriodFilter] = useState<"today" | "7d" | "30d">("7d");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativo" | "atencao" | "inativo">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "operador" | "financeiro">("all");
  const [loadFilter, setLoadFilter] = useState<"all" | "alta" | "media" | "baixa">("all");
  const [delayFilter, setDelayFilter] = useState<"all" | "com-atraso">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "alto-risco">("all");
  const [searchValue, setSearchValue] = useState("");

  const canLoadPeople = isAuthenticated;

  const listPeople = trpc.people.list.useQuery(undefined, {
    enabled: canLoadPeople,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const statsLinked = trpc.people.statsLinked.useQuery(undefined, {
    enabled: canLoadPeople,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 200 },
    { enabled: canLoadPeople, retry: false, refetchOnWindowFocus: false }
  );
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    enabled: canLoadPeople,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 200 },
    { enabled: canLoadPeople, retry: false, refetchOnWindowFocus: false }
  );
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery(
    { limit: 120 },
    { enabled: canLoadPeople, retry: false, refetchOnWindowFocus: false }
  );

  const people = useMemo(() => toArray<PersonItem>(listPeople.data), [listPeople.data]);
  const linkedStats = useMemo(
    () => normalizeObjectPayload<LinkedStatsResponse>(statsLinked.data),
    [statsLinked.data]
  );
  const serviceOrders = useMemo(() => {
    const payload = normalizeObjectPayload<any>(serviceOrdersQuery.data) ?? {};
    return toArray<Record<string, unknown>>(payload.data ?? payload.items ?? serviceOrdersQuery.data ?? []);
  }, [serviceOrdersQuery.data]);
  const appointments = useMemo(() => toArray<Record<string, unknown>>(appointmentsQuery.data), [appointmentsQuery.data]);
  const charges = useMemo(() => {
    const payload = normalizeObjectPayload<any>(chargesQuery.data) ?? {};
    return toArray<Record<string, unknown>>(payload.data ?? payload.items ?? chargesQuery.data ?? []);
  }, [chargesQuery.data]);
  const timelineEvents = useMemo(() => toArray<Record<string, unknown>>(timelineQuery.data), [timelineQuery.data]);

  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const periodStart = useMemo(() => {
    const start = new Date(dayStart);
    if (periodFilter === "today") return start;
    if (periodFilter === "7d") start.setDate(start.getDate() - 7);
    if (periodFilter === "30d") start.setDate(start.getDate() - 30);
    return start;
  }, [dayStart, periodFilter]);

  const rows = useMemo<NormalizedPersonRow[]>(() => {
    return people.map(person => {
      const role = normalizeRole(person.role);
      const assignedOrders = serviceOrders.filter(order => {
        const assignedId = String(order.assignedToPersonId ?? order.personId ?? "");
        return assignedId && assignedId === person.id;
      });
      const pendingOrders = assignedOrders.filter(order => !isServiceOrderClosed(order.status));
      const delayedOrders = pendingOrders.filter(order => {
        const dueDate = getDateCandidate(order, ["dueDate", "deadline", "scheduledTo", "updatedAt"]);
        return dueDate ? dueDate.getTime() < Date.now() : false;
      });
      const personAppointmentsToday = appointments.filter(item => {
        const personId = String(item.assignedToPersonId ?? item.personId ?? "");
        const date = getDateCandidate(item, ["startAt", "startsAt", "scheduledTo", "date"]);
        if (!date) return false;
        return personId === person.id && date >= dayStart && date < new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      }).length;
      const relatedEvents = timelineEvents.filter(event => {
        const eventPersonId = String(event.personId ?? event.actorPersonId ?? event.actorId ?? "");
        const eventPersonName = String(event.personName ?? event.actorName ?? "").toLowerCase();
        return eventPersonId === person.id || (!!person.name && eventPersonName.includes(person.name.toLowerCase()));
      });

      const recentEvents = relatedEvents.filter(event => {
        const createdAt = getDateCandidate(event, ["createdAt", "occurredAt", "timestamp"]);
        return createdAt ? createdAt >= periodStart : false;
      });

      const activityDate = getDateCandidate(person as unknown as Record<string, unknown>, ["updatedAt"]) ??
        getDateCandidate(recentEvents[0] ?? {}, ["createdAt", "occurredAt"]);

      const workload = pendingOrders.length + personAppointmentsToday;
      const isInactive = workload === 0 && recentEvents.length === 0;
      const performanceLabel = delayedOrders.length >= 3 ? "Pressionado" : delayedOrders.length > 0 ? "Oscilando" : "Estável";
      const riskLevel: NormalizedPersonRow["riskLevel"] =
        workload >= 8 || delayedOrders.length >= 3 ? "alto" :
        workload >= 5 || delayedOrders.length > 0 ? "medio" : "baixo";

      let statusLabel = "Ativo";
      let statusTone: NormalizedPersonRow["statusTone"] = "success";
      if (!person.active || person.operationalState === "SUSPENDED" || person.operationalState === "RESTRICTED") {
        statusLabel = "Restrito";
        statusTone = "danger";
      } else if (riskLevel === "alto" || delayedOrders.length > 0 || person.operationalState === "WARNING") {
        statusLabel = "Atenção";
        statusTone = "warning";
      } else if (isInactive) {
        statusLabel = "Sem atividade";
        statusTone = "neutral";
      }

      return {
        id: person.id,
        name: person.name,
        email: person.email ?? "Sem e-mail",
        role,
        roleLabel: roleLabel(role),
        statusLabel,
        statusTone,
        workload,
        assignedServiceOrders: assignedOrders.length,
        pendingServiceOrders: pendingOrders.length,
        appointmentsToday: personAppointmentsToday,
        delays: delayedOrders.length,
        riskLevel,
        performanceLabel,
        lastActivityLabel: activityDate ? activityDate.toLocaleString("pt-BR") : "Sem atividade recente",
        isInactive,
        governanceSummary:
          riskLevel === "alto"
            ? "Risco operacional alto: pede redistribuição e monitoramento da governança."
            : riskLevel === "medio"
              ? "Risco moderado: acompanhar execução para evitar escalada."
              : "Ritmo controlado no período selecionado.",
      };
    });
  }, [appointments, dayStart, periodStart, people, serviceOrders, timelineEvents]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return rows.filter(row => {
      if (statusFilter === "ativo" && row.statusLabel !== "Ativo") return false;
      if (statusFilter === "atencao" && row.statusLabel !== "Atenção") return false;
      if (statusFilter === "inativo" && !row.isInactive) return false;
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (loadFilter === "alta" && row.workload < 8) return false;
      if (loadFilter === "media" && (row.workload < 4 || row.workload >= 8)) return false;
      if (loadFilter === "baixa" && row.workload >= 4) return false;
      if (delayFilter === "com-atraso" && row.delays === 0) return false;
      if (riskFilter === "alto-risco" && row.riskLevel !== "alto") return false;
      if (!query) return true;
      return [row.name, row.email].join(" ").toLowerCase().includes(query);
    });
  }, [delayFilter, loadFilter, riskFilter, roleFilter, rows, searchValue, statusFilter]);

  const sortedByPriority = useMemo(
    () => [...filteredRows].sort((a, b) => (b.riskLevel === "alto" ? 3 : b.riskLevel === "medio" ? 2 : 1) - (a.riskLevel === "alto" ? 3 : a.riskLevel === "medio" ? 2 : 1) || b.workload - a.workload),
    [filteredRows]
  );

  const selectedPerson = useMemo(
    () => sortedByPriority.find(item => item.id === selectedPersonId) ?? sortedByPriority[0] ?? null,
    [selectedPersonId, sortedByPriority]
  );

  const teamSummary = useMemo(() => {
    const active = rows.filter(row => row.statusLabel === "Ativo").length;
    const overloaded = rows.filter(row => row.workload >= 8).length;
    const delayed = rows.filter(row => row.delays > 0).length;
    const unassignedOrders = serviceOrders.filter(order => !order.assignedToPersonId && !order.personId).length;
    const riskHigh = rows.filter(row => row.riskLevel === "alto").length;
    const responsibility = rows.length
      ? `${rows.filter(row => row.pendingServiceOrders > 0).length}/${rows.length} pessoas com responsabilidade ativa`
      : "Sem pessoas ativas";

    return { active, overloaded, delayed, unassignedOrders, riskHigh, responsibility };
  }, [rows, serviceOrders]);

  const teamAlerts = useMemo(() => {
    const alerts: Array<{ id: string; label: string; detail: string; actionLabel: string; actionPath: string }> = [];

    if (teamSummary.overloaded > 0) {
      alerts.push({
        id: "overload",
        label: "Equipe com excesso de O.S.",
        detail: `${teamSummary.overloaded} pessoa(s) com carga alta no período.`,
        actionLabel: "Redistribuir O.S.",
        actionPath: "/service-orders?status=open",
      });
    }
    if (teamSummary.delayed > 0) {
      alerts.push({
        id: "delays",
        label: "Atrasos recorrentes detectados",
        detail: `${teamSummary.delayed} pessoa(s) com atraso ativo nas entregas.`,
        actionLabel: "Ver atrasos",
        actionPath: "/timeline?module=service_order&severity=high",
      });
    }
    const inactivePeople = rows.filter(row => row.isInactive).length;
    if (inactivePeople > 0) {
      alerts.push({
        id: "inactive",
        label: "Pessoa sem atividade recente",
        detail: `${inactivePeople} integrante(s) sem atividade no período selecionado.`,
        actionLabel: "Abrir agendamentos",
        actionPath: "/appointments",
      });
    }
    if (teamSummary.unassignedOrders > 0) {
      alerts.push({
        id: "unassigned",
        label: "Tarefas sem responsável",
        detail: `${teamSummary.unassignedOrders} O.S. sem dono direto agora.`,
        actionLabel: "Assumir responsáveis",
        actionPath: "/service-orders?responsible=unassigned",
      });
    }
    if (rows.length > 0) {
      const max = Math.max(...rows.map(row => row.workload));
      const min = Math.min(...rows.map(row => row.workload));
      if (max - min >= 6) {
        alerts.push({
          id: "imbalance",
          label: "Distribuição desequilibrada",
          detail: `Diferença de carga de ${max - min} itens entre extremos da equipe.`,
          actionLabel: "Balancear equipe",
          actionPath: "/governance?focus=workload",
        });
      }
    }

    return alerts.slice(0, 5);
  }, [rows, teamSummary.delayed, teamSummary.overloaded, teamSummary.unassignedOrders]);

  const personTimeline = useMemo(() => {
    if (!selectedPerson) return [];
    return timelineEvents
      .filter(event => {
        const eventPersonId = String(event.personId ?? event.actorPersonId ?? event.actorId ?? "");
        const eventPersonName = String(event.personName ?? event.actorName ?? "").toLowerCase();
        return eventPersonId === selectedPerson.id || eventPersonName.includes(selectedPerson.name.toLowerCase());
      })
      .slice(0, 6)
      .map((event, index) => ({
        id: String(event.id ?? `${selectedPerson.id}-${index}`),
        title: String(event.action ?? event.type ?? "Ação operacional"),
        description: String(event.description ?? event.summary ?? "Evento sem descrição detalhada."),
        when: getDateCandidate(event, ["createdAt", "occurredAt", "timestamp"])?.toLocaleString("pt-BR") ?? "Sem horário",
        module: String(event.module ?? event.entityType ?? "Operação"),
      }));
  }, [selectedPerson, timelineEvents]);

  const refetchAll = () => {
    void Promise.all([
      listPeople.refetch(),
      statsLinked.refetch(),
      serviceOrdersQuery.refetch(),
      appointmentsQuery.refetch(),
      chargesQuery.refetch(),
      timelineQuery.refetch(),
    ]);
  };

  const isInitialLoading =
    listPeople.isLoading ||
    statsLinked.isLoading ||
    serviceOrdersQuery.isLoading ||
    appointmentsQuery.isLoading ||
    chargesQuery.isLoading ||
    timelineQuery.isLoading;

  const hasBlockingError =
    Boolean(listPeople.error) &&
    Boolean(statsLinked.error) &&
    Boolean(serviceOrdersQuery.error) &&
    Boolean(appointmentsQuery.error) &&
    Boolean(chargesQuery.error) &&
    Boolean(timelineQuery.error);

  const errorMessage =
    listPeople.error?.message ||
    statsLinked.error?.message ||
    serviceOrdersQuery.error?.message ||
    appointmentsQuery.error?.message ||
    chargesQuery.error?.message ||
    timelineQuery.error?.message ||
    "Não foi possível carregar a visão operacional de pessoas.";

  if (isInitializing) {
    return (
      <PageWrapper title="Pessoas" subtitle="Carregando contexto de sessão para responsabilidade operacional.">
        <AppPageShell>
          <AppPageLoadingState description="Conectando sessão e permissões de acesso da equipe." />
        </AppPageShell>
      </PageWrapper>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Pessoas" subtitle="Sessão necessária para supervisionar a operação.">
        <AppPageShell>
          <AppPageErrorState
            title="Acesso necessário"
            description="Faça login para abrir a camada de responsabilidade, carga e intervenção da equipe."
            actionLabel="Ir para login"
            onAction={() => navigate("/login")}
          />
        </AppPageShell>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Pessoas" subtitle="Responsabilidade, carga, desempenho e intervenção da equipe em tempo real.">
      <AppPageShell>
        <AppPageHeader
        title="Pessoas"
        description={`Responsabilidade operacional visível por pessoa e equipe · Período: ${periodFilter === "today" ? "Hoje" : periodFilter === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"} · ${rows.length} pessoas no radar`}
        secondaryActions={
          <Button type="button" variant="outline" onClick={() => navigate("/governance?focus=people")}>Governança</Button>
        }
        cta={<Button type="button" onClick={() => setIsCreateOpen(true)}>Nova pessoa</Button>}
      />

      <OperationalTopCard
        contextLabel="Leitura executiva da equipe"
        title={teamAlerts[0]?.label ?? "Equipe operacional em monitoramento"}
        description={teamAlerts[0]?.detail ?? "Responsabilidades distribuídas e sem gargalo crítico imediato."}
        chips={
          <>
            <AppStatusBadge label={`${teamSummary.active} pessoas ativas`} />
            <AppStatusBadge label={`${teamSummary.overloaded} com sobrecarga`} />
          </>
        }
        primaryAction={<Button type="button" onClick={() => navigate(teamAlerts[0]?.actionPath ?? "/service-orders")}>{teamAlerts[0]?.actionLabel ?? "Abrir O.S."}</Button>}
        secondaryActions={<Button type="button" variant="outline" onClick={() => navigate("/timeline?module=service_order")}>Ver timeline operacional</Button>}
      />

      <AppToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodFilter}
            onChange={event => setPeriodFilter(event.target.value as typeof periodFilter)}
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm"
          >
            <option value="today">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/service-orders?status=open")}>Intervir em O.S.</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/appointments")}>Abrir agenda</Button>
          <AppStatusBadge label={`Equipe ativa: ${teamSummary.active}`} />
          <AppStatusBadge label={`Risco alto: ${teamSummary.riskHigh}`} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refetchAll}>Atualizar leitura</Button>
      </AppToolbar>

      {isInitialLoading ? <AppPageLoadingState description="Consolidando carga, desempenho, financeiro e timeline por pessoa..." /> : null}
      {hasBlockingError ? (
        <AppPageErrorState description={errorMessage} onAction={refetchAll} />
      ) : null}

      {!isInitialLoading && !hasBlockingError ? (
        <>
          {rows.length === 0 ? (
            <AppPageEmptyState
              title="Equipe sem pessoas operacionais"
              description="Cadastre ao menos uma pessoa para distribuir responsabilidade, carga e intervenção no fluxo real."
            />
          ) : (
            <>
              <AppSectionBlock title="1) Visão de equipe · leitura executiva" subtitle="Saúde do time em segundos: sobrecarga, falhas, distribuição e próxima ação.">
                <div className="grid gap-3 xl:grid-cols-5">
                  <AppStatCard label="Equipe ativa" value={`${teamSummary.active}`} helper="Pessoas em execução operacional." />
                  <AppStatCard label="Sobrecarga" value={`${teamSummary.overloaded}`} helper="Colaboradores com carga acima do limite." />
                  <AppStatCard label="Atraso/Falha" value={`${teamSummary.delayed}`} helper="Pessoas com atraso recorrente no período." />
                  <AppStatCard label="Responsabilidade" value={teamSummary.responsibility} helper="Distribuição atual de donos da execução." />
                  <AppStatCard
                    label="Próxima ação"
                    value={teamAlerts[0]?.label ?? "Operação estável"}
                    helper={teamAlerts[0]?.detail ?? "Sem intervenção urgente no momento."}
                  />
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {teamAlerts.length > 0 ? teamAlerts.map(alert => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => navigate(alert.actionPath)}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-left transition hover:border-[var(--border-emphasis)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{alert.label}</p>
                        <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{alert.detail}</p>
                      <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)]">
                        {alert.actionLabel} <ArrowRight className="h-3 w-3" />
                      </p>
                    </button>
                  )) : (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-sm text-[var(--text-secondary)]">
                      Nenhum alerta crítico agora. Mantenha monitoramento ativo.
                    </div>
                  )}
                </div>
              </AppSectionBlock>

              <AppSectionBlock title="2) Lista operacional de pessoas" subtitle="Quem faz o quê, quem está travando e onde agir sem abrir detalhe.">
                <div className="mb-3 grid gap-2 md:grid-cols-3 xl:grid-cols-7">
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm">
                    <option value="all">Status: todos</option>
                    <option value="ativo">Status: ativos</option>
                    <option value="atencao">Status: atenção</option>
                    <option value="inativo">Status: inativos</option>
                  </select>
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as typeof roleFilter)} className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm">
                    <option value="all">Função: todas</option>
                    <option value="admin">Admin</option>
                    <option value="operador">Operador</option>
                    <option value="financeiro">Financeiro</option>
                  </select>
                  <select value={loadFilter} onChange={e => setLoadFilter(e.target.value as typeof loadFilter)} className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm">
                    <option value="all">Carga: todas</option>
                    <option value="alta">Carga alta</option>
                    <option value="media">Carga média</option>
                    <option value="baixa">Carga baixa</option>
                  </select>
                  <select value={delayFilter} onChange={e => setDelayFilter(e.target.value as typeof delayFilter)} className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm">
                    <option value="all">Atraso: todos</option>
                    <option value="com-atraso">Com atraso</option>
                  </select>
                  <select value={riskFilter} onChange={e => setRiskFilter(e.target.value as typeof riskFilter)} className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm">
                    <option value="all">Risco: todos</option>
                    <option value="alto-risco">Alto risco</option>
                  </select>
                  <input
                    value={searchValue}
                    onChange={event => setSearchValue(event.target.value)}
                    placeholder="Buscar nome ou e-mail"
                    className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    setStatusFilter("all");
                    setRoleFilter("all");
                    setLoadFilter("all");
                    setDelayFilter("all");
                    setRiskFilter("all");
                    setSearchValue("");
                  }}>Limpar filtros</Button>
                </div>

                {sortedByPriority.length === 0 ? (
                  <AppPageEmptyState
                    title="Nenhuma pessoa encontrada"
                    description="Ajuste os filtros para enxergar responsáveis e agir sobre carga, atraso e risco."
                  />
                ) : (
                  <AppDataTable>
                    <table className="w-full min-w-[1040px] text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          <th className="px-3 py-2">Pessoa</th>
                          <th className="px-3 py-2">Função / status</th>
                          <th className="px-3 py-2">Carga atual</th>
                          <th className="px-3 py-2">Atraso / risco</th>
                          <th className="px-3 py-2">Última atividade</th>
                          <th className="px-3 py-2">Responsabilidade</th>
                          <th className="px-3 py-2">Ações inline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedByPriority.map(row => (
                          <tr key={row.id} className="border-b border-[var(--border-subtle)]/60 align-top">
                            <td className="px-3 py-2 text-[var(--text-primary)]">
                              <p className="font-medium">{row.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{row.email}</p>
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-sm text-[var(--text-secondary)]">{row.roleLabel}</p>
                              <AppStatusBadge label={row.statusLabel} />
                            </td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">
                              <p>{row.workload} itens ativos</p>
                              <p className="text-xs text-[var(--text-muted)]">{row.pendingServiceOrders} O.S. pendentes · {row.appointmentsToday} agendamentos hoje</p>
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-sm text-[var(--text-secondary)]">{row.delays} atraso(s)</p>
                              <AppStatusBadge label={`Risco ${row.riskLevel}`} />
                            </td>
                            <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{row.lastActivityLabel}</td>
                            <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{row.governanceSummary}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1.5">
                                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPersonId(row.id)}>Ver detalhe</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/service-orders?assignTo=${row.id}`)}>Atribuir</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => setEditingPersonId(row.id)}>Status</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/governance?personId=${row.id}`)}>Permissão</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/timeline?personId=${row.id}`)}>Itens</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AppDataTable>
                )}
              </AppSectionBlock>

              <AppSectionBlock title="3) Detalhe da pessoa" subtitle="Execução, desempenho, impacto financeiro e intervenção direta por responsável.">
                {selectedPerson ? (
                  <div className="grid gap-3 xl:grid-cols-12">
                    <div className="space-y-3 xl:col-span-4">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-base font-semibold text-[var(--text-primary)]">{selectedPerson.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{selectedPerson.roleLabel} · {selectedPerson.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AppStatusBadge label={selectedPerson.statusLabel} />
                          <AppStatusBadge label={`Acesso ${selectedPerson.roleLabel}`} />
                        </div>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">Última atividade: {selectedPerson.lastActivityLabel}</p>
                      </div>

                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Execução</p>
                        <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                          <li>O.S. atribuídas: {selectedPerson.assignedServiceOrders}</li>
                          <li>Agendamentos do dia: {selectedPerson.appointmentsToday}</li>
                          <li>Tarefas pendentes: {selectedPerson.pendingServiceOrders}</li>
                          <li>Carga atual consolidada: {selectedPerson.workload}</li>
                        </ul>
                      </div>

                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Performance</p>
                        <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                          <li>O.S. concluídas (estimada): {Math.max(0, selectedPerson.assignedServiceOrders - selectedPerson.pendingServiceOrders)}</li>
                          <li>Atrasos: {selectedPerson.delays}</li>
                          <li>Tempo médio: {selectedPerson.riskLevel === "alto" ? "Acima do esperado" : "Dentro da meta"}</li>
                          <li>Falhas/sinal de risco: {selectedPerson.riskLevel === "alto" ? "Alto" : selectedPerson.riskLevel === "medio" ? "Moderado" : "Baixo"}</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-3 xl:col-span-4">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Impacto financeiro indireto</p>
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">
                          Serviços gerados (estimado por O.S.): {selectedPerson.assignedServiceOrders} · Valor movimentado relacionado: R$ {(
                            charges.filter(charge => {
                              const personName = String(charge.personName ?? charge.assignedToName ?? "").toLowerCase();
                              return personName.includes(selectedPerson.name.toLowerCase());
                            }).reduce((acc, item) => acc + Number(item.amount ?? item.value ?? 0), 0)
                          ).toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Conecta execução diária com efeito financeiro do responsável.</p>
                      </div>

                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Acesso e permissão</p>
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">Função: {selectedPerson.roleLabel}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Estado de acesso: {selectedPerson.statusLabel}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingPersonId(selectedPerson.id)}>Ajustar permissão</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/governance?personId=${selectedPerson.id}`)}>Ver risco</Button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Navegação cruzada</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/service-orders?personId=${selectedPerson.id}`)}>O.S.</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/appointments?personId=${selectedPerson.id}`)}>Agendamentos</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/finances?personId=${selectedPerson.id}`)}>Financeiro</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/timeline?personId=${selectedPerson.id}`)}>Timeline</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/governance?personId=${selectedPerson.id}`)}>Governança</Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 xl:col-span-4">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Timeline operacional da pessoa</p>
                        {personTimeline.length > 0 ? (
                          <AppTimeline className="mt-2">
                            {personTimeline.map(item => (
                              <AppTimelineItem key={item.id}>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                                <p className="text-xs text-[var(--text-secondary)]">{item.description}</p>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                                  <span>{item.module}</span>
                                  <span>{item.when}</span>
                                </div>
                              </AppTimelineItem>
                            ))}
                          </AppTimeline>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">Sem eventos recentes para esta pessoa no período atual.</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-xs text-[var(--text-secondary)]">
                        Estrutura pronta para evolução em workspace lateral: o estado selecionado da pessoa já concentra execução, performance,
                        impacto financeiro, timeline e gatilhos de intervenção para automações futuras (distribuição automática, alerta de sobrecarga,
                        risco e governança).
                      </div>
                    </div>
                  </div>
                ) : (
                  <AppPageEmptyState
                    title="Selecione uma pessoa"
                    description="Abra o detalhe para enxergar dono, carga, desempenho e impacto operacional em um único workspace."
                  />
                )}
              </AppSectionBlock>
            </>
          )}
        </>
      ) : null}

      <CreatePersonModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => {
          setIsCreateOpen(false);
          refetchAll();
        }}
      />

      <EditPersonModal
        open={Boolean(editingPersonId)}
        personId={editingPersonId}
        onClose={() => setEditingPersonId(null)}
        onSaved={() => {
          setEditingPersonId(null);
          refetchAll();
        }}
      />
      </AppPageShell>
    </PageWrapper>
  );
}
