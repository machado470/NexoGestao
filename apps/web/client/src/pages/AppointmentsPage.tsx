import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { AppOperationalModal } from "@/components/operating-system/AppOperationalModal";
import {
  EmptyActionState,
  explainOperationalError,
  OperationalAutomationNote,
  OperationalFlowState,
  OperationalInlineFeedback,
  OperationalNextAction,
  OperationalRelationSummary,
} from "@/components/operating-system/OperationalRefinementBlocks";
import {
  getAppointmentSeverity,
  getOperationalSeverityLabel,
} from "@/lib/operations/operational-intelligence";
import {
  OPERATIONAL_NEXT_ACTION_CLASS,
  OPERATIONAL_PRIMARY_CTA_CLASS,
  resolveOperationalActionLabel,
  toSingleLineAction,
} from "@/lib/operations/operational-list";
import {
  AppOperationalBar,
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  appSelectionPillClasses,
  AppSectionBlock,
  AppPriorityBadge,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { SecondaryButton } from "@/components/design-system";
import { inRange, safeDate } from "@/lib/operational/kpi";
import { toast } from "sonner";

type TabKey = "agenda" | "confirmed" | "pending" | "conflicts" | "history";
type WindowFilter = "all" | "today" | "next7" | "overdue";

type AppointmentLike = {
  id?: string;
  customerId?: string;
  customer?: { id?: string; name?: string };
  assignedToPersonId?: string | null;
  personId?: string | null;
  title?: string | null;
  status?: string | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
};

function mapOperationalState(item: AppointmentLike, hasConflict: boolean) {
  const severity = getAppointmentSeverity(item);
  const status = String(item?.status ?? "").toUpperCase();

  if (status === "DONE") return "Concluído";
  if (status === "CANCELED") return "Cancelado";
  if (status === "NO_SHOW") return "Não compareceu";
  if (status === "CONFIRMED") return hasConflict ? "Em risco" : "Confirmado";
  if (hasConflict || severity === "critical") return "Em risco";
  return status === "SCHEDULED"
    ? "Pendente"
    : getOperationalSeverityLabel(severity);
}

function getNextAction(item: AppointmentLike) {
  const status = String(item?.status ?? "").toUpperCase();
  const start = safeDate(item?.startsAt);
  const now = new Date();
  const overdueDays =
    start && start < now
      ? Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
  if (status === "SCHEDULED")
    return overdueDays > 0
      ? "Confirmar cliente"
      : "Confirmar atendimento";
  if (status === "CONFIRMED") return "Criar O.S.";
  if (status === "DONE") return "Revisar execução";
  return "Contatar cliente";
}

export default function AppointmentsPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [activeTab, setActiveTab] = useOperationalMemoryState<TabKey>(
    "nexo.appointments.tab.v1",
    "agenda"
  );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState(
    "nexo.appointments.search.v1",
    ""
  );
  const [statusFilter, setStatusFilter] = useOperationalMemoryState(
    "nexo.appointments.status-filter.v1",
    "all"
  );
  const [windowFilter, setWindowFilter] = useOperationalMemoryState<WindowFilter>(
    "nexo.appointments.window-filter.v1",
    "today"
  );
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState(
    "nexo.appointments.customer-filter.v1",
    "all"
  );
  const [focusedAppointmentId, setFocusedAppointmentId] = useState<string>("");
  const [openOperationalModal, setOpenOperationalModal] = useState(false);
  const [openServiceOrderCreate, setOpenServiceOrderCreate] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionFeedbackTone, setActionFeedbackTone] = useState<
    "neutral" | "success" | "error"
  >("neutral");

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    retry: false,
  });
  const updateAppointment = trpc.nexo.appointments.update.useMutation();

  const customers = useMemo(
    () => normalizeArrayPayload<any>(customersQuery.data),
    [customersQuery.data]
  );
  const appointments = useMemo(
    () => normalizeArrayPayload<AppointmentLike>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const people = useMemo(
    () => normalizeArrayPayload<any>(peopleQuery.data),
    [peopleQuery.data]
  );
  const hasData = appointments.length > 0;
  const showInitialLoading = appointmentsQuery.isLoading && !hasData;
  const showErrorState = appointmentsQuery.error && !hasData;

  usePageDiagnostics({
    page: "appointments",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty:
      !showInitialLoading && !showErrorState && appointments.length === 0,
    dataCount: appointments.length,
  });

  const appointmentsBySlot = useMemo(
    () =>
      appointments.reduce<Record<string, number>>((acc, item) => {
        const slot = safeDate(item?.startsAt)?.toISOString().slice(0, 16) ?? "";
        if (!slot) return acc;
        acc[slot] = (acc[slot] ?? 0) + 1;
        return acc;
      }, {}),
    [appointments]
  );

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
  const next7End = new Date(dayEnd);
  next7End.setDate(next7End.getDate() + 7);

  const appointmentWithContext = useMemo(() => {
    return appointments.map(item => {
      const slot = safeDate(item?.startsAt)?.toISOString().slice(0, 16) ?? "";
      const hasConflict = Boolean(slot && (appointmentsBySlot[slot] ?? 0) > 1);
      const status = String(item?.status ?? "").toUpperCase();
      const start = safeDate(item?.startsAt);
      const isDelayed = Boolean(
        start && start < now && ["SCHEDULED", "CONFIRMED"].includes(status)
      );
      const operationalState = mapOperationalState(
        item,
        hasConflict || isDelayed
      );
      return {
        item,
        hasConflict,
        isDelayed,
        operationalState,
        nextAction: getNextAction(item),
      };
    });
  }, [appointments, appointmentsBySlot, now]);

  const filteredAppointments = useMemo(() => {
    let base = appointmentWithContext;

    if (activeTab === "confirmed") {
      base = base.filter(
        ({ item }) => String(item?.status ?? "").toUpperCase() === "CONFIRMED"
      );
    } else if (activeTab === "pending") {
      base = base.filter(
        ({ item }) => String(item?.status ?? "").toUpperCase() === "SCHEDULED"
      );
    } else if (activeTab === "conflicts") {
      base = base.filter(({ hasConflict }) => hasConflict);
    } else if (activeTab === "history") {
      base = [...base].sort(
        (a, b) =>
          (safeDate(b.item?.startsAt)?.getTime() ?? 0) -
          (safeDate(a.item?.startsAt)?.getTime() ?? 0)
      );
    }

    if (statusFilter !== "all") {
      base = base.filter(
        ({ item }) => String(item?.status ?? "").toUpperCase() === statusFilter
      );
    }

    if (windowFilter === "today") {
      base = base.filter(({ item }) =>
        inRange(safeDate(item?.startsAt), dayStart, dayEnd)
      );
    } else if (windowFilter === "next7") {
      base = base.filter(({ item }) =>
        inRange(safeDate(item?.startsAt), dayStart, next7End)
      );
    } else if (windowFilter === "overdue") {
      base = base.filter(({ isDelayed }) => isDelayed);
    }

    if (customerFilter !== "all") {
      base = base.filter(
        ({ item }) => String(item?.customerId ?? "") === customerFilter
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      base = base.filter(({ item }) => {
        const name = String(item?.customer?.name ?? "").toLowerCase();
        const title = String(item?.title ?? "").toLowerCase();
        const id = String(item?.id ?? "");
        return name.includes(term) || title.includes(term) || id.includes(term);
      });
    }

    return base;
  }, [
    activeTab,
    appointmentWithContext,
    customerFilter,
    dayEnd,
    dayStart,
    next7End,
    searchTerm,
    statusFilter,
    windowFilter,
  ]);

  useEffect(() => {
    if (filteredAppointments.length === 0) {
      setFocusedAppointmentId("");
      return;
    }
    const hasFocused = filteredAppointments.some(
      ({ item }) => String(item?.id ?? "") === focusedAppointmentId
    );
    if (!hasFocused) {
      setFocusedAppointmentId(String(filteredAppointments[0]?.item?.id ?? ""));
    }
  }, [filteredAppointments, focusedAppointmentId]);

  const focused =
    filteredAppointments.find(
      ({ item }) => String(item?.id ?? "") === focusedAppointmentId
    ) ?? filteredAppointments[0];

  const executeStatusUpdate = async (status: "CONFIRMED" | "CANCELED") => {
    if (!focused?.item?.id) return;
    try {
      setActionFeedbackTone("neutral");
      setActionFeedback("Processando ação...");
      await updateAppointment.mutateAsync({
        id: String(focused.item.id),
        status,
      } as any);
      setActionFeedback(
        status === "CONFIRMED"
          ? "Agendamento confirmado com sucesso."
          : "Agendamento cancelado com sucesso."
      );
      setActionFeedbackTone("success");
      await appointmentsQuery.refetch();
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Falha ao atualizar agendamento.";
      const message = explainOperationalError({
        fallback: rawMessage,
        cause:
          status === "CONFIRMED"
            ? "Não foi possível confirmar este agendamento no momento."
            : "Não foi possível cancelar este agendamento no momento.",
        suggestion:
          status === "CONFIRMED"
            ? "Verifique conflito de horário ou status atual e tente novamente."
            : "Confirme se o agendamento já não foi concluído antes de cancelar.",
      });
      setActionFeedbackTone("error");
      setActionFeedback(message);
      toast.error(message);
    }
  };

  const headerCta = (() => {
    if (activeTab === "confirmed") {
      return {
        label: "Converter em O.S.",
        onClick: () => navigate("/service-orders"),
      };
    }
    if (activeTab === "pending") {
      return {
        label: "Confirmar / contatar",
        onClick: () => navigate("/whatsapp"),
      };
    }
    if (activeTab === "conflicts") {
      return {
        label: "Reorganizar agenda",
        onClick: () => setWindowFilter("overdue"),
      };
    }
    if (activeTab === "history") {
      return {
        label: "Voltar para agenda",
        onClick: () => setActiveTab("agenda"),
      };
    }
    return { label: "Novo agendamento", onClick: () => setOpenCreate(true) };
  })();
  const selectedCustomerName =
    customerFilter === "all"
      ? ""
      : String(
          customers.find(item => String(item?.id ?? "") === customerFilter)
            ?.name ?? "Cliente"
        );

  return (
    <PageWrapper
      title="Agenda operacional"
      subtitle="Confirme, execute e avance para O.S. sem sair da agenda."
    >
      <div className="space-y-4">
        <AppPageHeader
          title={
            activeTab === "confirmed"
              ? "Agendamentos confirmados"
              : activeTab === "pending"
                ? "Pendências de confirmação"
                : activeTab === "conflicts"
                  ? "Conflitos de agenda"
                  : activeTab === "history"
                    ? "Histórico de agendamentos"
                    : "Agenda operacional de agendamentos"
          }
          description={
            activeTab === "confirmed"
              ? "Foco em confirmados para converter em execução/O.S."
              : activeTab === "pending"
                ? "Fila acionável para confirmação e contato por cliente."
                : activeTab === "conflicts"
                  ? "Choques de agenda, atrasos e risco operacional."
                  : activeTab === "history"
                    ? "Concluídos, cancelados e eventos passados para leitura histórica."
                    : "Visual do turno/dia para sequência operacional e prevenção de atraso."
          }
          cta={
            <ActionFeedbackButton
              state="idle"
              idleLabel={headerCta.label}
              onClick={headerCta.onClick}
            />
          }
        />

        <AppOperationalBar
          tabs={[
            { value: "agenda", label: "Agenda" },
            { value: "confirmed", label: "Confirmados" },
            { value: "pending", label: "Pendentes" },
            { value: "conflicts", label: "Conflitos" },
            { value: "history", label: "Histórico" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por cliente, título ou ID"
          quickFilters={
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "today", label: "Hoje" },
                { key: "next7", label: "Próx. 7 dias" },
                { key: "overdue", label: "Atrasados" },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={appSelectionPillClasses(windowFilter === item.key)}
                  onClick={() => setWindowFilter(item.key as WindowFilter)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
          advancedFiltersLabel="Filtros"
          advancedFiltersContent={
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Janela
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={windowFilter}
                  onChange={event =>
                    setWindowFilter(event.target.value as WindowFilter)
                  }
                >
                  <option value="today">Hoje</option>
                  <option value="next7">Próximos 7 dias</option>
                  <option value="overdue">Atrasados</option>
                  <option value="all">Tudo</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Status
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                >
                  <option value="all">Todos os status</option>
                  <option value="SCHEDULED">Agendado</option>
                  <option value="CONFIRMED">Confirmado</option>
                  <option value="DONE">Concluído</option>
                  <option value="CANCELED">Cancelado</option>
                  <option value="NO_SHOW">Não compareceu</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Cliente
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={customerFilter}
                  onChange={event => setCustomerFilter(event.target.value)}
                >
                  <option value="all">Todos os clientes</option>
                  {customers.map(customer => (
                    <option key={String(customer.id)} value={String(customer.id)}>
                      {String(customer.name ?? "Cliente")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          activeFilterChips={[
            ...(windowFilter === "all"
              ? [
                  {
                    key: "window-all",
                    label: "Janela: Tudo",
                    onRemove: () => setWindowFilter("today"),
                  },
                ]
              : []),
            ...(statusFilter !== "all"
              ? [
                  {
                    key: "status",
                    label: `Status: ${statusFilter}`,
                    onRemove: () => setStatusFilter("all"),
                  },
                ]
              : []),
            ...(customerFilter !== "all"
              ? [
                  {
                    key: "customer",
                    label: `Cliente: ${selectedCustomerName}`,
                    onRemove: () => setCustomerFilter("all"),
                  },
                ]
              : []),
          ]}
          onClearAllFilters={() => {
            setWindowFilter("today");
            setStatusFilter("all");
            setCustomerFilter("all");
          }}
        />

        <div className="space-y-4">
          <AppSectionBlock
            title={
              activeTab === "agenda"
                ? "Visão diária da agenda"
                : activeTab === "confirmed"
                  ? "Confirmados prontos para execução"
                  : activeTab === "pending"
                    ? "Fila de confirmação pendente"
                    : activeTab === "conflicts"
                      ? "Conflitos e gargalos da agenda"
                      : "Histórico de agendamentos"
            }
            subtitle="Lista principal com filtros por estado, janela e cliente para ação rápida."
          >
            {showInitialLoading ? (
              <AppPageLoadingState description="Carregando agendamentos..." />
            ) : showErrorState ? (
              <AppPageErrorState
                description={
                  appointmentsQuery.error?.message ??
                  "Falha ao carregar agendamentos."
                }
                actionLabel="Tentar novamente"
                onAction={() => void appointmentsQuery.refetch()}
              />
            ) : filteredAppointments.length === 0 ? (
              <AppPageEmptyState
                title="Nenhum dado disponível ainda"
                description="Ação recomendada: criar agendamento"
              />
            ) : (
              <AppDataTable>
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-[var(--surface-elevated)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      <tr>
                        <th className="w-[18%] px-4 py-2.5 text-left align-middle">Início</th>
                        <th className="w-[24%] px-4 py-2.5 text-left align-middle">Cliente</th>
                        <th className="w-[18%] px-4 py-2.5 text-left align-middle">Status</th>
                        <th className="w-[12%] px-4 py-2.5 text-left align-middle">Prioridade</th>
                        <th className="w-[22%] px-4 py-2.5 text-left align-middle">Próxima ação</th>
                        <th className="w-[156px] px-4 py-2.5 text-right align-middle">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map(
                        ({
                          item,
                          hasConflict,
                          isDelayed,
                          operationalState,
                          nextAction,
                        }) => {
                          const status = String(
                            item?.status ?? ""
                          ).toUpperCase();
                          const priorityLabel =
                            hasConflict || status === "SCHEDULED"
                              ? "HIGH"
                              : status === "CONFIRMED"
                                ? "MEDIUM"
                                : "LOW";
                          const handlePrimaryAction = () => {
                            if (nextAction === "Criar O.S.") {
                              setFocusedAppointmentId(String(item?.id ?? ""));
                              setOpenServiceOrderCreate(true);
                              return;
                            }
                            setFocusedAppointmentId(String(item?.id ?? ""));
                            setOpenOperationalModal(true);
                          };

                          return (
                          <tr
                            key={String(item?.id)}
                            className={`cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60 focus-within:bg-[var(--surface-subtle)]/70 ${
                              String(item?.id ?? "") === focusedAppointmentId
                                ? "bg-[var(--accent-soft)]/40"
                                : ""
                            }`}
                            onClick={() => {
                              setFocusedAppointmentId(String(item?.id ?? ""));
                              setOpenOperationalModal(true);
                            }}
                          >
                              <td className="px-4 py-3.5 align-top">
                                <p className="whitespace-nowrap text-sm font-semibold leading-5 text-[var(--text-primary)]">
                                  {safeDate(item?.startsAt)?.toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }) ?? "—"}
                                </p>
                                <p className="whitespace-nowrap text-[11px] text-[var(--text-muted)]">
                                  {safeDate(item?.startsAt)?.toLocaleDateString("pt-BR") ?? "—"}
                                </p>
                                {hasConflict ? (
                                  <p className="mt-1 truncate text-[11px] text-[var(--dashboard-danger)]">
                                    Conflito de horário
                                  </p>
                                ) : isDelayed ? (
                                  <p className="mt-1 truncate text-[11px] text-[var(--dashboard-danger)]">
                                    Atendimento atrasado
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                <p className="truncate text-sm font-medium leading-5 text-[var(--text-primary)]">
                                  {String(item?.customer?.name ?? "Cliente")}
                                </p>
                                <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
                                  #{String(item?.customerId ?? "—")}
                                </p>
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                <AppStatusBadge label={operationalState} />
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                <AppPriorityBadge label={priorityLabel} />
                              </td>
                              <td className="px-4 py-3.5 align-top text-xs text-[var(--text-secondary)]">
                                <button
                                  type="button"
                                  className={`${OPERATIONAL_NEXT_ACTION_CLASS} text-[var(--accent-primary)] hover:underline`}
                                  onClick={event => {
                                    event.stopPropagation();
                                    handlePrimaryAction();
                                  }}
                                  title={nextAction}
                                >
                                  {toSingleLineAction(nextAction)}
                                </button>
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                <div className="flex items-center justify-end gap-2">
                                  <SecondaryButton
                                    type="button"
                                    className={OPERATIONAL_PRIMARY_CTA_CLASS}
                                    onClick={event => {
                                      event.stopPropagation();
                                      handlePrimaryAction();
                                    }}
                                  >
                                    {resolveOperationalActionLabel(nextAction)}
                                  </SecondaryButton>
                                  <AppRowActionsDropdown
                                    triggerLabel="Mais ações"
                                    contentClassName="min-w-[232px]"
                                    items={[
                                      {
                                        label: `${nextAction} · prioritário`,
                                        onSelect: handlePrimaryAction,
                                      },
                                      {
                                        label: "Criar O.S.",
                                        onSelect: () =>
                                          navigate(
                                            `/service-orders?customerId=${item.customerId}&appointmentId=${item.id}`
                                          ),
                                      },
                                      {
                                        label: "Enviar WhatsApp",
                                        onSelect: () =>
                                          navigate(
                                            `/whatsapp?customerId=${item.customerId}`
                                          ),
                                      },
                                    ]}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
              </AppDataTable>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Central operacional do agendamento"
            subtitle="Clique em um item para abrir detalhe completo sem sair da página."
            compact
          >
            <p className="text-xs text-[var(--text-muted)]">
              {focused
                ? `Em foco: ${String(focused.item?.customer?.name ?? "Cliente")} · ${focused.nextAction}`
                : "Selecione um agendamento para abrir o detalhe operacional."}
            </p>
          </AppSectionBlock>
        </div>
      </div>

      <AppOperationalModal
        open={openOperationalModal && Boolean(focused)}
        onOpenChange={open => {
          setOpenOperationalModal(open);
          if (!open) {
            setActionFeedback(null);
            setActionFeedbackTone("neutral");
          }
        }}
        title={String(focused?.item?.title ?? focused?.item?.customer?.name ?? "Agendamento")}
        subtitle={String(focused?.item?.customer?.name ?? "Cliente não identificado")}
        status={focused?.operationalState}
        priority={
          focused?.hasConflict || focused?.isDelayed
            ? "Prioridade alta"
            : "Prioridade operacional"
        }
        summary={[
          {
            label: "Início",
            value: safeDate(focused?.item?.startsAt)?.toLocaleString("pt-BR") ?? "—",
          },
          {
            label: "Fim",
            value: safeDate(focused?.item?.endsAt)?.toLocaleString("pt-BR") ?? "Não definido",
          },
          {
            label: "Status",
            value: String(focused?.item?.status ?? "—"),
          },
          { label: "Próxima ação", value: focused?.nextAction ?? "—" },
        ]}
        primaryAction={{
          label: focused?.nextAction?.split("—")[0]?.trim() ?? "Executar ação",
          onClick: () => {
            if (!focused) return;
            if (focused.nextAction.startsWith("Confirmar agora")) {
              void executeStatusUpdate("CONFIRMED");
              return;
            }
            if (focused.nextAction.startsWith("Criar O.S.")) {
              setOpenServiceOrderCreate(true);
              return;
            }
            navigate(`/whatsapp?customerId=${focused.item?.customerId}`);
          },
          disabled: updateAppointment.isPending,
          processing: updateAppointment.isPending,
        }}
        secondaryAction={{
          label: "Cancelar",
          onClick: () => {
            if (
              typeof window !== "undefined" &&
              !window.confirm("Cancelar este agendamento agora?")
            ) {
              return;
            }
            void executeStatusUpdate("CANCELED");
          },
          disabled: updateAppointment.isPending || !focused,
        }}
        quickActions={[
          {
            label: "Remarcar +1 dia",
            onClick: async () => {
              if (!focused?.item?.id || !focused.item?.startsAt) return;
              const start = safeDate(focused.item.startsAt);
              if (!start) return;
              const end = safeDate(focused.item.endsAt);
              start.setDate(start.getDate() + 1);
              if (end) end.setDate(end.getDate() + 1);
              try {
                setActionFeedbackTone("neutral");
                setActionFeedback("Remarcando agendamento...");
                await updateAppointment.mutateAsync({
                  id: String(focused.item.id),
                  startsAt: start.toISOString(),
                  endsAt: end?.toISOString(),
                } as any);
                setActionFeedback("Agendamento remarcado para o próximo dia.");
                setActionFeedbackTone("success");
                await appointmentsQuery.refetch();
              } catch (error) {
                setActionFeedbackTone("error");
                setActionFeedback("Falha ao remarcar.");
              }
            },
            disabled: updateAppointment.isPending || !focused,
          },
          {
            label: "Criar O.S.",
            onClick: () => setOpenServiceOrderCreate(true),
            disabled: !focused,
          },
          {
            label: "WhatsApp",
            onClick: () =>
              focused &&
              navigate(`/whatsapp?customerId=${focused.item?.customerId}`),
            disabled: !focused,
          },
        ]}
        feedback={actionFeedback}
        feedbackTone={actionFeedbackTone}
      >
        <div className="space-y-4">
          {focused ? (
            <OperationalNextAction
              title={focused.nextAction}
              reason={
                focused.hasConflict
                  ? "Há conflito de agenda e risco de perda de atendimento."
                  : focused.isDelayed
                    ? "A janela prevista já passou e exige reação imediata."
                    : "Esta ação mantém o fluxo entre agenda e execução."
              }
              urgency={
                focused.hasConflict || focused.isDelayed
                  ? "Urgente"
                  : "Prioridade operacional"
              }
              impact={focused.isDelayed ? "Reduz no-show e atraso" : "Mantém sequência de atendimento"}
            />
          ) : null}
          <OperationalFlowState
            steps={[
              { label: "Cliente", state: "done" },
              { label: "Agendamento", state: "current" },
              {
                label: "O.S.",
                state: String(focused?.item?.status ?? "").toUpperCase() === "CONFIRMED" ? "pending" : "done",
              },
              { label: "Cobrança", state: "pending" },
              { label: "Pagamento", state: "pending" },
            ]}
          />
          <section className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Contexto operacional
            </p>
            <p className="text-sm text-[var(--text-primary)]">
              {focused?.hasConflict
                ? "Conflito de agenda detectado. Priorize confirmação ou remarcação."
                : focused?.isDelayed
                  ? "Agendamento atrasado. Ação imediata reduz no-show."
                  : "Fluxo dentro do planejado para execução."}
            </p>
          </section>
          <OperationalRelationSummary
            title="Entidades conectadas"
            items={[
              `Este agendamento está vinculado ao cliente ${String(focused?.item?.customer?.name ?? "não identificado")}.`,
              `Status atual: ${String(focused?.item?.status ?? "não informado")} com próxima ação "${focused?.nextAction ?? "—"}".`,
              "Ao confirmar, o próximo passo recomendado é gerar O.S. e avançar para cobrança.",
            ]}
          />
          {String(focused?.item?.status ?? "").toUpperCase() === "CONFIRMED" ? (
            <OperationalAutomationNote detail="Após criar a O.S., este agendamento sai automaticamente da fila pendente e entra na trilha de execução." />
          ) : null}
          {String(focused?.item?.status ?? "").toUpperCase() === "CONFIRMED" ? (
            <EmptyActionState
              title="Atendimento confirmado e pronto para execução"
              description="Ainda não há garantia de execução operacional. Crie uma O.S. para continuar o fluxo."
              ctaLabel="Criar O.S."
              onCta={() => setOpenServiceOrderCreate(true)}
            />
          ) : null}
          <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Timeline curta
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--text-secondary)]">
              <li>Agendamento criado e vinculado ao cliente.</li>
              <li>Status atual: {String(focused?.item?.status ?? "—")}.</li>
              <li>Próxima melhor ação: {focused?.nextAction ?? "—"}.</li>
            </ul>
          </section>
          {actionFeedback ? (
            <OperationalInlineFeedback
              tone={actionFeedbackTone}
              nextStep={
                actionFeedbackTone === "success"
                  ? "Revisar o próximo item da agenda para manter o ritmo do turno."
                  : undefined
              }
            >
              {actionFeedback}
            </OperationalInlineFeedback>
          ) : null}
        </div>
      </AppOperationalModal>
      <CreateAppointmentModal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={() => {
          void appointmentsQuery.refetch();
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
          setActionFeedback("O.S. criada com vínculo ao agendamento.");
        }}
        customers={customers.map(item => ({
          id: String(item.id),
          name: String(item.name ?? "Cliente"),
        }))}
        people={people.map(item => ({
          id: String(item.id),
          name: String(item.name ?? "Pessoa"),
        }))}
        initialCustomerId={focused?.item?.customerId ? String(focused.item.customerId) : null}
        appointmentId={focused?.item?.id ? String(focused.item.id) : null}
      />
    </PageWrapper>
  );
}
