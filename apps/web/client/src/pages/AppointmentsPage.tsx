import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  getAppointmentSeverity,
  getOperationalSeverityLabel,
} from "@/lib/operations/operational-intelligence";
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
import { getDayWindow, inRange, safeDate } from "@/lib/operational/kpi";

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
  if (status === "SCHEDULED") return "Confirmar";
  if (status === "CONFIRMED") return "Criar O.S.";
  if (status === "DONE") return "Revisar execução";
  return "Contato no WhatsApp";
}

export default function AppointmentsPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("agenda");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("today");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [focusedAppointmentId, setFocusedAppointmentId] = useState<string>("");

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    retry: false,
  });

  const customers = useMemo(
    () => normalizeArrayPayload<any>(customersQuery.data),
    [customersQuery.data]
  );
  const appointments = useMemo(
    () => normalizeArrayPayload<AppointmentLike>(appointmentsQuery.data),
    [appointmentsQuery.data]
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

  const todayWindow = getDayWindow(0);

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

  const atRiskList = appointmentWithContext
    .filter(
      ({ hasConflict, isDelayed, operationalState }) =>
        hasConflict || isDelayed || operationalState === "Em risco"
    )
    .sort(
      (a, b) =>
        (safeDate(a.item?.startsAt)?.getTime() ?? 0) -
        (safeDate(b.item?.startsAt)?.getTime() ?? 0)
    );

  const requiresExecution = appointmentWithContext.filter(
    ({ item }) => String(item?.status ?? "").toUpperCase() === "CONFIRMED"
  ).length;
  const mostLoadedSlot = Object.entries(appointmentsBySlot).sort(
    (a, b) => b[1] - a[1]
  )[0];

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
      subtitle="Agendamentos conectados à execução, cliente e comunicação sem quebrar o fluxo atual."
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
              <div className="max-h-[540px] overflow-y-auto">
                <AppDataTable>
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                      <tr>
                        <th className="p-3 text-left">Início</th>
                        <th className="text-left">Cliente</th>
                        <th className="text-left">Estado operacional</th>
                        <th className="text-left">Prioridade</th>
                        <th className="text-left">Próxima ação</th>
                        <th className="w-[112px] p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map(
                        ({
                          item,
                          hasConflict,
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
                              navigate(
                                `/service-orders?customerId=${item.customerId}&appointmentId=${item.id}`
                              );
                              return;
                            }
                            navigate(`/whatsapp?customerId=${item.customerId}`);
                          };

                          return (
                            <tr
                              key={String(item?.id)}
                              className="cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60"
                              onClick={() =>
                                setFocusedAppointmentId(String(item?.id ?? ""))
                              }
                            >
                              <td className="p-3 align-top">
                                {safeDate(item?.startsAt)?.toLocaleString(
                                  "pt-BR"
                                ) ?? "—"}
                                {hasConflict ? (
                                  <p className="text-xs text-[var(--dashboard-danger)]">
                                    Conflito de horário detectado
                                  </p>
                                ) : null}
                              </td>
                              <td className="align-top">
                                <p className="font-medium text-[var(--text-primary)]">
                                  {String(item?.customer?.name ?? "Cliente")}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                  #{String(item?.customerId ?? "—")}
                                </p>
                              </td>
                              <td className="align-top">
                                <AppStatusBadge label={operationalState} />
                              </td>
                              <td className="align-top">
                                <AppPriorityBadge label={priorityLabel} />
                              </td>
                              <td className="align-top text-xs text-[var(--text-secondary)]">
                                {nextAction}
                              </td>
                              <td className="p-3 align-top">
                                <div className="flex items-center justify-end gap-2">
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
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Workspace do agendamento"
            subtitle="Contexto do item em foco conectado com cliente, execução e comunicação."
            compact
          >
            {focused ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {String(focused.item?.customer?.name ?? "Cliente")}
                    </p>
                    <AppStatusBadge label={focused.operationalState} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Início:{" "}
                    {safeDate(focused.item?.startsAt)?.toLocaleString(
                      "pt-BR"
                    ) ?? "—"}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Fim:{" "}
                    {safeDate(focused.item?.endsAt)?.toLocaleString("pt-BR") ??
                      "Não definido"}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Próxima ação recomendada: {focused.nextAction}.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    className="nexo-cta-primary"
                    onClick={() =>
                      navigate(
                        `/service-orders?customerId=${focused.item?.customerId}&appointmentId=${focused.item?.id}`
                      )
                    }
                  >
                    Converter em O.S.
                  </button>
                  <button
                    type="button"
                    className="nexo-cta-secondary"
                    onClick={() =>
                      navigate(
                        `/customers?customerId=${focused.item?.customerId}`
                      )
                    }
                  >
                    Abrir cliente
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Selecione um agendamento para ver o contexto operacional e
                executar o próximo passo.
              </p>
            )}
          </AppSectionBlock>
        </div>
      </div>

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
    </PageWrapper>
  );
}
