import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  getAppointmentSeverity,
  getOperationalSeverityLabel,
} from "@/lib/operations/operational-intelligence";
import {
  AppDataTable,
  AppFiltersBar,
  AppListBlock,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  appSelectionPillClasses,
  AppSecondaryTabs,
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

  return (
    <PageWrapper
      title="Agenda operacional"
      subtitle="Agendamentos conectados à execução, cliente e comunicação sem quebrar o fluxo atual."
    >
      <div className="space-y-4">
        <AppPageHeader
          title="Agenda operacional de agendamentos"
          description="Visual único para confirmação, risco, execução e próximo passo por cliente."
          cta={
            <ActionFeedbackButton
              state="idle"
              idleLabel="Novo agendamento"
              onClick={() => setOpenCreate(true)}
            />
          }
        />

        <AppSecondaryTabs
          items={[
            { value: "agenda", label: "Agenda" },
            { value: "confirmed", label: "Confirmados" },
            { value: "pending", label: "Pendentes" },
            { value: "conflicts", label: "Conflitos" },
            { value: "history", label: "Histórico" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <AppSectionBlock
          title="Leitura operacional da agenda"
          subtitle="Onde a janela está carregada, o que está em risco e qual ação destrava a operação agora."
        >
          <AppSectionBlock
            title="Painel de execução"
            subtitle="Priorize confirmação, risco e conversão em O.S. sem sair do fluxo atual."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <article className="rounded-lg border border-[var(--dashboard-danger)]/30 bg-[var(--surface-subtle)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Janela crítica
                  </p>
                  <AppStatusBadge
                    label={atRiskList.length > 0 ? "Em risco" : "Estável"}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {atRiskList.length > 0
                    ? `${atRiskList.length} agendamento(s) exigem reação imediata.`
                    : "Sem atraso crítico no momento."}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Priorize conflitos, atrasos e confirmação pendente para manter
                  SLA do dia.
                </p>
              </article>

              <article className="rounded-lg border border-[var(--dashboard-warning)]/30 bg-[var(--surface-subtle)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Concentração operacional
                  </p>
                  <AppStatusBadge
                    label={
                      mostLoadedSlot?.[1] && mostLoadedSlot[1] > 1
                        ? "Atenção"
                        : "Distribuída"
                    }
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {mostLoadedSlot
                    ? `${new Date(mostLoadedSlot[0]).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} com ${mostLoadedSlot[1]} item(ns).`
                    : "Sem concentração relevante."}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Use este pico para redistribuir responsável e reduzir choque
                  de agenda.
                </p>
              </article>

              <article className="rounded-lg border border-[var(--dashboard-info)]/30 bg-[var(--surface-subtle)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Próxima ação recomendada
                  </p>
                  <AppStatusBadge label="Executar" />
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {requiresExecution > 0
                    ? `Converter ${requiresExecution} confirmado(s) em execução/O.S.`
                    : "Focar em confirmação e limpeza de pendências."}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Agendamento confirmado sem execução aberta reduz
                  previsibilidade operacional.
                </p>
              </article>
            </div>
          </AppSectionBlock>
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Fila acionável
            </p>
            <AppListBlock
              className="col-span-full"
              compact
              showPlaceholders={false}
              items={
                atRiskList.length > 0
                  ? atRiskList.slice(0, 4).map(({ item, nextAction }) => ({
                      title: `${String(item?.customer?.name ?? "Cliente")} · ${mapOperationalState(item, true)}`,
                      subtitle: `${safeDate(item?.startsAt)?.toLocaleString("pt-BR") ?? "sem horário"} · Próxima ${nextAction}`,
                      action: (
                        <button
                          className="nexo-cta-secondary"
                          onClick={() =>
                            navigate(`/whatsapp?customerId=${item?.customerId}`)
                          }
                        >
                          Atuar
                        </button>
                      ),
                    }))
                  : [
                      {
                        title: "Sem gargalos críticos no momento",
                        subtitle:
                          "Acompanhe os confirmados e inicie execução preventiva.",
                        action: (
                          <button
                            className="nexo-cta-secondary"
                            onClick={() => navigate("/service-orders")}
                          >
                            Abrir execução
                          </button>
                        ),
                      },
                    ]
              }
            />
          </div>
        </AppSectionBlock>

        <OperationalTopCard
          contextLabel="Modo ativo da agenda"
          title={
            activeTab === "agenda"
              ? "Orquestrar agenda do turno atual"
              : activeTab === "confirmed"
                ? "Converter confirmados em execução"
                : activeTab === "pending"
                  ? "Fechar confirmações pendentes"
                  : activeTab === "conflicts"
                    ? "Resolver conflitos de horário"
                    : "Auditar histórico e reincidências"
          }
          description={
            activeTab === "agenda"
              ? "Visão geral do dia com foco em sequência operacional e prevenção de atrasos."
              : activeTab === "confirmed"
                ? "Priorize os confirmados para abrir O.S. e não perder janela de atendimento."
                : activeTab === "pending"
                  ? "Concentre esforços em confirmação e lembretes para manter previsibilidade."
                  : activeTab === "conflicts"
                    ? "Isole sobreposição e atrasos para destravar capacidade do time."
                    : "Use histórico para corrigir padrões e reduzir recorrência de falhas."
          }
          primaryAction={
            <ActionFeedbackButton
              state="idle"
              idleLabel={
                activeTab === "confirmed"
                  ? "Criar O.S. dos confirmados"
                  : activeTab === "pending"
                    ? "Executar confirmações"
                    : activeTab === "conflicts"
                      ? "Atuar nos conflitos"
                      : activeTab === "history"
                        ? "Revisar reincidências"
                        : "Organizar turno atual"
              }
              onClick={() => {
                if (activeTab === "confirmed") navigate("/service-orders");
                else if (activeTab === "history") setActiveTab("agenda");
                else if (activeTab === "pending") setWindowFilter("today");
                else setActiveTab("conflicts");
              }}
            />
          }
        />

        <div className="space-y-4">
          <AppSectionBlock
            title={
              activeTab === "history"
                ? "Histórico de agendamentos"
                : "Agenda operacional"
            }
            subtitle="Lista principal com filtros por estado, janela e cliente para ação rápida."
          >
            <AppFiltersBar className="mb-3 gap-3">
              <div className="min-w-[220px] flex-1">
                <Input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Buscar por cliente, título ou ID"
                  className="h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "today", label: "Hoje" },
                  { key: "next7", label: "Próximos 7 dias" },
                  { key: "overdue", label: "Atrasados" },
                  { key: "all", label: "Tudo" },
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    className={appSelectionPillClasses(
                      windowFilter === item.key
                    )}
                    onClick={() => setWindowFilter(item.key as WindowFilter)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <select
                className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
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

              <select
                className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
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
            </AppFiltersBar>

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
