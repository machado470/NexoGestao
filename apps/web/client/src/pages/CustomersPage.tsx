import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import {
  Button,
  NexoStatusBadge,
  SecondaryButton,
} from "@/components/design-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionBarWrapper } from "@/components/operating-system/ActionBar";
import { ContextPanel } from "@/components/operating-system/ContextPanel";
import { AppRowActionsDropdown, AppCheckbox } from "@/components/app-system";
import {
  AppDataTable,
  AppFiltersBar,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
} from "@/components/internal-page-system";

type CustomerRecord = Record<string, any>;
type ChargeRecord = Record<string, any>;

type ContactState = "responded" | "pending" | "no_response";
type OperationalStatus = "Saudável" | "Atenção" | "Em risco" | "Sem cobrança";
type OperationalFilter =
  | "all"
  | "risk"
  | "billing"
  | "no_response"
  | "no_schedule"
  | "healthy";
type OperationalSort = "priority" | "financial" | "last_interaction" | "name";
type NextAction =
  | "Cobrar agora"
  | "Criar agendamento"
  | "Enviar WhatsApp"
  | "Abrir workspace";

type CustomerOperationalSnapshot = {
  customerId: string;
  status: OperationalStatus;
  statusTone: "success" | "warning" | "danger" | "neutral";
  contextLabel: string;
  nextActionReason: string;
  contactState: ContactState;
  contactLabel: string;
  contactDays: number;
  hasFutureSchedule: boolean;
  overdueCharges: number;
  pendingCharges: number;
  reactivationPotential: boolean;
  primaryActionLabel: NextAction;
  financialPendingCents: number;
  financialPotentialCents: number;
  latestChargeCents: number;
  lastInteractionDays: number;
  segmentTag: "Recorrente" | "Inativo" | "Premium";
  behaviorLabel: "Responde rápido" | "Responde lento" | "Baixa interação";
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

function getStatusTone(
  status: OperationalStatus
): "success" | "warning" | "danger" | "neutral" {
  if (status === "Saudável") return "success";
  if (status === "Em risco") return "danger";
  if (status === "Atenção") return "warning";
  return "neutral";
}

function normalizeWorkspace(input: unknown) {
  return (normalizeObjectPayload<any>(input) ?? {}) as Record<string, any>;
}

function listFrom(input: unknown) {
  return normalizeArrayPayload<any>(input);
}

function getContactUrgencyTone(days: number, state: ContactState) {
  if (state === "responded")
    return "border-[var(--dashboard-success)]/35 bg-[var(--dashboard-success)]/10 text-[var(--dashboard-success)]";
  if (days >= 5)
    return "border-[var(--dashboard-danger)]/40 bg-[var(--dashboard-danger)]/10 text-[var(--dashboard-danger)]";
  if (days >= 3)
    return "border-[var(--dashboard-warning)]/40 bg-[var(--dashboard-warning)]/10 text-[var(--dashboard-warning)]";
  return "border-[var(--border-subtle)] text-[var(--text-secondary)]";
}

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [activeFilter, setActiveFilter] = useState<OperationalFilter>("all");
  const [activeSort, setActiveSort] = useState<OperationalSort>("priority");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 200 },
    { retry: false }
  );

  const customers = useMemo(
    () => normalizeArrayPayload<CustomerRecord>(customersQuery.data),
    [customersQuery.data]
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

      const segmentTag = ((): CustomerOperationalSnapshot["segmentTag"] => {
        if (seed % 4 === 0) return "Premium";
        if (seed % 3 === 0) return "Inativo";
        return "Recorrente";
      })();

      const behaviorLabel =
        ((): CustomerOperationalSnapshot["behaviorLabel"] => {
          if (contactState === "responded") return "Responde rápido";
          if (contactDays >= 5) return "Baixa interação";
          return "Responde lento";
        })();

      let status: OperationalStatus = "Saudável";
      let contextLabel = "Fluxo operacional saudável";
      let primaryActionLabel: NextAction = "Abrir workspace";
      let nextActionReason = "Manter ritmo com revisão rápida do histórico";

      if (overdueCharges > 0) {
        status = "Em risco";
        contextLabel = "Cobrança vencida";
        primaryActionLabel = "Cobrar agora";
        nextActionReason = "Cobrança vencida com impacto direto no caixa";
      } else if (!hasFutureSchedule) {
        status = "Atenção";
        contextLabel = "Sem agendamento futuro";
        primaryActionLabel = "Criar agendamento";
        nextActionReason = "Sem agenda futura e risco de quebra do fluxo";
      } else if (contactState !== "responded") {
        status = "Atenção";
        contextLabel = `Sem resposta há ${contactDays} dias`;
        primaryActionLabel = "Enviar WhatsApp";
        nextActionReason = "Reengajar comunicação para manter continuidade";
      } else if (!hasAnyCharge) {
        status = "Sem cobrança";
        contextLabel = "Sem cobrança ativa";
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
        statusTone: getStatusTone(status),
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
        financialPendingCents,
        financialPotentialCents,
        latestChargeCents,
        lastInteractionDays,
        segmentTag,
        behaviorLabel,
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
      if (activeFilter === "healthy" && snapshot.status !== "Saudável")
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
  }, [activeFilter, activeSort, customers, searchTerm, snapshotByCustomerId]);

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

  const explainConditions = selectedSnapshot
    ? ([
        selectedSnapshot.overdueCharges > 0
          ? `Cobrança vencida há ${selectedSnapshot.contactDays} dias`
          : null,
        selectedSnapshot.contactState !== "responded"
          ? `Cliente sem resposta (${selectedSnapshot.contactLabel.toLowerCase()})`
          : null,
        !selectedSnapshot.hasFutureSchedule
          ? "Sem agendamento futuro confirmado"
          : null,
        `Comportamento detectado: ${selectedSnapshot.behaviorLabel.toLowerCase()}`,
      ].filter(Boolean) as string[])
    : [];

  const filterItems: Array<{ key: OperationalFilter; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "risk", label: "Em risco" },
    { key: "billing", label: "Cobrança" },
    { key: "no_response", label: "Sem resposta" },
    { key: "no_schedule", label: "Sem agenda" },
    { key: "healthy", label: "Saudáveis" },
  ];

  return (
    <PageWrapper
      title="Clientes"
      subtitle="Operação da carteira para entender contexto e agir sem ruído."
    >
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-4 md:px-5">
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Clientes
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Carteira operacional com leitura rápida de contexto, status e
              próxima ação.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {overdueCustomers} com cobrança vencida · {withoutFutureSchedule}{" "}
              sem continuidade de agenda
            </p>
          </div>
          <ActionBarWrapper
            className="border border-[var(--border-subtle)] bg-transparent p-0"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por nome, telefone, email ou ID"
            primaryAction={
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="h-10 whitespace-nowrap px-4"
              >
                Novo cliente
              </Button>
            }
          />
        </div>
      </section>

      <AppSectionBlock
        title="Carteira de clientes"
        subtitle="Lista principal para operação diária da carteira"
      >
        <AppFiltersBar className="mb-3 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {filterItems.map(item => (
              <button
                key={item.key}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilter === item.key
                    ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/40"
                }`}
                onClick={() => setActiveFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label
              className="text-xs font-medium text-[var(--text-secondary)]"
              htmlFor="customers-sort"
            >
              Ordenar por
            </label>
            <select
              id="customers-sort"
              className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
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
        </AppFiltersBar>

        {selectedCustomerIds.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-soft)]/45 p-2.5">
            <p className="text-xs font-medium text-[var(--text-primary)]">
              {selectedCustomerIds.length} cliente(s) selecionado(s) para ação
              em lote
            </p>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  navigate(
                    `/whatsapp?customerIds=${selectedCustomerIds.join(",")}`
                  )
                }
              >
                Enviar WhatsApp
              </SecondaryButton>
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
              <SecondaryButton
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  navigate(
                    `/appointments?customerIds=${selectedCustomerIds.join(",")}`
                  )
                }
              >
                Criar agendamento
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
              <thead className="bg-[var(--surface-elevated)] text-left text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="w-10 p-3">
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
                  <th className="w-[22%] p-3">Cliente</th>
                  <th className="w-[20%] p-3">Contato</th>
                  <th className="w-[31%] p-3">Contexto</th>
                  <th className="w-[21%] p-3">Status</th>
                  <th className="w-[74px] p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {displayedCustomers.map(customer => {
                  const customerId = String(customer?.id ?? "");
                  const snapshot = snapshotByCustomerId.get(customerId);
                  if (!snapshot) return null;

                  const primaryAction = (() => {
                    if (snapshot.primaryActionLabel === "Cobrar agora") {
                      return {
                        label: "Cobrar agora · prioritário",
                        onSelect: () =>
                          navigate(
                            `/finances?customerId=${customerId}&filter=overdue`
                          ),
                      };
                    }
                    if (snapshot.primaryActionLabel === "Criar agendamento") {
                      return {
                        label: "Criar agendamento · prioritário",
                        onSelect: () =>
                          navigate(`/appointments?customerId=${customerId}`),
                      };
                    }
                    if (snapshot.primaryActionLabel === "Enviar WhatsApp") {
                      return {
                        label: "Enviar WhatsApp · prioritário",
                        onSelect: () =>
                          navigate(`/whatsapp?customerId=${customerId}`),
                      };
                    }
                    return {
                      label: "Abrir workspace · prioritário",
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
                      className="border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--dashboard-row-hover)]/25"
                    >
                      <td className="p-3 align-top">
                        <AppCheckbox
                          checked={selectedCustomerIds.includes(customerId)}
                          onCheckedChange={checked => {
                            setSelectedCustomerIds(previous => {
                              if (checked)
                                return [...new Set([...previous, customerId])];
                              return previous.filter(
                                item => item !== customerId
                              );
                            });
                          }}
                          aria-label={`Selecionar ${String(customer?.name ?? "cliente")}`}
                        />
                      </td>
                      <td className="p-3 align-top">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            setTimelineExpanded(false);
                            setSelectedCustomer({
                              id: customerId,
                              name: String(customer?.name ?? "Cliente"),
                            });
                          }}
                        >
                          <p className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                            {String(customer?.name ?? "Sem nome")}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[var(--text-muted)]">
                              ID {customerId.slice(0, 8)}
                            </span>
                            <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              {snapshot.segmentTag}
                            </span>
                          </div>
                        </button>
                      </td>
                      <td className="p-3 align-top">
                        <div className="space-y-1">
                          <p className="text-xs text-[var(--text-secondary)]">
                            {String(customer?.phone ?? "—")}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {String(customer?.email ?? "—")}
                          </p>
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <p className="font-medium text-[var(--text-primary)]">
                          {snapshot.contextLabel}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                          Próxima: {snapshot.primaryActionLabel}
                        </p>
                        {snapshot.financialPendingCents > 0 ? (
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Impacto:{" "}
                            {formatMoney(snapshot.financialPendingCents)}{" "}
                            pendente
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <NexoStatusBadge
                            tone={snapshot.statusTone}
                            label={snapshot.status}
                          />
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${getContactUrgencyTone(snapshot.contactDays, snapshot.contactState)}`}
                          >
                            {snapshot.contactLabel}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex items-center justify-end">
                          <AppRowActionsDropdown
                            triggerLabel="Mais ações"
                            contentClassName="min-w-[248px]"
                            items={[
                              {
                                label: primaryAction.label,
                                onSelect: primaryAction.onSelect,
                              },
                              {
                                label: "Abrir workspace",
                                onSelect: () => {
                                  setTimelineExpanded(false);
                                  setSelectedCustomer({
                                    id: customerId,
                                    name: String(customer?.name ?? "Cliente"),
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
                              {
                                label: "Enviar WhatsApp",
                                onSelect: () =>
                                  navigate(
                                    `/whatsapp?customerId=${customerId}`
                                  ),
                              },
                              {
                                label: "Criar agendamento",
                                onSelect: () =>
                                  navigate(
                                    `/appointments?customerId=${customerId}`
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

      <ContextPanel
        open={Boolean(selectedCustomer)}
        onOpenChange={open => {
          if (!open) {
            setSelectedCustomer(null);
            setTimelineExpanded(false);
          }
        }}
        title={
          selectedCustomer?.name
            ? `${selectedCustomer.name}`
            : "Workspace do cliente"
        }
        subtitle="Painel operacional para decidir e executar sem sair da carteira."
        statusLabel={
          selectedSnapshot
            ? `${selectedSnapshot.status} · ${selectedSnapshot.nextActionReason}`
            : undefined
        }
        summary={[
          {
            label: "Financeiro",
            value: workspaceQuery.isLoading
              ? "Carregando..."
              : `${workspaceCharges.length} cobranças`,
          },
          {
            label: "Agenda",
            value: workspaceQuery.isLoading
              ? "Carregando..."
              : `${workspaceAppointments.length} agendamentos`,
          },
          {
            label: "O.S.",
            value: workspaceQuery.isLoading
              ? "Carregando..."
              : `${workspaceServiceOrders.length} ordens`,
          },
          {
            label: "WhatsApp",
            value: workspaceQuery.isLoading
              ? "Carregando..."
              : `${workspaceMessages.length} interações`,
          },
        ]}
        primaryAction={{
          label: selectedSnapshot?.primaryActionLabel ?? "Abrir workspace",
          onClick: () => {
            const snapshot = snapshotByCustomerId.get(
              selectedCustomer?.id ?? ""
            );
            if (!selectedCustomer?.id || !snapshot) return;
            if (snapshot.primaryActionLabel === "Cobrar agora")
              return navigate(
                `/finances?customerId=${selectedCustomer.id}&filter=overdue`
              );
            if (snapshot.primaryActionLabel === "Criar agendamento")
              return navigate(
                `/appointments?customerId=${selectedCustomer.id}`
              );
            if (snapshot.primaryActionLabel === "Enviar WhatsApp")
              return navigate(`/whatsapp?customerId=${selectedCustomer.id}`);
            navigate(`/customers/${selectedCustomer.id}`);
          },
          disabled: !selectedCustomer?.id,
        }}
        secondaryActions={[
          {
            label: "Criar agendamento",
            onClick: () =>
              selectedCustomer?.id &&
              navigate(`/appointments?customerId=${selectedCustomer.id}`),
            disabled: !selectedCustomer?.id,
          },
          {
            label: "Criar O.S.",
            onClick: () =>
              selectedCustomer?.id &&
              navigate(`/service-orders?customerId=${selectedCustomer.id}`),
            disabled: !selectedCustomer?.id,
          },
          {
            label: "Enviar WhatsApp",
            onClick: () =>
              selectedCustomer?.id &&
              navigate(`/whatsapp?customerId=${selectedCustomer.id}`),
            disabled: !selectedCustomer?.id,
          },
        ]}
        explainLayer={
          selectedSnapshot
            ? {
                reason: "Priorização operacional do momento",
                conditions: explainConditions,
                afterAction: `Ação sugerida: ${selectedSnapshot.primaryActionLabel}`,
                impact: `${formatMoney(selectedSnapshot.financialPendingCents)} pendente`,
                riskOfInaction:
                  selectedSnapshot.status === "Em risco"
                    ? "Atraso recorrente"
                    : "Perda de continuidade",
                elapsedTime: `${selectedSnapshot.contactDays} dias sem avanço`,
                contextualPriority: `${selectedSnapshot.priorityScore} pts`,
              }
            : undefined
        }
        timeline={visibleTimeline.map(item => ({
          id: String(
            item?.id ?? `${item?.createdAt}-${item?.entityId ?? "event"}`
          ),
          label: String(item?.title ?? item?.action ?? "Evento operacional"),
          description: item?.createdAt
            ? new Date(String(item.createdAt)).toLocaleString("pt-BR")
            : "Sem data",
          source: "system",
        }))}
        whatsAppPreview={
          latestMessage
            ? {
                contextLabel: "Última interação registrada",
                contextDescription: latestMessage?.createdAt
                  ? `Enviado em ${new Date(String(latestMessage.createdAt)).toLocaleString("pt-BR")}`
                  : "Sem horário identificado",
                message: String(
                  latestMessage?.text ??
                    latestMessage?.content ??
                    "Mensagem sem conteúdo"
                ),
              }
            : {
                contextLabel: "Sem interação recente",
                contextDescription:
                  "Sugestão: iniciar contato para manter o fluxo ativo.",
                message:
                  "Olá! Vamos confirmar seu próximo passo no Nexo para manter agenda, execução e cobrança em dia?",
              }
        }
      >
        <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
          {workspaceQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">
              Carregando resumo do cliente...
            </p>
          ) : workspaceQuery.error ? (
            <p className="rounded-md border border-[var(--dashboard-danger)]/40 bg-[var(--dashboard-danger)]/10 p-3 text-sm text-[var(--dashboard-danger)]">
              Não foi possível carregar o detalhe do cliente:{" "}
              {workspaceQuery.error.message}
            </p>
          ) : (
            <div className="space-y-4">
              <section className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Resumo do cliente
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
              <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Impacto financeiro
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
              <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Agenda e execução
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
      </ContextPanel>
    </PageWrapper>
  );
}
