import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import {
  resolveOperationalActionLabel,
  toSingleLineAction,
} from "@/lib/operations/operational-list";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { Button, SecondaryButton } from "@/components/design-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { AppOperationalModal } from "@/components/operating-system/AppOperationalModal";
import {
  EmptyActionState,
  OperationalAutomationNote,
  OperationalFlowState,
  OperationalInlineFeedback,
  OperationalNextAction,
  OperationalRelationSummary,
} from "@/components/operating-system/OperationalRefinementBlocks";
import { AppRowActionsDropdown, AppCheckbox } from "@/components/app-system";
import {
  AppOperationalBar,
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
  appSelectionPillClasses,
} from "@/components/internal-page-system";

type CustomerRecord = Record<string, any>;
type ChargeRecord = Record<string, any>;

type ContactState = "responded" | "pending" | "no_response";
type OperationalStatus = "Seguro" | "Atenção" | "Em risco" | "Sem cobrança";
type OperationalFilter =
  | "all"
  | "risk"
  | "billing"
  | "no_response"
  | "no_schedule"
  | "healthy";
type OperationalSort = "priority" | "financial" | "last_interaction" | "name";
type CustomerOperationalSnapshot = {
  customerId: string;
  status: OperationalStatus;
  contextLabel: string;
  nextActionReason: string;
  contactState: ContactState;
  contactLabel: string;
  contactDays: number;
  hasFutureSchedule: boolean;
  overdueCharges: number;
  pendingCharges: number;
  reactivationPotential: boolean;
  primaryActionLabel: string;
  primaryActionReason: string;
  primaryActionUrgency?: string;
  primaryActionImpact?: string;
  financialPendingCents: number;
  financialPotentialCents: number;
  latestChargeCents: number;
  lastInteractionDays: number;
  behaviorLabel: "Responde rápido" | "Responde lento" | "Baixa interação";
  segmentTag: "Carteira ativa" | "Cobrança crítica" | "Reativação";
  priorityScore: number;
};

