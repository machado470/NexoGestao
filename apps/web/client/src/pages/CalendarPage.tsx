import { useMemo, useState } from "react";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { AlertTriangle, CheckCircle2, Clock3, MessageSquare, Plus, RefreshCcw } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import { AppToolbar, AppTimeline, AppTimelineItem } from "@/components/app-system";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import {
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppPriorityBadge,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";

type ViewMode = "timeGridDay" | "timeGridWeek" | "dayGridMonth";

type Appointment = {
  id: string;
  customerId: string;
  assignedToPersonId?: string | null;
  customer?: { id: string; name: string } | null;
  startsAt: string;
  endsAt?: string | null;
  status: "SCHEDULED" | "CONFIRMED" | "DONE" | "CANCELED" | "NO_SHOW";
  title?: string | null;
  notes?: string | null;
};

const STATUS_COLOR: Record<Appointment["status"], string> = {
  SCHEDULED: "#f59e0b",
  CONFIRMED: "#22c55e",
  DONE: "#10b981",
  CANCELED: "#ef4444",
  NO_SHOW: "#71717a",
};

const STATUS_LABEL: Record<Appointment["status"], string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  DONE: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

function normalizeEventStatus(status: string) {
  if (status === "CANCELED") return "Cancelado";
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "DONE") return "Concluído";
  if (status === "NO_SHOW") return "Não compareceu";
  return "Agendado";
}

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useOperationalMemoryState<ViewMode>("nexo.calendar.view.v1", "timeGridWeek");
  const [selectedId, setSelectedId] = useOperationalMemoryState<string | null>("nexo.calendar.selected-id.v1", null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [teamFilter, setTeamFilter] = useOperationalMemoryState("nexo.calendar.team-filter.v1", "all");
  const [serviceFilter, setServiceFilter] = useOperationalMemoryState("nexo.calendar.service-filter.v1", "all");
  const [statusFilter, setStatusFilter] = useOperationalMemoryState("nexo.calendar.status-filter.v1", "all");
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState("nexo.calendar.customer-filter.v1", "all");

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const updateAppointment = trpc.nexo.appointments.update.useMutation();

  const appointments = useMemo(
    () => normalizeArrayPayload<Appointment>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const customers = useMemo(
    () => normalizeArrayPayload<{ id: string; name: string }>(customersQuery.data),
    [customersQuery.data]
  );
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(item => {
      const teamOk = teamFilter === "all" || String(item.assignedToPersonId ?? "") === teamFilter;
      const serviceOk = serviceFilter === "all" || String(item.title ?? "").toLowerCase().includes(serviceFilter.toLowerCase());
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const customerOk = customerFilter === "all" || item.customerId === customerFilter;
      return teamOk && serviceOk && statusOk && customerOk;
    });
  }, [appointments, customerFilter, serviceFilter, statusFilter, teamFilter]);

  const now = Date.now();

  const conflictIds = useMemo(() => {
    const byOwner = new Map<string, Appointment[]>();
    filteredAppointments.forEach(item => {
      const ownerKey = String(item.assignedToPersonId ?? "unassigned");
      const group = byOwner.get(ownerKey) ?? [];
      group.push(item);
      byOwner.set(ownerKey, group);
    });

    const ids = new Set<string>();
    byOwner.forEach(group => {
      const sorted = [...group].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      );
      for (let index = 1; index < sorted.length; index++) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const previousEnd = new Date(previous.endsAt ?? previous.startsAt).getTime();
        const currentStart = new Date(current.startsAt).getTime();
        if (currentStart < previousEnd) {
          ids.add(previous.id);
          ids.add(current.id);
        }
      }
    });
    return ids;
  }, [filteredAppointments]);

  const delayedIds = useMemo(() => {
    return new Set(
      filteredAppointments
        .filter(item => {
          const status = String(item.status).toUpperCase();
          return new Date(item.startsAt).getTime() < now && ["SCHEDULED", "CONFIRMED"].includes(status);
        })
        .map(item => item.id)
    );
  }, [filteredAppointments, now]);

  const events = useMemo<EventInput[]>(() => {
    return filteredAppointments.map(item => {
      const hasConflict = conflictIds.has(item.id);
      const isDelayed = delayedIds.has(item.id);
      const signal = hasConflict ? "Conflito" : isDelayed ? "Atraso" : STATUS_LABEL[item.status];
      return {
        id: item.id,
        title: `${item.customer?.name ?? "Cliente"} • ${item.title ?? "Serviço"}`,
        start: item.startsAt,
        end: item.endsAt ?? undefined,
        backgroundColor: hasConflict ? "#ef4444" : isDelayed ? "#ea580c" : STATUS_COLOR[item.status],
        borderColor: hasConflict ? "#b91c1c" : isDelayed ? "#c2410c" : STATUS_COLOR[item.status],
        textColor: "#ffffff",
        extendedProps: {
          status: item.status,
          customerName: item.customer?.name ?? "Cliente",
          serviceName: item.title ?? "Serviço",
          signal,
          timeLabel: new Date(item.startsAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      };
    });
  }, [filteredAppointments, conflictIds, delayedIds]);

  const selected = filteredAppointments.find(item => item.id === selectedId) ?? null;

  const executiveRead = useMemo(() => {
    const oneHour = 60 * 60 * 1000;
    const conflicts = conflictIds.size;
    const overload = filteredAppointments.filter(item => {
      const start = new Date(item.startsAt).getTime();
      return start - now <= oneHour && start - now > 0;
    }).length;
    const confirmed = filteredAppointments.filter(item => item.status === "CONFIRMED").length;
    const inProgress = 0;
    const possibleFits = Math.max(0, 12 - filteredAppointments.length);

    return { conflicts, overload, confirmed, inProgress, possibleFits };
  }, [filteredAppointments, conflictIds, now]);

  const immediateAttention = useMemo(() => {
    return filteredAppointments
      .map(item => {
        const hasConflict = conflictIds.has(item.id);
        const isDelayed = delayedIds.has(item.id);
        if (!hasConflict && !isDelayed) return null;
        return {
          item,
          tone: hasConflict ? "critical" : "warning",
          label: hasConflict ? "Conflito de horário" : "Atraso operacional",
        };
      })
      .filter(Boolean)
      .slice(0, 4) as Array<{ item: Appointment; tone: "critical" | "warning"; label: string }>;
  }, [filteredAppointments, conflictIds, delayedIds]);

  const nextBestAction = useMemo(() => {
    const dueToConfirm = filteredAppointments.find(item => item.status === "SCHEDULED");
    if (dueToConfirm) {
      return {
        title: "Confirmar agendamento pendente",
        description: `${dueToConfirm.customer?.name ?? "Cliente"} às ${new Date(dueToConfirm.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        appointmentId: dueToConfirm.id,
        intent: "confirm" as const,
      };
    }
    const delayed = filteredAppointments.find(item => delayedIds.has(item.id));
    if (delayed) {
      return {
        title: "Remarcar atendimento atrasado",
        description: `${delayed.customer?.name ?? "Cliente"} em atraso desde ${new Date(delayed.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        appointmentId: delayed.id,
        intent: "reschedule" as const,
      };
    }
    return null;
  }, [filteredAppointments, delayedIds]);

  const isLoading = appointmentsQuery.isLoading || customersQuery.isLoading || peopleQuery.isLoading;
  const hasError = appointmentsQuery.isError || customersQuery.isError || peopleQuery.isError;

  const refetchAll = () => {
    void Promise.all([appointmentsQuery.refetch(), customersQuery.refetch(), peopleQuery.refetch()]);
  };

  const handleConfirm = async (appointmentId: string) => {
    await updateAppointment.mutateAsync({ id: appointmentId, status: "CONFIRMED" });
    refetchAll();
  };

  return (
    <AppPageShell>
      <AppOperationalHeader
        title="Calendário operacional"
        description="Leitura rápida da distribuição do tempo para enxergar conflito, atraso e capacidade sem virar tela de execução."
        primaryAction={
          <Button type="button" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo agendamento
          </Button>
        }
        secondaryActions={<Button variant="outline" size="sm" onClick={refetchAll}>Atualizar leitura</Button>}
        contextChips={
          <>
            <AppStatusBadge label={`${executiveRead.conflicts} conflitos`} />
            <AppStatusBadge label={`${executiveRead.overload} próximos (1h)`} />
            <AppPriorityBadge label={executiveRead.inProgress > 0 ? `${executiveRead.inProgress} em andamento` : "Sem execução ativa"} />
          </>
        }
      >
        {nextBestAction ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Próxima melhor ação: {nextBestAction.title}</p>
              <p className="text-xs text-[var(--text-secondary)]">{nextBestAction.description}</p>
            </div>
            {nextBestAction.intent === "confirm" ? (
              <Button size="sm" onClick={() => void handleConfirm(nextBestAction.appointmentId)}>
                Confirmar sem sair
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => navigate(`/appointments?id=${nextBestAction.appointmentId}&action=reschedule&source=calendar`)}>
                Remarcar no fluxo
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Sem ação crítica imediata. Calendário saudável para o recorte selecionado.</p>
        )}
      </AppOperationalHeader>

      <AppToolbar className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={viewMode} onChange={event => setViewMode(event.target.value as ViewMode)}>
            <option value="timeGridDay">Dia</option>
            <option value="timeGridWeek">Semana</option>
            <option value="dayGridMonth">Mês</option>
          </select>
          <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={teamFilter} onChange={event => setTeamFilter(event.target.value)}>
            <option value="all">Equipe: todas</option>
            {people.map((person: any) => <option key={String(person.id)} value={String(person.id)}>{String(person.name ?? "Colaborador")}</option>)}
          </select>
          <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}>
            <option value="all">Serviço: todos</option>
            <option value="instalação">Instalação</option>
            <option value="manutenção">Manutenção</option>
            <option value="vistoria">Vistoria</option>
          </select>
          <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">Status: todos</option>
            <option value="SCHEDULED">Agendado</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="DONE">Concluído</option>
            <option value="CANCELED">Cancelado</option>
          </select>
          <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={customerFilter} onChange={event => setCustomerFilter(event.target.value)}>
            <option value="all">Cliente: todos</option>
            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </div>
      </AppToolbar>

      {isLoading ? <AppPageLoadingState description="Consolidando leitura macro do tempo da operação..." /> : null}
      {hasError ? <AppPageErrorState description="Não foi possível carregar o calendário da operação." onAction={refetchAll} /> : null}

      {!isLoading && !hasError ? (
        <>
          {filteredAppointments.length === 0 ? (
            <AppPageEmptyState title="Sem eventos para este recorte" description="Ajuste filtros ou crie um novo agendamento para preencher vazios operacionais." />
          ) : (
            <>
              <AppSectionBlock title="1) Atenção imediata" subtitle="Sinais operacionais que pedem decisão agora.">
                {immediateAttention.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {immediateAttention.map(({ item, tone, label }) => (
                      <div key={item.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.customer?.name ?? "Cliente"}</p>
                          <AppStatusBadge label={label} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.title ?? "Serviço não informado"} · {new Date(item.startsAt).toLocaleString("pt-BR")}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => void handleConfirm(item.id)}>Confirmar</Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/appointments?id=${item.id}&action=reschedule&source=calendar`)}>Remarcar</Button>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          {tone === "critical" ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : <Clock3 className="h-3.5 w-3.5 text-amber-500" />}
                          <span>{tone === "critical" ? "Conflito visível para a equipe." : "Atraso detectado no horário planejado."}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <AppPageEmptyState title="Sem pontos críticos" description="Nenhum conflito ou atraso no recorte atual do calendário." />
                )}
              </AppSectionBlock>

              <AppSectionBlock title="2) KPIs leves" subtitle="Pulso rápido da distribuição de carga.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Conflitos detectados</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.conflicts}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Sobrecarga próxima (1h)</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.overload}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Confirmados</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.confirmed}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Capacidade de encaixe</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.possibleFits}</p></div>
                </div>
              </AppSectionBlock>

              <div className="grid gap-4 xl:grid-cols-12">
                <AppSectionBlock title="3) Calendário visual" subtitle="Grade de leitura com evento legível: cliente, horário, serviço e status." className="xl:col-span-8">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2">
                    <FullCalendar
                      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                      initialView={viewMode}
                      viewDidMount={view => setViewMode(view.view.type as ViewMode)}
                      headerToolbar={false}
                      events={events}
                      eventClick={(arg: EventClickArg) => setSelectedId(arg.event.id)}
                      eventContent={(eventInfo) => (
                        <div className="space-y-0.5 p-0.5 text-[11px] leading-tight">
                          <p className="truncate font-semibold">{eventInfo.event.extendedProps.timeLabel} · {eventInfo.event.extendedProps.customerName}</p>
                          <p className="truncate">{eventInfo.event.extendedProps.serviceName}</p>
                          <p className="truncate opacity-90">{eventInfo.event.extendedProps.signal}</p>
                        </div>
                      )}
                      height={640}
                      editable={false}
                      locale="pt-br"
                      allDaySlot={false}
                    />
                  </div>
                </AppSectionBlock>

                <AppSectionBlock title="4) Ação sem troca de tela" subtitle="Contexto mínimo para decidir e acionar rápido." className="xl:col-span-4">
                  {selected ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.customer?.name ?? "Cliente não identificado"}</p>
                        <p className="text-xs text-[var(--text-muted)]">{selected.title ?? "Serviço não informado"}</p>
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">{new Date(selected.startsAt).toLocaleString("pt-BR")}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AppStatusBadge label={STATUS_LABEL[selected.status]} />
                          <AppPriorityBadge label={new Date(selected.startsAt).getTime() - Date.now() < 45 * 60 * 1000 ? "Alta" : "Média"} />
                          <AppStatusBadge label={conflictIds.has(selected.id) ? "Conflito" : delayedIds.has(selected.id) ? "Atraso" : "Programado"} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void handleConfirm(selected.id)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Confirmar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/appointments?id=${selected.id}&action=reschedule&source=calendar`)}>
                          <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Remarcar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/appointments?id=${selected.id}&source=calendar&mode=operational_list`)}>Abrir agendamento</Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/service-orders?appointmentId=${selected.id}`)}>Abrir O.S.</Button>
                        <Button size="sm" variant="outline" onClick={() => selected.customerId && navigate(`/customers?id=${selected.customerId}&source=calendar`)}>Abrir cliente</Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/whatsapp?customerId=${selected.customerId}&source=calendar`)}>
                          <MessageSquare className="mr-1 h-3.5 w-3.5" /> Mensagem
                        </Button>
                      </div>
                      <AppTimeline>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">Status atual: {normalizeEventStatus(selected.status)}</p>
                        </AppTimelineItem>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">Conexão direta com Agendamentos para execução detalhada.</p>
                        </AppTimelineItem>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">Calendário mantém leitura de distribuição e não substitui a fila operacional.</p>
                        </AppTimelineItem>
                      </AppTimeline>
                    </div>
                  ) : (
                    <AppPageEmptyState title="Selecione um evento" description="Clique em um agendamento na grade para abrir contexto, ação rápida e links de execução." />
                  )}
                </AppSectionBlock>
              </div>
            </>
          )}
        </>
      ) : null}

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={refetchAll}
        customers={customers}
      />
    </AppPageShell>
  );
}
