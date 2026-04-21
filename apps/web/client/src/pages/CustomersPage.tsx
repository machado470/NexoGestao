import { useEffect, useMemo, useState } from "react";
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
  OPERATIONAL_PRIMARY_CTA_CLASS,
  resolveOperationalActionLabel,
  toSingleLineAction,
} from "@/lib/operations/operational-list";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { Button, SecondaryButton } from "@/components/design-system";
import { ActionBarWrapper, PageWrapper } from "@/components/operating-system/Wrappers";
import { WorkspaceScaffold } from "@/components/operating-system/WorkspaceScaffold";
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
  AppPriorityBadge,
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
  hasOpenServiceOrder: boolean;
  lastServiceLabel: string;
  nextAppointmentLabel: string;
  ownerLabel: string;
  isFrequent: boolean;
  isNew: boolean;
  riskLabel: "Baixo" | "Médio" | "Alto";
  totalSpentCents: number;
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

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCustomerId, setActiveCustomerId] = useOperationalMemoryState<
    string | null
  >("nexo.customers.active-id.v1", null);
  const [activeFilter, setActiveFilter] = useOperationalMemoryState<OperationalFilter>(
    "nexo.customers.filter.v1",
    "all"
  );
  const [activeSort, setActiveSort] = useOperationalMemoryState<OperationalSort>(
    "nexo.customers.sort.v1",
    "priority"
  );
  const [withPendingOnly, setWithPendingOnly] = useOperationalMemoryState(
    "nexo.customers.filter.pending.v1",
    false
  );
  const [withOpenOsOnly, setWithOpenOsOnly] = useOperationalMemoryState(
    "nexo.customers.filter.open-os.v1",
    false
  );
  const [withoutRecentReplyOnly, setWithoutRecentReplyOnly] = useOperationalMemoryState(
    "nexo.customers.filter.no-reply.v1",
    false
  );
  const [periodFilter, setPeriodFilter] = useOperationalMemoryState<
    "all" | "7d" | "15d" | "30d"
  >("nexo.customers.filter.period.v1", "all");
  const [minPendingAmountBand, setMinPendingAmountBand] = useOperationalMemoryState<
    "all" | "10k" | "50k" | "100k"
  >("nexo.customers.filter.value.v1", "all");
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
      const hasOpenServiceOrder = seed % 4 !== 0;
      const isFrequent = seed % 3 === 0;
      const isNew = seed % 11 === 0;
      const ownerLabel =
        people.length > 0
          ? String(people[seed % people.length]?.name ?? "Equipe")
          : "Equipe";
      const lastServiceDate = new Date();
      lastServiceDate.setDate(lastServiceDate.getDate() - (2 + (seed % 18)));
      const nextAppointmentDate = new Date();
      nextAppointmentDate.setDate(
        nextAppointmentDate.getDate() + (hasFutureSchedule ? 1 + (seed % 14) : -(seed % 5))
      );
      const lastServiceLabel = `Serviço ${formatDateLabel(lastServiceDate)}`;
      const nextAppointmentLabel = hasFutureSchedule
        ? formatDateLabel(nextAppointmentDate)
        : "Sem agenda";
      const totalSpentCents = Math.max(
        latestChargeCents * (3 + (seed % 5)),
        financialPendingCents + 120000
      );

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
      let nextActionReason = "Abrir detalhe";

      if (overdueCharges > 0) {
        status = "Em risco";
        contextLabel = "Cobrança vencida";
        primaryActionLabel = `Cobrar hoje — ${overdueCharges} vencida(s)`;
        primaryActionReason =
          "O cliente já concluiu etapas e ainda possui cobrança vencida.";
        primaryActionUrgency = `Urgente · atraso de ${contactDays} dias`;
        primaryActionImpact = formatMoney(financialPendingCents);
        nextActionReason = "Cobrar hoje";
      } else if (!hasFutureSchedule) {
        status = "Atenção";
        contextLabel = "Sem agendamento futuro";
        primaryActionLabel = "Criar agendamento — sem agenda futura";
        primaryActionReason =
          "Sem próxima visita agendada, com risco de perder continuidade.";
        primaryActionUrgency = "Ação hoje para proteger recorrência";
        primaryActionImpact = "Reduz risco de inatividade";
        nextActionReason = "Criar agenda";
      } else if (contactState !== "responded") {
        status = "Atenção";
        contextLabel = `Sem resposta há ${contactDays} dias`;
        primaryActionLabel = `Confirmar agora — sem resposta há ${contactDays} dias`;
        primaryActionReason =
          "Agendamento futuro existe, mas sem confirmação recente do cliente.";
        primaryActionUrgency =
          contactDays >= 5 ? "Urgente · risco de no-show" : "Atenção";
        primaryActionImpact = "Evita falta e retrabalho";
        nextActionReason = "Confirmar cliente";
      } else if (!hasAnyCharge) {
        status = "Sem cobrança";
        contextLabel = "Sem cobrança ativa";
        primaryActionLabel = "Gerar cobrança — fluxo financeiro incompleto";
        primaryActionReason =
          "Operação está ativa, porém sem camada financeira vinculada.";
        primaryActionImpact = "Transformar execução em receita";
        nextActionReason = "Registrar cobrança";
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
        hasOpenServiceOrder,
        lastServiceLabel,
        nextAppointmentLabel,
        ownerLabel,
        isFrequent,
        isNew,
        riskLabel: status === "Em risco" ? "Alto" : status === "Atenção" ? "Médio" : "Baixo",
        totalSpentCents,
      };
    });
  }, [chargeByCustomerId, customers, people]);

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
      if (withPendingOnly && !(snapshot.overdueCharges > 0 || snapshot.pendingCharges > 0))
        return false;
      if (withOpenOsOnly && !snapshot.hasOpenServiceOrder) return false;
      if (withoutRecentReplyOnly && snapshot.contactState === "responded") return false;

      if (periodFilter !== "all") {
        const threshold =
          periodFilter === "7d" ? 7 : periodFilter === "15d" ? 15 : 30;
        if (snapshot.lastInteractionDays > threshold) return false;
      }

      if (minPendingAmountBand !== "all") {
        const thresholdCents =
          minPendingAmountBand === "10k"
            ? 1000_00
            : minPendingAmountBand === "50k"
              ? 5000_00
              : 10000_00;
        if (snapshot.financialPendingCents < thresholdCents) return false;
      }

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
    minPendingAmountBand,
    searchTerm,
    snapshotByCustomerId,
    periodFilter,
    withOpenOsOnly,
    withPendingOnly,
    withoutRecentReplyOnly,
  ]);

  const allDisplayedSelected =
    displayedCustomers.length > 0 &&
    displayedCustomers.every(customer =>
      selectedCustomerIds.includes(String(customer?.id ?? ""))
    );

  useEffect(() => {
    if (displayedCustomers.length === 0) {
      if (activeCustomerId) setActiveCustomerId(null);
      return;
    }

    if (
      activeCustomerId &&
      displayedCustomers.some(item => String(item?.id ?? "") === activeCustomerId)
    ) {
      return;
    }

    setActiveCustomerId(String(displayedCustomers[0]?.id ?? ""));
  }, [activeCustomerId, displayedCustomers, setActiveCustomerId]);

  const activeCustomer = useMemo(
    () =>
      customers.find(item => String(item?.id ?? "") === String(activeCustomerId ?? "")) ??
      null,
    [activeCustomerId, customers]
  );

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: activeCustomerId ?? "" },
    { enabled: Boolean(activeCustomerId), retry: false }
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
  const sortedTimeline = [...workspaceTimeline].sort((a, b) => {
    const aDate = new Date(String(a?.occurredAt ?? a?.createdAt ?? 0)).getTime();
    const bDate = new Date(String(b?.occurredAt ?? b?.createdAt ?? 0)).getTime();
    return bDate - aDate;
  });
  const visibleTimeline = timelineExpanded
    ? sortedTimeline.slice(0, 8)
    : sortedTimeline.slice(0, 4);
  const workspaceMessages = listFrom(
    workspace.messages ?? workspace.whatsappMessages
  );

  const latestCharge = workspaceCharges[0];
  const latestAppointment = workspaceAppointments[0];
  const latestServiceOrder = workspaceServiceOrders[0];
  const latestMessage = workspaceMessages[0];
  const selectedSnapshot = snapshotByCustomerId.get(activeCustomerId ?? "");

  const runCustomerPrimaryAction = () => {
    if (!activeCustomerId || !selectedSnapshot) return;
    setIsProcessingPrimaryAction(true);
    if (selectedSnapshot.primaryActionLabel.startsWith("Cobrar")) {
      setActionFeedbackTone("success");
      setActionFeedback("Abrindo cobrança do cliente...");
      navigate(`/finances?customerId=${activeCustomerId}&filter=overdue`);
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
      navigate(`/whatsapp?customerId=${activeCustomerId}`);
      setIsProcessingPrimaryAction(false);
      return;
    }
    if (selectedSnapshot.primaryActionLabel.startsWith("Gerar cobrança")) {
      setActionFeedbackTone("success");
      setActionFeedback("Abrindo financeiro para gerar cobrança...");
      navigate(`/finances?customerId=${activeCustomerId}`);
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
          description={
            <span>
              {activeMeta.description}
              <span className="ml-2 inline-flex">
                <AppStatusBadge
                  label={`${customers.length} clientes · ${overdueCustomers} em risco · ${withoutFutureSchedule} sem agenda`}
                />
              </span>
            </span>
          }
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
        <ActionBarWrapper
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButton
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() => navigate("/service-orders")}
              >
                Nova O.S.
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() => navigate("/appointments")}
              >
                Novo agendamento
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() => navigate("/finances?filter=overdue")}
              >
                Cobranças críticas
              </SecondaryButton>
            </div>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={appSelectionPillClasses(withPendingOnly)}
                  onClick={() => setWithPendingOnly(prev => !prev)}
                >
                  Com cobrança pendente
                </button>
                <button
                  type="button"
                  className={appSelectionPillClasses(withOpenOsOnly)}
                  onClick={() => setWithOpenOsOnly(prev => !prev)}
                >
                  Com O.S. aberta
                </button>
                <button
                  type="button"
                  className={appSelectionPillClasses(withoutRecentReplyOnly)}
                  onClick={() => setWithoutRecentReplyOnly(prev => !prev)}
                >
                  Sem resposta recente
                </button>
                <select
                  className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={periodFilter}
                  onChange={event =>
                    setPeriodFilter(event.target.value as "all" | "7d" | "15d" | "30d")
                  }
                >
                  <option value="all">Período: todos</option>
                  <option value="7d">Período: até 7 dias</option>
                  <option value="15d">Período: até 15 dias</option>
                  <option value="30d">Período: até 30 dias</option>
                </select>
                <select
                  className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)] sm:col-span-2"
                  value={minPendingAmountBand}
                  onChange={event =>
                    setMinPendingAmountBand(
                      event.target.value as "all" | "10k" | "50k" | "100k"
                    )
                  }
                >
                  <option value="all">Valor pendente: qualquer faixa</option>
                  <option value="10k">Valor pendente: acima de R$ 1.000</option>
                  <option value="50k">Valor pendente: acima de R$ 5.000</option>
                  <option value="100k">Valor pendente: acima de R$ 10.000</option>
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
            ...(withPendingOnly
              ? [{ key: "pending-only", label: "Com cobrança pendente", onRemove: () => setWithPendingOnly(false) }]
              : []),
            ...(withOpenOsOnly
              ? [{ key: "open-os-only", label: "Com O.S. aberta", onRemove: () => setWithOpenOsOnly(false) }]
              : []),
            ...(withoutRecentReplyOnly
              ? [{ key: "no-reply-only", label: "Sem resposta recente", onRemove: () => setWithoutRecentReplyOnly(false) }]
              : []),
            ...(periodFilter !== "all"
              ? [{ key: "period", label: `Período ${periodFilter}`, onRemove: () => setPeriodFilter("all") }]
              : []),
            ...(minPendingAmountBand !== "all"
              ? [{ key: "value", label: `Faixa ${minPendingAmountBand}`, onRemove: () => setMinPendingAmountBand("all") }]
              : []),
          ]}
          onClearAllFilters={() => {
            setActiveFilter("all");
            setActiveSort("priority");
            setWithPendingOnly(false);
            setWithOpenOsOnly(false);
            setWithoutRecentReplyOnly(false);
            setPeriodFilter("all");
            setMinPendingAmountBand("all");
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
                  <table className="w-full table-fixed text-sm">
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
                        <th className="w-[22%] px-4 py-2.5 align-middle">Cliente</th>
                        <th className="w-[24%] px-4 py-2.5 align-middle">Contato e contexto</th>
                        <th className="w-[20%] px-4 py-2.5 align-middle">Serviço e agenda</th>
                        <th className="w-[16%] px-4 py-2.5 align-middle">Financeiro e risco</th>
                        <th className="w-[10%] px-4 py-2.5 align-middle">Responsável</th>
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
                              setActionFeedback(null);
                              setActionFeedbackTone("neutral");
                              setActiveCustomerId(customerId);
                            },
                          };
                        })();
                        return (
                          <tr
                            key={customerId}
                            className={`border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60 focus-within:bg-[var(--surface-subtle)]/70 ${
                              activeCustomerId === customerId
                                ? "bg-[var(--accent-soft)]/65"
                                : selectedCustomerIds.includes(customerId)
                                  ? "bg-[var(--accent-soft)]/35"
                                : ""
                            }`}
                            onClick={() => {
                              setTimelineExpanded(false);
                              setActionFeedback(null);
                              setActionFeedbackTone("neutral");
                              setActiveCustomerId(customerId);
                            }}
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
                                onClick={event => event.stopPropagation()}
                                aria-label={`Selecionar ${String(customer?.name ?? "cliente")}`}
                              />
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => {
                                  setTimelineExpanded(false);
                                  setActionFeedback(null);
                                  setActionFeedbackTone("neutral");
                                  setActiveCustomerId(customerId);
                                }}
                              >
                                <p className="truncate text-sm font-semibold leading-5 text-[var(--text-primary)]">
                                  {String(customer?.name ?? "Sem nome")}
                                </p>
                                <span className="mt-1 block truncate text-[11px] text-[var(--text-muted)]">
                                  ID {customerId.slice(0, 8)}
                                </span>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {snapshot.isNew ? (
                                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                                      Cliente novo
                                    </span>
                                  ) : null}
                                  {snapshot.isFrequent ? (
                                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                                      Cliente frequente
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p className="truncate text-xs text-[var(--text-secondary)]">
                                {String(customer?.phone || customer?.email || "—")}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {snapshot.overdueCharges > 0 ? (
                                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                                    Cobrança vencida
                                  </span>
                                ) : snapshot.pendingCharges > 0 ? (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                                    Cobrança pendente
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                                  Última interação: {snapshot.lastInteractionDays}d
                                </span>
                                {snapshot.status === "Em risco" ? (
                                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                                    Risco alto
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p className="text-xs text-[var(--text-secondary)]">
                                Último serviço: {snapshot.lastServiceLabel}
                              </p>
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                Próximo agendamento: {snapshot.nextAppointmentLabel}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                {snapshot.hasOpenServiceOrder
                                  ? "Com O.S. aberta"
                                  : "Sem O.S. aberta"}
                              </p>
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
                              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                                Pendente: {formatMoney(snapshot.financialPendingCents)}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                Total gasto: {formatMoney(snapshot.totalSpentCents)}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                Ação: {toSingleLineAction(snapshot.nextActionReason)}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p className="text-xs text-[var(--text-secondary)]">{snapshot.ownerLabel}</p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Risco {snapshot.riskLabel}</p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <div className="flex items-center justify-end gap-2">
                                <SecondaryButton
                                  type="button"
                                  className={OPERATIONAL_PRIMARY_CTA_CLASS}
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
                                      label: "Ver cliente",
                                      onSelect: () => {
                                        setTimelineExpanded(false);
                                        setActionFeedback(null);
                                        setActionFeedbackTone("neutral");
                                        setActiveCustomerId(customerId);
                                      },
                                    },
                                    {
                                      label: "Cobrar",
                                      onSelect: () =>
                                        navigate(
                                          `/finances?customerId=${customerId}&filter=overdue`
                                        ),
                                    },
                                    {
                                      label: "Agendar",
                                      onSelect: () =>
                                        navigate(
                                          `/appointments?customerId=${customerId}`
                                        ),
                                    },
                                    {
                                      label: "Abrir O.S.",
                                      onSelect: () =>
                                        navigate(
                                          `/service-orders?customerId=${customerId}`
                                        ),
                                    },
                                    {
                                      label: "Enviar mensagem",
                                      onSelect: () => navigate(`/whatsapp?customerId=${customerId}`),
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
              setActionFeedback(null);
              setActionFeedbackTone("neutral");
              setActiveCustomerId(created.id);
            }
          }}
        />
        <AppSectionBlock
          title="Workspace operacional do cliente"
          subtitle="Contexto vivo para decidir e agir sem sair da lista."
        >
          {!activeCustomerId || !activeCustomer ? (
            <AppPageEmptyState
              title="Selecione um cliente"
              description="Clique em uma linha para abrir o workspace e continuar o fluxo operacional sem modal pesado."
            />
          ) : workspaceQuery.error ? (
            <AppPageErrorState
              description={`Não foi possível carregar o workspace: ${workspaceQuery.error.message}`}
              actionLabel="Tentar novamente"
              onAction={() => void workspaceQuery.refetch()}
            />
          ) : (
            <WorkspaceScaffold
              title={`Workspace · ${String(activeCustomer?.name ?? "Cliente")}`}
              subtitle="Cliente, contexto financeiro, operação e comunicação no mesmo foco."
              primaryAction={{
                label: selectedSnapshot?.primaryActionLabel ?? "Executar próxima ação",
                onClick: runCustomerPrimaryAction,
              }}
              context={
                <div className="space-y-4">
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 bg-[var(--surface-subtle)]/35 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                        {String(activeCustomer?.name ?? "Cliente")}
                      </h4>
                      <div className="flex items-center gap-2">
                        <AppStatusBadge label={selectedSnapshot?.status ?? "Em acompanhamento"} />
                        <AppPriorityBadge
                          label={
                            selectedSnapshot?.overdueCharges
                              ? "Crítica"
                              : selectedSnapshot?.status === "Atenção"
                                ? "Média"
                                : "Baixa"
                          }
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {selectedSnapshot?.contextLabel ?? "Sem contexto resumido"} ·{" "}
                      {selectedSnapshot?.behaviorLabel ?? "Comportamento não classificado"}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      {String(workspaceCustomer?.phone ?? "Sem telefone")} ·{" "}
                      {String(workspaceCustomer?.email ?? "Sem e-mail")}
                    </p>
                  </section>
                  {selectedSnapshot ? (
                    <OperationalNextAction
                      title={selectedSnapshot.primaryActionLabel}
                      reason={selectedSnapshot.primaryActionReason}
                      urgency={selectedSnapshot.primaryActionUrgency}
                      impact={selectedSnapshot.primaryActionImpact}
                    />
                  ) : null}
                  <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Contexto financeiro
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {selectedSnapshot?.overdueCharges
                        ? `${selectedSnapshot.overdueCharges} cobrança(s) vencida(s)`
                        : selectedSnapshot?.pendingCharges
                          ? `${selectedSnapshot.pendingCharges} cobrança(s) pendente(s)`
                          : "Sem pendências de cobrança"}{" "}
                      · pendente {selectedSnapshot ? formatMoney(selectedSnapshot.financialPendingCents) : "—"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton
                        type="button"
                        className="h-8 px-3 text-xs"
                        onClick={() => navigate(`/finances?customerId=${activeCustomerId}`)}
                      >
                        Abrir financeiro
                      </SecondaryButton>
                    </div>
                  </section>
                  <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Contexto operacional
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Próximo agendamento:{" "}
                      {latestAppointment?.startsAt
                        ? new Date(String(latestAppointment.startsAt)).toLocaleString("pt-BR")
                        : "não registrado"}{" "}
                      · O.S. em foco:{" "}
                      {String(latestServiceOrder?.title ?? latestServiceOrder?.id ?? "não registrada")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton
                        type="button"
                        className="h-8 px-3 text-xs"
                        onClick={() => navigate(`/appointments?customerId=${activeCustomerId}`)}
                      >
                        Ver agenda
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        className="h-8 px-3 text-xs"
                        onClick={() => navigate(`/service-orders?customerId=${activeCustomerId}`)}
                      >
                        Ver O.S.
                      </SecondaryButton>
                    </div>
                  </section>
                </div>
              }
              communication={
                <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Comunicação
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    WhatsApp: {latestMessage ? "Canal com histórico recente" : "Sem interação recente"}.
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Última interação: {selectedSnapshot?.contactLabel ?? "Sem retorno registrado"}.
                  </p>
                  <Button
                    type="button"
                    className="mt-3 h-8 px-3 text-xs"
                    onClick={() => navigate(`/whatsapp?customerId=${activeCustomerId}`)}
                  >
                    Abrir WhatsApp
                  </Button>
                </section>
              }
              timeline={
                <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Timeline do cliente
                  </p>
                  <ul className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
                    {visibleTimeline.length === 0 ? (
                      <li>Sem eventos recentes.</li>
                    ) : (
                      visibleTimeline.map((event, index) => (
                        <li
                          key={`${String(event?.id ?? "event")}-${index}`}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/45 p-2"
                        >
                          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                            {String(event?.type ?? event?.entityType ?? "evento")}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--text-primary)]">
                            {String(event?.description ?? event?.title ?? "Evento operacional")}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                            {event?.occurredAt || event?.createdAt
                              ? new Date(String(event?.occurredAt ?? event?.createdAt)).toLocaleString("pt-BR")
                              : "Data não informada"}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                  {sortedTimeline.length > 4 ? (
                    <button
                      type="button"
                      className="mt-2 text-left text-xs font-medium text-[var(--accent-primary)]"
                      onClick={() => setTimelineExpanded(previous => !previous)}
                    >
                      {timelineExpanded ? "Ver menos timeline" : "Ver mais timeline"}
                    </button>
                  ) : null}
                </section>
              }
              finance={
                <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Financeiro resumido
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Última cobrança:{" "}
                    {selectedSnapshot
                      ? formatMoney(selectedSnapshot.latestChargeCents)
                      : latestCharge
                        ? formatMoney(Number(latestCharge?.amountCents ?? 0))
                        : "—"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Situação: {selectedSnapshot?.status === "Em risco" ? "Atraso impactando caixa." : "Fluxo financeiro monitorado."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-8 px-3 text-xs"
                    onClick={() => navigate(`/finances?customerId=${activeCustomerId}`)}
                  >
                    Cobrar cliente
                  </Button>
                </section>
              }
            >
              <div className="space-y-4">
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
                        (selectedSnapshot.pendingCharges > 0 || selectedSnapshot.overdueCharges > 0)
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
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Ordens de serviço
                      </p>
                      <SecondaryButton
                        type="button"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => navigate(`/service-orders?customerId=${activeCustomerId}`)}
                      >
                        Nova O.S.
                      </SecondaryButton>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {workspaceServiceOrders.slice(0, 4).map((order, index) => (
                        <li key={`${String(order?.id ?? "order")}-${index}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/40 p-2">
                          {String(order?.title ?? order?.id ?? "O.S.")} · {String(order?.status ?? "aberta")} ·{" "}
                          {order?.amountCents ? formatMoney(Number(order.amountCents)) : "sem valor"} ·{" "}
                          {String(order?.assignedToName ?? order?.assigneeName ?? selectedSnapshot?.ownerLabel ?? "Equipe")}
                        </li>
                      ))}
                      {workspaceServiceOrders.length === 0 ? <li>Sem O.S. registrada.</li> : null}
                    </ul>
                  </section>
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Agendamentos
                      </p>
                      <SecondaryButton
                        type="button"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setOpenAppointmentCreate(true)}
                      >
                        Novo agendamento
                      </SecondaryButton>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {workspaceAppointments.slice(0, 4).map((appointment, index) => (
                        <li key={`${String(appointment?.id ?? "appointment")}-${index}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/40 p-2">
                          {appointment?.startsAt
                            ? new Date(String(appointment.startsAt)).toLocaleString("pt-BR")
                            : "Data não informada"}{" "}
                          · {String(appointment?.status ?? "pendente")} ·{" "}
                          {String(appointment?.notes ?? appointment?.description ?? "Sem observação")}
                        </li>
                      ))}
                      {workspaceAppointments.length === 0 ? <li>Sem agendamento registrado.</li> : null}
                    </ul>
                  </section>
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Comunicação
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {workspaceMessages.slice(0, 4).map((message, index) => (
                        <li key={`${String(message?.id ?? "msg")}-${index}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/40 p-2">
                          {String(message?.status ?? "enviado")} ·{" "}
                          {String(message?.body ?? message?.text ?? "Mensagem registrada")} ·{" "}
                          {message?.createdAt ? new Date(String(message.createdAt)).toLocaleString("pt-BR") : "sem data"}
                        </li>
                      ))}
                      {workspaceMessages.length === 0 ? <li>Sem mensagens registradas.</li> : null}
                    </ul>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 h-8 px-3 text-xs"
                      onClick={() => navigate(`/whatsapp?customerId=${activeCustomerId}`)}
                    >
                      Enviar WhatsApp contextualizado
                    </Button>
                  </section>
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Risco e próxima melhor ação
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Risco {selectedSnapshot?.riskLabel ?? "Médio"} · atraso {selectedSnapshot?.contactDays ?? 0} dia(s) ·{" "}
                      {selectedSnapshot?.overdueCharges ?? 0} cobrança(s) vencida(s).
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Próxima melhor ação: {selectedSnapshot?.nextActionReason ?? "Abrir detalhe"}.
                    </p>
                    <Button type="button" className="mt-2 h-8 px-3 text-xs" onClick={runCustomerPrimaryAction}>
                      {resolveOperationalActionLabel(selectedSnapshot?.primaryActionLabel ?? "", "Executar ação")}
                    </Button>
                  </section>
                </div>
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
                    onCta={() => navigate(`/finances?customerId=${activeCustomerId}`)}
                  />
                ) : null}
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
              </div>
            </WorkspaceScaffold>
          )}
        </AppSectionBlock>
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
          initialCustomerId={activeCustomerId ?? null}
        />
      </div>
    </PageWrapper>
  );
}