function hashSeed(value: string) {
  return value
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function contactLabelFromState(state: ContactState, days: number) {
  if (state === "responded") return "Respondeu";
  if (state === "pending")
    return `Pendente há ${days} dia${days === 1 ? "" : "s"}`;
  return `Sem resposta há ${days} dias`;
}

function normalizeWorkspace(input: unknown) {
  return (normalizeObjectPayload<any>(input) ?? {}) as Record<string, any>;
}

function listFrom(input: unknown) {
  return normalizeArrayPayload<any>(input);
}

function getContactUrgencyLabel(days: number, state: ContactState) {
  if (state === "responded") return "Seguro";
  if (days >= 5) return "Urgente";
  if (days >= 3) return "Atenção";
  return "Pendente";
}

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [activeFilter, setActiveFilter] = useOperationalMemoryState<OperationalFilter>(
    "nexo.customers.filter.v1",
    "all"
  );
  const [activeSort, setActiveSort] = useOperationalMemoryState<OperationalSort>(
    "nexo.customers.sort.v1",
    "priority"
  );
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [timelineExpanded, setTimelineExpanded] = useOperationalMemoryState(
    "nexo.customers.timeline-expanded.v1",
    false
  );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState(
    "nexo.customers.search.v1",
    ""
  );
  const [openAppointmentCreate, setOpenAppointmentCreate] = useState(false);
  const [openServiceOrderCreate, setOpenServiceOrderCreate] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionFeedbackTone, setActionFeedbackTone] = useState<
    "neutral" | "success" | "error"
  >("neutral");
  const [isProcessingPrimaryAction, setIsProcessingPrimaryAction] = useState(false);
  const [activeTab, setActiveTab] = useOperationalMemoryState<
    "overview" | "agenda" | "service_orders" | "financial" | "history"
  >("nexo.customers.tab.v1", "overview");

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 200 },
    { retry: false }
  );

  const customers = useMemo(
    () => normalizeArrayPayload<CustomerRecord>(customersQuery.data),
    [customersQuery.data]
  );
  const people = useMemo(
    () => normalizeArrayPayload<any>(peopleQuery.data),
    [peopleQuery.data]
  );
  const charges = useMemo(
    () => normalizeArrayPayload<ChargeRecord>(chargesQuery.data),
    [chargesQuery.data]
  );
  const hasData = customers.length > 0;
  const showInitialLoading = customersQuery.isLoading && !hasData;
  const showErrorState = customersQuery.error && !hasData;

  usePageDiagnostics({
    page: "customers",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty: !showInitialLoading && !showErrorState && customers.length === 0,
    dataCount: customers.length,
  });

  const chargeByCustomerId = useMemo(() => {
    const map = new Map<
      string,
      {
        overdue: number;
        pending: number;
        total: number;
        latestChargeCents: number;
        maxPendingCents: number;
      }
    >();

    charges.forEach(charge => {
      const customerId = String(charge?.customerId ?? "");
      if (!customerId) return;
      const amountCents = Number(charge?.amountCents ?? 0);
      const status = String(charge?.status ?? "").toUpperCase();
      const current = map.get(customerId) ?? {
        overdue: 0,
        pending: 0,
        total: 0,
        latestChargeCents: 0,
        maxPendingCents: 0,
      };
      current.total += 1;
      current.latestChargeCents = Math.max(
        current.latestChargeCents,
        amountCents
      );
      if (status === "OVERDUE") {
        current.overdue += 1;
        current.maxPendingCents += Math.max(amountCents, 15000);
      }
      if (status === "PENDING") {
        current.pending += 1;
        current.maxPendingCents += Math.max(amountCents, 10000);
      }
      map.set(customerId, current);
    });

    return map;
  }, [charges]);

  const operationalSnapshots = useMemo<CustomerOperationalSnapshot[]>(() => {
    return customers.map((customer, index) => {
      const customerId = String(customer?.id ?? `customer-${index}`);
      const seed = hashSeed(`${customerId}-${customer?.email ?? ""}-${index}`);
      const chargeStats = chargeByCustomerId.get(customerId) ?? {
        overdue: 0,
        pending: 0,
        total: 0,
        latestChargeCents: 0,
        maxPendingCents: 0,
      };

      const overdueCharges = chargeStats.overdue;
      const pendingCharges = chargeStats.pending;
      const hasAnyCharge = chargeStats.total > 0;
      const hasFutureSchedule = seed % 5 !== 0;
      const contactDays = overdueCharges > 0 ? 5 + (seed % 3) : 1 + (seed % 5);
      const contactState: ContactState =
        overdueCharges > 0
          ? "no_response"
          : contactDays >= 4
            ? "pending"
            : "responded";
      const reactivationPotential =
        !hasFutureSchedule && contactDays >= 3 && overdueCharges === 0;
      const lastInteractionDays =
        contactState === "responded"
          ? Math.max(1, contactDays - 1)
          : contactDays;

      const financialPendingCents =
        chargeStats.maxPendingCents || Math.max((seed % 8) * 25000, 8000);
      const financialPotentialCents =
        financialPendingCents + Math.max((seed % 10) * 40000, 16000);
      const latestChargeCents =
        chargeStats.latestChargeCents || Math.max((seed % 6) * 20000, 12000);

      const behaviorLabel =
        ((): CustomerOperationalSnapshot["behaviorLabel"] => {
          if (contactState === "responded") return "Responde rápido";
          if (contactDays >= 5) return "Baixa interação";
          return "Responde lento";
        })();
      const segmentTag: CustomerOperationalSnapshot["segmentTag"] =
        overdueCharges > 0
          ? "Cobrança crítica"
          : !hasFutureSchedule || contactState !== "responded"
            ? "Reativação"
            : "Carteira ativa";

      let status: OperationalStatus = "Seguro";
      let contextLabel = "Fluxo operacional seguro";
      let primaryActionLabel = "Abrir detalhe operacional";
      let primaryActionReason = "Cliente em situação estável com fluxo contínuo.";
      let primaryActionUrgency: string | undefined;
      let primaryActionImpact = "Manter previsibilidade operacional";
      let nextActionReason = "Manter ritmo com revisão rápida do histórico";

      if (overdueCharges > 0) {
        status = "Em risco";
        contextLabel = "Cobrança vencida";
        primaryActionLabel = `Cobrar hoje — ${overdueCharges} vencida(s)`;
        primaryActionReason =
          "O cliente já concluiu etapas e ainda possui cobrança vencida.";
        primaryActionUrgency = `Urgente · atraso de ${contactDays} dias`;
        primaryActionImpact = formatMoney(financialPendingCents);
        nextActionReason = "Cobrança vencida com impacto direto no caixa";
      } else if (!hasFutureSchedule) {
        status = "Atenção";
        contextLabel = "Sem agendamento futuro";
        primaryActionLabel = "Criar agendamento — sem agenda futura";
        primaryActionReason =
          "Sem próxima visita agendada, com risco de perder continuidade.";
        primaryActionUrgency = "Ação hoje para proteger recorrência";
        primaryActionImpact = "Reduz risco de inatividade";
        nextActionReason = "Sem agenda futura e risco de quebra do fluxo";
      } else if (contactState !== "responded") {
        status = "Atenção";
        contextLabel = `Sem resposta há ${contactDays} dias`;
        primaryActionLabel = `Confirmar agora — sem resposta há ${contactDays} dias`;
        primaryActionReason =
          "Agendamento futuro existe, mas sem confirmação recente do cliente.";
        primaryActionUrgency =
          contactDays >= 5 ? "Urgente · risco de no-show" : "Atenção";
        primaryActionImpact = "Evita falta e retrabalho";
        nextActionReason = "Reengajar comunicação para manter continuidade";
      } else if (!hasAnyCharge) {
        status = "Sem cobrança";
        contextLabel = "Sem cobrança ativa";
        primaryActionLabel = "Gerar cobrança — fluxo financeiro incompleto";
        primaryActionReason =
          "Operação está ativa, porém sem camada financeira vinculada.";
        primaryActionImpact = "Transformar execução em receita";
        nextActionReason = "Fluxo sem camada financeira ativa";
      }

      const priorityScore =
        overdueCharges * 100 +
        (contactState === "no_response"
          ? 45
          : contactState === "pending"
            ? 25
            : 5) +
        (!hasFutureSchedule ? 30 : 0) +
        Math.round(financialPendingCents / 10000);

      return {
        customerId,
        status,
        contextLabel,
        nextActionReason,
        contactState,
        contactLabel: contactLabelFromState(contactState, contactDays),
        contactDays,
        hasFutureSchedule,
        overdueCharges,
        pendingCharges,
        reactivationPotential,
        primaryActionLabel,
        primaryActionReason,
        primaryActionUrgency,
        primaryActionImpact,
        financialPendingCents,
        financialPotentialCents,
        latestChargeCents,
        lastInteractionDays,
        behaviorLabel,
        segmentTag,
        priorityScore,
      };
    });
  }, [chargeByCustomerId, customers]);

  const snapshotByCustomerId = useMemo(
    () => new Map(operationalSnapshots.map(item => [item.customerId, item])),
    [operationalSnapshots]
  );

  const overdueCustomers = operationalSnapshots.filter(
    item => item.overdueCharges > 0
  ).length;
  const withoutFutureSchedule = operationalSnapshots.filter(
    item => !item.hasFutureSchedule
  ).length;

  const displayedCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = customers.filter(customer => {
      const customerId = String(customer?.id ?? "");
      const snapshot = snapshotByCustomerId.get(customerId);
      if (!snapshot) return false;

      if (activeTab === "agenda" && snapshot.hasFutureSchedule) return false;
      if (
        activeTab === "service_orders" &&
        !snapshot.primaryActionLabel.includes("detalhe") &&
        !snapshot.primaryActionLabel.includes("Confirmar")
      ) {
        return false;
      }
      if (
        activeTab === "financial" &&
        !(snapshot.overdueCharges > 0 || snapshot.pendingCharges > 0)
      ) {
        return false;
      }
      if (activeTab === "history" && snapshot.lastInteractionDays < 2)
        return false;

      if (activeFilter === "risk" && snapshot.status !== "Em risco")
        return false;
      if (
        activeFilter === "billing" &&
        !(snapshot.overdueCharges > 0 || snapshot.pendingCharges > 0)
      )
        return false;
      if (
        activeFilter === "no_response" &&
        snapshot.contactState === "responded"
      )
        return false;
      if (activeFilter === "no_schedule" && snapshot.hasFutureSchedule)
        return false;
      if (activeFilter === "healthy" && snapshot.status !== "Seguro")
        return false;

      if (!normalizedSearch) return true;

      const haystack = [
        String(customer?.name ?? ""),
        String(customer?.phone ?? ""),
        String(customer?.email ?? ""),
        customerId,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    return [...filtered].sort((left, right) => {
      const leftSnapshot = snapshotByCustomerId.get(String(left?.id ?? ""));
      const rightSnapshot = snapshotByCustomerId.get(String(right?.id ?? ""));
      if (!leftSnapshot || !rightSnapshot) return 0;

      if (activeSort === "financial")
        return (
          rightSnapshot.financialPendingCents -
          leftSnapshot.financialPendingCents
        );
      if (activeSort === "last_interaction")
        return (
          rightSnapshot.lastInteractionDays - leftSnapshot.lastInteractionDays
        );
      if (activeSort === "name")
        return String(left?.name ?? "").localeCompare(
          String(right?.name ?? ""),
          "pt-BR"
        );
      return rightSnapshot.priorityScore - leftSnapshot.priorityScore;
    });
  }, [
    activeFilter,
    activeSort,
    activeTab,
    customers,
    searchTerm,
    snapshotByCustomerId,
  ]);

  const allDisplayedSelected =
    displayedCustomers.length > 0 &&
    displayedCustomers.every(customer =>
      selectedCustomerIds.includes(String(customer?.id ?? ""))
    );

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: selectedCustomer?.id ?? "" },
    { enabled: Boolean(selectedCustomer?.id), retry: false }
  );

  const workspace = useMemo(
    () => normalizeWorkspace(workspaceQuery.data),
    [workspaceQuery.data]
  );
  const workspaceCustomer = normalizeWorkspace(workspace.customer);
  const workspaceAppointments = listFrom(
    workspace.appointments ?? workspace.customerAppointments
  );
  const workspaceServiceOrders = listFrom(
    workspace.serviceOrders ?? workspace.orders
  );
  const workspaceCharges = listFrom(workspace.charges ?? workspace.finance);
  const workspaceTimeline = listFrom(workspace.timeline ?? workspace.events);
  const visibleTimeline = timelineExpanded
    ? workspaceTimeline.slice(0, 8)
    : workspaceTimeline.slice(0, 3);
  const workspaceMessages = listFrom(
    workspace.messages ?? workspace.whatsappMessages
  );

  const latestCharge = workspaceCharges[0];
  const latestAppointment = workspaceAppointments[0];
  const latestServiceOrder = workspaceServiceOrders[0];
  const latestMessage = workspaceMessages[0];
  const selectedSnapshot = snapshotByCustomerId.get(selectedCustomer?.id ?? "");

  const runCustomerPrimaryAction = () => {
    if (!selectedCustomer?.id || !selectedSnapshot) return;
    setIsProcessingPrimaryAction(true);
    if (selectedSnapshot.primaryActionLabel.startsWith("Cobrar")) {
      setActionFeedbackTone("success");
      setActionFeedback("Abrindo cobrança do cliente...");
      navigate(`/finances?customerId=${selectedCustomer.id}&filter=overdue`);
      setIsProcessingPrimaryAction(false);
      return;
    }
    if (selectedSnapshot.primaryActionLabel.startsWith("Criar agendamento")) {
      setActionFeedbackTone("success");
      setActionFeedback("Abrindo criação de agendamento...");
      setOpenAppointmentCreate(true);
      setIsProcessingPrimaryAction(false);
      return;
    }
    if (
      selectedSnapshot.primaryActionLabel.startsWith("Confirmar agora") ||
      selectedSnapshot.primaryActionLabel.startsWith("Enviar WhatsApp")
    ) {
      setActionFeedbackTone("success");
      setActionFeedback("Abrindo canal de comunicação...");
      navigate(`/whatsapp?customerId=${selectedCustomer.id}`);
      setIsProcessingPrimaryAction(false);
      return;
    }
    if (selectedSnapshot.primaryActionLabel.startsWith("Gerar cobrança")) {
      setActionFeedbackTone("success");
      setActionFeedback("Abrindo financeiro para gerar cobrança...");
      navigate(`/finances?customerId=${selectedCustomer.id}`);
      setIsProcessingPrimaryAction(false);
      return;
    }
    setActionFeedbackTone("neutral");
    setActionFeedback("Contexto do cliente carregado.");
    setIsProcessingPrimaryAction(false);
  };

  const filterItems: Array<{ key: OperationalFilter; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "risk", label: "Em risco" },
    { key: "billing", label: "Cobrança" },
    { key: "no_response", label: "Sem resposta" },
    { key: "no_schedule", label: "Sem agenda" },
    { key: "healthy", label: "Saudáveis" },
  ];
  const quickFilterItems = filterItems.filter(item =>
    ["all", "risk", "billing"].includes(item.key)
  );
  const advancedFilterItems = filterItems.filter(
    item => !["all", "risk", "billing"].includes(item.key)
  );
  const sortLabels: Record<OperationalSort, string> = {
    priority: "Prioridade",
    financial: "Valor financeiro",
    last_interaction: "Última interação",
    name: "Nome",
  };

  const tabMeta = {
    overview: {
      title: "Visão geral da carteira",
      description:
        "Leitura da carteira com risco, prioridade e contexto para tomada de decisão.",
      ctaLabel: "Novo cliente",
      onCta: () => setCreateOpen(true),
      sectionTitle: "Leitura da carteira e fila prioritária",
      sectionSubtitle:
        "Risco de clientes, continuidade operacional e próxima ação por prioridade.",
      listTitle: "Fila prioritária da carteira",
    },
    agenda: {
      title: "Agenda por cliente",
      description:
        "Foco operacional em clientes com compromisso e clientes sem agenda futura.",
      ctaLabel: "Criar agendamento",
      onCta: () => navigate("/appointments"),
      sectionTitle: "Continuidade de agenda da carteira",
      sectionSubtitle:
        "Quem tem compromisso próximo, quem está sem agenda futura e onde agir primeiro.",
      listTitle: "Fila de agenda por cliente",
    },
    service_orders: {
      title: "Execução por cliente (O.S.)",
      description:
        "Foco em clientes com ordens abertas, travadas e concluídas.",
      ctaLabel: "Criar O.S.",
      onCta: () => navigate("/service-orders"),
      sectionTitle: "Pipeline de execução por cliente",
      sectionSubtitle:
        "Clientes que precisam abrir execução, acelerar avanço ou destravar ordens.",
      listTitle: "Fila de execução por cliente",
    },
    financial: {
      title: "Financeiro por cliente",
      description:
        "Leitura de cobrança, pendência, atraso e impacto no caixa por cliente.",
      ctaLabel: "Ir para cobrança",
      onCta: () => navigate("/finances?filter=overdue"),
      sectionTitle: "Cobrança e pendência da carteira",
      sectionSubtitle:
        "Priorização financeira por impacto pendente e atraso de recebimento.",
      listTitle: "Fila financeira por cliente",
    },
    history: {
      title: "Histórico de relacionamento",
      description:
        "Timeline operacional de interações, recorrências e contexto histórico por cliente.",
      ctaLabel: "Abrir timeline",
      onCta: () => navigate("/timeline"),
      sectionTitle: "Linha histórica de eventos da carteira",
      sectionSubtitle:
        "Recorrência de interação, padrões e sinais para prevenir novo risco.",
      listTitle: "Clientes com maior histórico recente",
    },
  } as const;

  const activeMeta = tabMeta[activeTab];

  return (
    <PageWrapper
      title="Centro operacional de clientes"
      subtitle="Relacione cliente, agenda, O.S. e cobrança em uma única decisão operacional."
    >
      <div className="space-y-4">
        <AppPageHeader
          title={activeMeta.title}
          description={activeMeta.description}
          cta={
            <Button
              type="button"
              onClick={activeMeta.onCta}
              className="h-10 whitespace-nowrap px-4"
            >
              {activeMeta.ctaLabel}
            </Button>
          }
        />

        <AppOperationalBar
          tabs={[
            { value: "overview", label: "Visão geral" },
            { value: "agenda", label: "Agenda" },
            { value: "service_orders", label: "O.S." },
            { value: "financial", label: "Financeiro" },
            { value: "history", label: "Histórico" },
          ]}
          activeTab={activeTab}
          onTabChange={value => {
            setActiveTab(value);
            if (value === "financial") setActiveFilter("billing");
            else if (value === "agenda") setActiveFilter("no_schedule");
            else if (value === "overview") setActiveFilter("all");
          }}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome, telefone, email ou ID"
          quickFilters={
            <div className="flex flex-wrap items-center gap-2">
              {quickFilterItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={appSelectionPillClasses(activeFilter === item.key)}
                  onClick={() => setActiveFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
          advancedFiltersLabel="Mais filtros"
          advancedFiltersContent={
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Filtros de contexto
                </p>
                <div className="flex flex-wrap gap-2">
                  {advancedFilterItems.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={appSelectionPillClasses(activeFilter === item.key)}
                      onClick={() => setActiveFilter(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                  htmlFor="customers-sort"
                >
                  Ordenação
                </label>
                <select
                  id="customers-sort"
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={activeSort}
                  onChange={event =>
                    setActiveSort(event.target.value as OperationalSort)
                  }
                >
                  <option value="priority">Prioridade</option>
                  <option value="financial">Valor financeiro</option>
                  <option value="last_interaction">Última interação</option>
                  <option value="name">Nome</option>
                </select>
              </div>
            </>
          }
          activeFilterChips={[
            ...(!quickFilterItems.some(item => item.key === activeFilter) &&
            activeFilter !== "all"
              ? [
                  {
                    key: `filter-${activeFilter}`,
                    label:
                      filterItems.find(item => item.key === activeFilter)?.label ??
                      activeFilter,
                    onRemove: () => setActiveFilter("all"),
                  },
                ]
              : []),
            ...(activeSort !== "priority"
              ? [
                  {
                    key: "sort",
                    label: `Ordenação: ${sortLabels[activeSort]}`,
                    onRemove: () => setActiveSort("priority"),
                  },
                ]
              : []),
          ]}
          onClearAllFilters={() => {
            setActiveFilter("all");
            setActiveSort("priority");
          }}
        />

        <div className="space-y-4">
          <AppSectionBlock
            title={
              activeTab === "history"
                ? "Histórico operacional da carteira"
                : "Carteira de clientes"
            }
            subtitle="Lista principal para operação diária da carteira"
          >
            {selectedCustomerIds.length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-soft)]/45 p-2.5">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {selectedCustomerIds.length} cliente(s) selecionado(s) para
                  ação em lote
                </p>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton
                    type="button"
                    className="h-8 px-3 text-xs"
                    onClick={() =>
                      navigate(
                        `/finances?customerIds=${selectedCustomerIds.join(",")}&filter=overdue`
                      )
                    }
                  >
                    Cobrar agora
                  </SecondaryButton>
                </div>
              </div>
            ) : null}

            {showInitialLoading ? (
              <AppPageLoadingState description="Carregando carteira de clientes..." />
            ) : showErrorState ? (
              <AppPageErrorState
                description={
                  customersQuery.error?.message ?? "Falha ao carregar clientes."
                }
                actionLabel="Tentar novamente"
                onAction={() => void customersQuery.refetch()}
              />
            ) : displayedCustomers.length === 0 ? (
              <AppPageEmptyState
                title="Nenhum cliente encontrado"
                description="Ajuste filtros, busca ou crie clientes para ativar o fluxo operacional."
              />
            ) : (
              <AppDataTable>
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-elevated)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      <tr>
                        <th className="w-10 px-4 py-2.5 align-middle">
                          <AppCheckbox
                            checked={allDisplayedSelected}
                            onCheckedChange={checked => {
                              if (checked) {
                                setSelectedCustomerIds(
                                  displayedCustomers.map(customer =>
                                    String(customer?.id ?? "")
                                  )
                                );
                                return;
                              }
                              setSelectedCustomerIds([]);
                            }}
                            aria-label="Selecionar todos"
                          />
                        </th>
                        <th className="w-[23%] px-4 py-2.5 align-middle">Cliente</th>
                        <th className="w-[20%] px-4 py-2.5 align-middle">Contato</th>
                        <th className="w-[18%] px-4 py-2.5 align-middle">Status</th>
                        <th className="w-[25%] px-4 py-2.5 align-middle">Próxima ação</th>
                        <th className="w-[156px] px-4 py-2.5 text-right align-middle">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCustomers.map(customer => {
                        const customerId = String(customer?.id ?? "");
                        const snapshot = snapshotByCustomerId.get(customerId);
                        if (!snapshot) return null;

                        const primaryAction = (() => {
                          if (snapshot.primaryActionLabel.startsWith("Cobrar")) {
                            return {
                              label: "Cobrar",
                              onSelect: () =>
                                navigate(
                                  `/finances?customerId=${customerId}&filter=overdue`
                                ),
                            };
                          }
                          if (snapshot.primaryActionLabel.startsWith("Criar agendamento")) {
                            return {
                              label: "Criar agenda",
                              onSelect: () =>
                                navigate(
                                  `/appointments?customerId=${customerId}`
                                ),
                            };
                          }
                          if (snapshot.primaryActionLabel.startsWith("Confirmar")) {
                            return {
                              label: "Confirmar",
                              onSelect: () =>
                                navigate(`/whatsapp?customerId=${customerId}`),
                            };
                          }
                          return {
                            label: resolveOperationalActionLabel(
                              snapshot.primaryActionLabel,
                              "Abrir"
                            ),
                            onSelect: () => {
                              setTimelineExpanded(false);
                              setSelectedCustomer({
                                id: customerId,
                                name: String(customer?.name ?? "Cliente"),
                              });
                            },
                          };
                        })();
                        const billingActionLabel =
                          snapshot.overdueCharges > 0
                            ? "Cobrar agora"
                            : snapshot.pendingCharges > 0
                              ? "Ver cobrança pendente"
                              : "Ver cobranças";

                        return (
                          <tr
                            key={customerId}
                            className={`border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60 focus-within:bg-[var(--surface-subtle)]/70 ${
                              selectedCustomerIds.includes(customerId)
                                ? "bg-[var(--accent-soft)]/40"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3.5 align-top">
                              <AppCheckbox
                                checked={selectedCustomerIds.includes(
                                  customerId
                                )}
                                onCheckedChange={checked => {
                                  setSelectedCustomerIds(previous => {
                                    if (checked)
                                      return [
                                        ...new Set([...previous, customerId]),
                                      ];
                                    return previous.filter(
                                      item => item !== customerId
                                    );
                                  });
                                }}
                                aria-label={`Selecionar ${String(customer?.name ?? "cliente")}`}
                              />
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => {
                                  setTimelineExpanded(false);
                                  setSelectedCustomer({
                                    id: customerId,
                                    name: String(customer?.name ?? "Cliente"),
                                  });
                                }}
                              >
                                <p className="truncate text-sm font-semibold leading-5 text-[var(--text-primary)]">
                                  {String(customer?.name ?? "Sem nome")}
                                </p>
                                <span className="mt-1 block truncate text-[11px] text-[var(--text-muted)]">
                                  ID {customerId.slice(0, 8)}
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <div className="space-y-1">
                                <p className="truncate text-xs text-[var(--text-secondary)]">
                                  {String(customer?.phone ?? "—")}
                                </p>
                                <p className="truncate text-[11px] text-[var(--text-muted)]">
                                  {String(customer?.email ?? "—")}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <AppStatusBadge
                                label={
                                  snapshot.overdueCharges > 0
                                    ? "Em risco"
                                    : !snapshot.hasFutureSchedule
                                      ? "Pendente"
                                      : getContactUrgencyLabel(
                                          snapshot.contactDays,
                                          snapshot.contactState
                                        )
                                }
                              />
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p
                                className="truncate whitespace-nowrap text-sm font-medium leading-5 text-[var(--text-primary)]"
                                title={snapshot.nextActionReason}
                              >
                                {toSingleLineAction(snapshot.nextActionReason)}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
                                {snapshot.contextLabel}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <div className="flex items-center justify-end gap-2">
                                <SecondaryButton
                                  type="button"
                                  className="h-8 min-w-[104px] whitespace-nowrap px-3 text-xs font-semibold"
                                  onClick={event => {
                                    event.stopPropagation();
                                    primaryAction.onSelect();
                                  }}
                                >
                                  {primaryAction.label}
                                </SecondaryButton>
                                <AppRowActionsDropdown
                                  triggerLabel="Mais ações"
                                  contentClassName="min-w-[248px]"
                                  items={[
                                    {
                                      label: `${snapshot.primaryActionLabel} · prioritário`,
                                      onSelect: primaryAction.onSelect,
                                    },
                                    {
                                      label: "Abrir detalhe operacional",
                                      onSelect: () => {
                                        setTimelineExpanded(false);
                                        setSelectedCustomer({
                                          id: customerId,
                                          name: String(
                                            customer?.name ?? "Cliente"
                                          ),
                                        });
                                      },
                                    },
                                    {
                                      label: billingActionLabel,
                                      onSelect: () =>
                                        navigate(
                                          `/finances?customerId=${customerId}`
                                        ),
                                    },
                                    {
                                      label: "Ver agendamentos",
                                      onSelect: () =>
                                        navigate(
                                          `/appointments?customerId=${customerId}`
                                        ),
                                    },
                                    {
                                      label: "Criar O.S.",
                                      onSelect: () =>
                                        navigate(
                                          `/service-orders?customerId=${customerId}`
                                        ),
                                    },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
              </AppDataTable>
            )}
          </AppSectionBlock>
        </div>

        <CreateCustomerModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={async created => {
            setCreateOpen(false);
            await customersQuery.refetch();
            if (created?.id) {
              setTimelineExpanded(false);
              setSelectedCustomer({
                id: created.id,
                name: created.name ?? "Cliente",
              });
            }
          }}
        />
        <AppOperationalModal
          open={Boolean(selectedCustomer)}
          onOpenChange={open => {
            if (!open) {
              setSelectedCustomer(null);
              setTimelineExpanded(false);
              setActionFeedback(null);
              setActionFeedbackTone("neutral");
            }
          }}
          title={selectedCustomer?.name ?? "Cliente"}
          subtitle="Central operacional de cliente para decidir, agir e acompanhar sem sair da carteira."
          status={selectedSnapshot?.status}
          priority={
            selectedSnapshot ? `Prioridade ${selectedSnapshot.priorityScore}` : undefined
          }
          summary={[
            {
              label: "Financeiro",
              value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceCharges.length} cobranças`,
            },
            {
              label: "Agenda",
              value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceAppointments.length} agendamentos`,
            },
            {
              label: "O.S.",
              value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceServiceOrders.length} ordens`,
            },
            {
              label: "WhatsApp",
              value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceMessages.length} interações`,
            },
          ]}
          primaryAction={{
            label: selectedSnapshot?.primaryActionLabel ?? "Abrir detalhe",
            onClick: runCustomerPrimaryAction,
            disabled: !selectedCustomer?.id,
            processing: isProcessingPrimaryAction,
          }}
          secondaryAction={{
            label: "Criar O.S.",
            onClick: () => setOpenServiceOrderCreate(true),
            disabled: !selectedCustomer?.id,
          }}
          quickActions={[
            {
              label: "Criar agendamento",
              onClick: () => setOpenAppointmentCreate(true),
              disabled: !selectedCustomer?.id || isProcessingPrimaryAction,
            },
            {
              label: "Cobrança",
              onClick: () =>
                selectedCustomer?.id &&
                navigate(`/finances?customerId=${selectedCustomer.id}&filter=overdue`),
              disabled: !selectedCustomer?.id || isProcessingPrimaryAction,
            },
            {
              label: "WhatsApp",
              onClick: () =>
                selectedCustomer?.id &&
                navigate(`/whatsapp?customerId=${selectedCustomer.id}`),
              disabled: !selectedCustomer?.id || isProcessingPrimaryAction,
            },
          ]}
          feedback={actionFeedback}
          feedbackTone={actionFeedbackTone}
          contentLoading={workspaceQuery.isLoading}
          loadingLabel="Carregando visão de cliente, agenda, execução e financeiro..."
        >
          <div className="space-y-4">
            {workspaceQuery.error ? (
              <p className="rounded-md border border-[var(--dashboard-danger)]/40 bg-[var(--dashboard-danger)]/10 p-3 text-sm text-[var(--dashboard-danger)]">
                Não foi possível carregar o detalhe do cliente:{" "}
                {workspaceQuery.error.message}
              </p>
            ) : (
              <div className="space-y-4">
                <section className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Resumo e contexto
                  </p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {String(workspaceCustomer?.phone ?? "Sem telefone")} ·{" "}
                    {String(workspaceCustomer?.email ?? "Sem e-mail")}
                  </p>
                  {selectedSnapshot ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      {selectedSnapshot.segmentTag} ·{" "}
                      {selectedSnapshot.behaviorLabel}
                    </p>
                  ) : null}
                </section>
                {selectedSnapshot ? (
                  <OperationalNextAction
                    title={selectedSnapshot.primaryActionLabel}
                    reason={selectedSnapshot.primaryActionReason}
                    urgency={selectedSnapshot.primaryActionUrgency}
                    impact={selectedSnapshot.primaryActionImpact}
                  />
                ) : null}
                <OperationalFlowState
                  steps={[
                    { label: "Cliente", state: "done" },
                    {
                      label: "Agendamento",
                      state: selectedSnapshot?.hasFutureSchedule ? "done" : "pending",
                    },
                    {
                      label: "O.S.",
                      state: workspaceServiceOrders.length > 0 ? "done" : "pending",
                    },
                    {
                      label: "Cobrança",
                      state:
                        selectedSnapshot &&
                        (selectedSnapshot.pendingCharges > 0 ||
                          selectedSnapshot.overdueCharges > 0)
                          ? "current"
                          : workspaceCharges.length > 0
                            ? "done"
                            : "pending",
                    },
                    {
                      label: "Pagamento",
                      state:
                        selectedSnapshot?.overdueCharges
                          ? "pending"
                          : workspaceCharges.length > 0
                            ? "current"
                            : "pending",
                    },
                  ]}
                />
                {selectedSnapshot?.overdueCharges ? (
                  <OperationalAutomationNote detail="Após registrar pagamento, o cliente volta automaticamente para a fila saudável da carteira." />
                ) : null}
                {!selectedSnapshot?.hasFutureSchedule ? (
                  <OperationalAutomationNote detail="Quando um novo agendamento for criado, a prioridade deste cliente será recalculada automaticamente." />
                ) : null}
                <OperationalRelationSummary
                  title="Entidades conectadas"
                  items={[
                    `Este cliente possui ${workspaceAppointments.length} agendamento(s) e ${workspaceServiceOrders.length} O.S. vinculada(s).`,
                    `Financeiro atual: ${workspaceCharges.length} cobrança(s), com ${selectedSnapshot?.overdueCharges ?? 0} vencida(s).`,
                    `Canal ativo: ${workspaceMessages.length} interação(ões) de WhatsApp registradas.`,
                  ]}
                />
                <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Financeiro e cobrança
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Pendente:{" "}
                    {selectedSnapshot
                      ? formatMoney(selectedSnapshot.financialPendingCents)
                      : "—"}{" "}
                    · potencial:{" "}
                    {selectedSnapshot
                      ? formatMoney(selectedSnapshot.financialPotentialCents)
                      : "—"}{" "}
                    · última cobrança:{" "}
                    {selectedSnapshot
                      ? formatMoney(selectedSnapshot.latestChargeCents)
                      : latestCharge
                        ? formatMoney(Number(latestCharge?.amountCents ?? 0))
                        : "—"}
                  </p>
                </section>
                {workspaceServiceOrders.length === 0 ? (
                  <EmptyActionState
                    title="Nenhuma O.S. vinculada ainda"
                    description="Ainda não existe ordem de serviço para este cliente. Abra uma O.S. para dar continuidade ao fluxo operacional."
                    ctaLabel="Criar O.S."
                    onCta={() => setOpenServiceOrderCreate(true)}
                  />
                ) : null}
                {workspaceCharges.length === 0 ? (
                  <EmptyActionState
                    title="Nenhuma cobrança gerada ainda"
                    description="Sem cobrança ativa por enquanto. Assim que houver O.S. concluída, o próximo passo é gerar cobrança para fechar o ciclo."
                    ctaLabel="Gerar cobrança"
                    onCta={() =>
                      selectedCustomer?.id &&
                      navigate(`/finances?customerId=${selectedCustomer.id}`)
                    }
                  />
                ) : null}
                <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Agenda, O.S. e comunicação
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Último agendamento:{" "}
                    {latestAppointment?.startsAt
                      ? new Date(
                          String(latestAppointment.startsAt)
                        ).toLocaleString("pt-BR")
                      : "não registrado"}{" "}
                    · última O.S.:{" "}
                    {String(
                      latestServiceOrder?.title ??
                        latestServiceOrder?.id ??
                        "não registrada"
                    )}
                  </p>
                </section>
                {actionFeedback ? (
                  <OperationalInlineFeedback
                    tone={actionFeedbackTone}
                    nextStep={
                      actionFeedbackTone === "success"
                        ? "Acompanhar atualização da timeline e validar próximo passo sugerido."
                        : undefined
                    }
                  >
                    {actionFeedback}
                  </OperationalInlineFeedback>
                ) : null}
                {workspaceTimeline.length > 3 ? (
                  <button
                    type="button"
                    className="text-left text-xs font-medium text-[var(--accent-primary)]"
                    onClick={() => setTimelineExpanded(previous => !previous)}
                  >
                    {timelineExpanded
                      ? "Ver menos timeline"
                      : "Ver mais timeline"}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </AppOperationalModal>
        <CreateAppointmentModal
          isOpen={openAppointmentCreate}
          onClose={() => setOpenAppointmentCreate(false)}
          onSuccess={() => {
            setActionFeedbackTone("success");
            setActionFeedback("Agendamento criado com sucesso.");
            void workspaceQuery.refetch();
          }}
          customers={customers.map(item => ({
            id: String(item.id),
            name: String(item.name ?? "Cliente"),
          }))}
        />
        <CreateServiceOrderModal
          open={openServiceOrderCreate}
          onClose={() => setOpenServiceOrderCreate(false)}
          onSuccess={() => {
            setActionFeedbackTone("success");
            setActionFeedback("O.S. criada e conectada ao cliente.");
            void workspaceQuery.refetch();
          }}
          customers={customers.map(item => ({
            id: String(item.id),
            name: String(item.name ?? "Cliente"),
          }))}
          people={people.map(item => ({
            id: String(item.id),
            name: String(item.name ?? "Pessoa"),
          }))}
          initialCustomerId={selectedCustomer?.id ?? null}
        />
      </div>
    </PageWrapper>
  );
}
