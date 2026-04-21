import { useMemo, useState } from "react";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import { AppToolbar, AppTimeline, AppTimelineItem } from "@/components/app-system";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import {
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
  AppPriorityBadge,
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

  const appointments = useMemo(
    () => normalizeArrayPayload<Appointment>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const customers = useMemo(
    () => normalizeArrayPayload<{ id: string; name: string }>(customersQuery.data),
    [customersQuery.data]
  );
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);

  const events = useMemo<EventInput[]>(() => {
    return appointments.map(item => ({
      id: item.id,
      title: `${item.customer?.name ?? "Cliente"} · ${item.title ?? "Serviço"}`,
      start: item.startsAt,
      end: item.endsAt ?? undefined,
      backgroundColor: STATUS_COLOR[item.status],
      borderColor: STATUS_COLOR[item.status],
      extendedProps: {
        status: item.status,
        customerName: item.customer?.name ?? "Cliente",
        serviceName: item.title ?? "Serviço",
      },
    }));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(item => {
      const teamOk = teamFilter === "all" || String(item.assignedToPersonId ?? "") === teamFilter;
      const serviceOk = serviceFilter === "all" || String(item.title ?? "").toLowerCase().includes(serviceFilter.toLowerCase());
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const customerOk = customerFilter === "all" || item.customerId === customerFilter;
      return teamOk && serviceOk && statusOk && customerOk;
    });
  }, [appointments, customerFilter, serviceFilter, statusFilter, teamFilter]);

  const selected = filteredAppointments.find(item => item.id === selectedId) ?? null;

  const executiveRead = useMemo(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const conflictByPerson = new Map<string, number>();
    const sorted = [...filteredAppointments].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      const sameAssignee = String(current.assignedToPersonId ?? "") && current.assignedToPersonId === previous.assignedToPersonId;
      if (!sameAssignee) continue;
      const currentStart = new Date(current.startsAt).getTime();
      const previousEnd = new Date(previous.endsAt ?? previous.startsAt).getTime();
      if (currentStart < previousEnd) {
        const key = String(current.assignedToPersonId);
        conflictByPerson.set(key, (conflictByPerson.get(key) ?? 0) + 1);
      }
    }

    const conflicts = [...conflictByPerson.values()].reduce((acc, value) => acc + value, 0);
    const overload = filteredAppointments.filter(item => {
      const start = new Date(item.startsAt).getTime();
      return start - now <= oneHour && start - now > 0;
    }).length;
    const canceled = filteredAppointments.filter(item => item.status === "CANCELED").length;
    const possibleFits = Math.max(0, 12 - filteredAppointments.length);

    return { conflicts, overload, canceled, possibleFits };
  }, [filteredAppointments]);

  const isLoading = appointmentsQuery.isLoading || customersQuery.isLoading || peopleQuery.isLoading;
  const hasError = appointmentsQuery.isError || customersQuery.isError || peopleQuery.isError;

  const refetchAll = () => {
    void Promise.all([appointmentsQuery.refetch(), customersQuery.refetch(), peopleQuery.refetch()]);
  };

  return (
    <AppPageShell>
      <AppPageHeader
        title="Calendário"
        description="Visão estratégica de distribuição do tempo, conflitos, vazios e sobrecarga operacional."
        cta={
          <Button type="button" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo agendamento
          </Button>
        }
      />

      <AppToolbar>
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
        <Button variant="outline" size="sm" onClick={refetchAll}>Atualizar leitura</Button>
      </AppToolbar>

      {isLoading ? <AppPageLoadingState description="Consolidando leitura macro do tempo da operação..." /> : null}
      {hasError ? <AppPageErrorState description="Não foi possível carregar o calendário da operação." onAction={refetchAll} /> : null}

      {!isLoading && !hasError ? (
        <>
          {filteredAppointments.length === 0 ? (
            <AppPageEmptyState title="Sem eventos para este recorte" description="Ajuste filtros ou crie um novo agendamento para preencher vazios operacionais." />
          ) : (
            <>
              <AppSectionBlock title="1) Leitura executiva do tempo" subtitle="Onde estão conflitos, sobrecarga e janelas de encaixe para reorganizar o dia.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Conflitos detectados</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.conflicts}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Sobrecarga próxima (1h)</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.overload}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Buracos por cancelamento</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.canceled}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Encaixes possíveis</p><p className="text-lg font-semibold text-[var(--text-primary)]">{executiveRead.possibleFits}</p></div>
                </div>
              </AppSectionBlock>

              <div className="grid gap-4 xl:grid-cols-12">
                <AppSectionBlock title="2) Grade principal" subtitle="Semana é o modo de trabalho padrão. Dia e mês para leitura complementar." className="xl:col-span-8">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2">
                    <FullCalendar
                      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                      initialView={viewMode}
                      headerToolbar={false}
                      events={events.filter(event => filteredAppointments.some(item => item.id === event.id))}
                      eventClick={(arg: EventClickArg) => setSelectedId(arg.event.id)}
                      height={640}
                      editable={false}
                      locale="pt-br"
                      allDaySlot={false}
                    />
                  </div>
                </AppSectionBlock>

                <AppSectionBlock title="3) Contexto do evento" subtitle="Detalhe operacional do item selecionado para agir sem perder tempo." className="xl:col-span-4">
                  {selected ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.customer?.name ?? "Cliente não identificado"}</p>
                        <p className="text-xs text-[var(--text-muted)]">{selected.title ?? "Serviço não informado"}</p>
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">{new Date(selected.startsAt).toLocaleString("pt-BR")}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AppStatusBadge label={STATUS_LABEL[selected.status]} />
                          <AppPriorityBadge label={new Date(selected.startsAt).getTime() - Date.now() < 45 * 60 * 1000 ? "Alta" : "Média"} />
                          <AppStatusBadge label={new Date(selected.startsAt).getTime() - Date.now() < 45 * 60 * 1000 ? "Próximo do horário" : "Programado"} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/appointments?id=${selected.id}&source=calendar&mode=operational_list`)}>Abrir agendamento</Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/service-orders?appointmentId=${selected.id}`)}>Abrir O.S.</Button>
                        <Button size="sm" variant="outline" onClick={() => selected.customerId && navigate(`/customers?id=${selected.customerId}&source=calendar`)}>Abrir cliente</Button>
                      </div>
                      <AppTimeline>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">Status atual: {normalizeEventStatus(selected.status)}</p>
                        </AppTimelineItem>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">Estrutura pronta para detecção automática de conflito por equipe e intervalo.</p>
                        </AppTimelineItem>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">Preparado para sugestão de encaixe em janelas com ociosidade operacional.</p>
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
