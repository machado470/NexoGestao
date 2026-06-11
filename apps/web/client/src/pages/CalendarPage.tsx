import { useMemo, useState } from "react";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/design-system";
import { AppTimeline, AppTimelineItem } from "@/components/app-system";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalFlowStageState,
  type OperationalStateLevel,
} from "@/components/app/OperationalCommandLayer";
import {
  AppOperationalHeader,
  AppFiltersBar,
  AppKpiRow,
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
  updatedAt?: string | null;
  serviceOrderId?: string | null;
  serviceOrder?: { id?: string | null; status?: string | null } | null;
  serviceOrders?: Array<{ id?: string | null; status?: string | null }> | null;
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

function getAppointmentEndMs(item: Appointment) {
  const startMs = new Date(item.startsAt).getTime();
  const endMs = item.endsAt ? new Date(item.endsAt).getTime() : NaN;
  if (Number.isFinite(endMs) && endMs > startMs) return endMs;
  return startMs + 60 * 60 * 1000;
}

function getServiceOrderLink(item: Appointment) {
  const directId =
    item.serviceOrderId ??
    item.serviceOrder?.id ??
    item.serviceOrders?.find(order => Boolean(order?.id))?.id ??
    null;
  return directId
    ? `/service-orders?id=${directId}`
    : `/service-orders?appointmentId=${item.id}`;
}

function getPersonName(people: any[], personId?: string | null) {
  if (!personId) return "Responsável não atribuído";
  const person = people.find(
    item => String(item?.id ?? "") === String(personId)
  );
  return String(person?.name ?? person?.fullName ?? "Responsável");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeEventStatus(status: string) {
  if (status === "CANCELED") return "Cancelado";
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "DONE") return "Concluído";
  if (status === "NO_SHOW") return "Não compareceu";
  return "Agendado";
}

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [viewMode, setViewMode] = useOperationalMemoryState<ViewMode>(
    "nexo.calendar.view.v1",
    "timeGridWeek"
  );
  const [selectedId, setSelectedId] = useOperationalMemoryState<string | null>(
    "nexo.calendar.selected-id.v1",
    null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [teamFilter, setTeamFilter] = useOperationalMemoryState(
    "nexo.calendar.team-filter.v1",
    "all"
  );
  const [serviceFilter, setServiceFilter] = useOperationalMemoryState(
    "nexo.calendar.service-filter.v1",
    "all"
  );
  const [statusFilter, setStatusFilter] = useOperationalMemoryState(
    "nexo.calendar.status-filter.v1",
    "all"
  );
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState(
    "nexo.calendar.customer-filter.v1",
    "all"
  );

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    teamFilter === "all"
      ? { limit: 1000 }
      : { assignedToPersonId: teamFilter, limit: 1000 },
    { enabled: isAuthenticated, retry: false }
  );
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const peopleQuery = trpc.people.assignees.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const updateAppointment = trpc.nexo.appointments.update.useMutation();

  const appointments = useMemo(
    () => normalizeArrayPayload<Appointment>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const customers = useMemo(
    () =>
      normalizeArrayPayload<{ id: string; name: string }>(customersQuery.data),
    [customersQuery.data]
  );
  const people = useMemo(
    () => normalizeArrayPayload<any>(peopleQuery.data),
    [peopleQuery.data]
  );

  const filteredAppointments = useMemo(() => {
    return appointments.filter(item => {
      const teamOk =
        teamFilter === "all" ||
        String(item.assignedToPersonId ?? "") === teamFilter;
      const serviceOk =
        serviceFilter === "all" ||
        String(item.title ?? "")
          .toLowerCase()
          .includes(serviceFilter.toLowerCase());
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const customerOk =
        customerFilter === "all" || item.customerId === customerFilter;
      return teamOk && serviceOk && statusOk && customerOk;
    });
  }, [appointments, customerFilter, serviceFilter, statusFilter, teamFilter]);

  const now = Date.now();

  const conflictIds = useMemo(() => {
    const byOwner = new Map<string, Appointment[]>();
    filteredAppointments.forEach(item => {
      if (!item.assignedToPersonId) return;
      const ownerKey = String(item.assignedToPersonId);
      const group = byOwner.get(ownerKey) ?? [];
      group.push(item);
      byOwner.set(ownerKey, group);
    });

    const ids = new Set<string>();
    byOwner.forEach(group => {
      const sorted = [...group].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      );
      for (let index = 1; index < sorted.length; index++) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const previousEnd = getAppointmentEndMs(previous);
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
          return (
            new Date(item.startsAt).getTime() < now &&
            ["SCHEDULED", "CONFIRMED"].includes(status)
          );
        })
        .map(item => item.id)
    );
  }, [filteredAppointments, now]);

  const events = useMemo<EventInput[]>(() => {
    return filteredAppointments.map(item => {
      const hasConflict = conflictIds.has(item.id);
      const isDelayed = delayedIds.has(item.id);
      const signal = hasConflict
        ? "Conflito"
        : isDelayed
          ? "Atraso"
          : STATUS_LABEL[item.status];
      return {
        id: item.id,
        title: `${item.customer?.name ?? "Cliente"} • ${item.title ?? "Serviço"}`,
        start: item.startsAt,
        end: item.endsAt ?? undefined,
        backgroundColor: hasConflict
          ? "#ef4444"
          : isDelayed
            ? "#ea580c"
            : STATUS_COLOR[item.status],
        borderColor: hasConflict
          ? "#b91c1c"
          : isDelayed
            ? "#c2410c"
            : STATUS_COLOR[item.status],
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

  const selected =
    filteredAppointments.find(item => item.id === selectedId) ?? null;

  const executiveRead = useMemo(() => {
    const oneHour = 60 * 60 * 1000;
    const conflicts = conflictIds.size;
    const overload = filteredAppointments.filter(item => {
      const start = new Date(item.startsAt).getTime();
      return start - now <= oneHour && start - now > 0;
    }).length;
    const confirmed = filteredAppointments.filter(
      item => item.status === "CONFIRMED"
    ).length;
    const inProgress = 0;
    const activePeople = teamFilter === "all" ? Math.max(people.length, 1) : 1;
    const assignedActiveAppointments = filteredAppointments.filter(
      item =>
        Boolean(item.assignedToPersonId) &&
        !["CANCELED", "DONE", "NO_SHOW"].includes(item.status)
    ).length;
    const possibleFits = Math.max(
      0,
      activePeople * 12 - assignedActiveAppointments
    );

    return { conflicts, overload, confirmed, inProgress, possibleFits };
  }, [filteredAppointments, conflictIds, now, people.length, teamFilter]);

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
      .slice(0, 4) as Array<{
      item: Appointment;
      tone: "critical" | "warning";
      label: string;
    }>;
  }, [filteredAppointments, conflictIds, delayedIds]);

  const activeAppointments = useMemo(
    () =>
      filteredAppointments.filter(
        item => !["CANCELED", "DONE", "NO_SHOW"].includes(item.status)
      ),
    [filteredAppointments]
  );

  const calendarCommand = useMemo(() => {
    const byOwner = new Map<string, Appointment[]>();
    activeAppointments.forEach(item => {
      const ownerKey = String(item.assignedToPersonId ?? "unassigned");
      const group = byOwner.get(ownerKey) ?? [];
      group.push(item);
      byOwner.set(ownerKey, group);
    });

    const overloadedOwners = Array.from(byOwner.entries())
      .map(([ownerId, group]) => ({ ownerId, count: group.length, group }))
      .filter(owner => owner.ownerId !== "unassigned" && owner.count >= 6)
      .sort((a, b) => b.count - a.count);

    const dayLoad = new Map<string, number>();
    activeAppointments.forEach(item => {
      const dayKey = new Date(item.startsAt).toISOString().slice(0, 10);
      dayLoad.set(dayKey, (dayLoad.get(dayKey) ?? 0) + 1);
    });
    const busiestDay = Array.from(dayLoad.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const unconfirmed = activeAppointments.filter(
      item => item.status === "SCHEDULED"
    );
    const delayed = activeAppointments.filter(item => delayedIds.has(item.id));
    const withServiceOrder = activeAppointments.filter(
      item =>
        Boolean(item.serviceOrderId) ||
        Boolean(item.serviceOrder?.id) ||
        Boolean(item.serviceOrders?.some(order => Boolean(order?.id)))
    );
    const unassigned = activeAppointments.filter(
      item => !item.assignedToPersonId
    );

    const possibleFits = executiveRead.possibleFits;
    const emptyWindowSignal =
      activeAppointments.length > 0 &&
      possibleFits >= Math.max(6, people.length * 4);
    const conflictSample = activeAppointments.find(item =>
      conflictIds.has(item.id)
    );
    const overloadedOwner = overloadedOwners[0] ?? null;
    const delayedSample = delayed[0] ?? null;
    const unconfirmedSample = unconfirmed[0] ?? null;

    let level: OperationalStateLevel = "NORMAL";
    let stateReason =
      "Agenda distribuída no recorte atual, sem conflito de responsável ou atraso operacional relevante.";
    let stateImpact =
      "O calendário sustenta a leitura estratégica do tempo: a equipe pode revisar a semana e manter o ritmo de execução.";

    if (
      conflictIds.size > 0 ||
      delayed.length >= 3 ||
      (busiestDay?.[1] ?? 0) >= 10
    ) {
      level = "RESTRICTED";
      stateReason = conflictSample
        ? `${conflictSample.customer?.name ?? "Cliente"} tem sobreposição no responsável ${getPersonName(people, conflictSample.assignedToPersonId)}.`
        : delayed.length >= 3
          ? `${delayed.length} agendamentos ativos já passaram do horário planejado.`
          : `Dia com ${busiestDay?.[1] ?? 0} agendamentos ativos no mesmo recorte.`;
      stateImpact =
        "O tempo da operação está travado: execução, O.S. e governança podem receber atraso em cadeia se o ajuste não acontecer agora.";
    } else if (
      overloadedOwner ||
      unconfirmed.length > 0 ||
      delayed.length > 0 ||
      emptyWindowSignal ||
      unassigned.length > 0
    ) {
      level = "WARNING";
      stateReason = overloadedOwner
        ? `${getPersonName(people, overloadedOwner.ownerId)} concentra ${overloadedOwner.count} agendamentos ativos.`
        : delayedSample
          ? `${delayedSample.customer?.name ?? "Cliente"} está atrasado desde ${formatDateTime(delayedSample.startsAt)}.`
          : unconfirmedSample
            ? `${unconfirmed.length} agendamento(s) ainda aguardam confirmação.`
            : unassigned.length > 0
              ? `${unassigned.length} agendamento(s) sem responsável atribuído.`
              : `${possibleFits} janelas úteis indicam agenda vazia demais para a capacidade atual.`;
      stateImpact =
        "Há oportunidade de rebalancear o tempo antes que a fila vire conflito, atraso ou ociosidade operacional.";
    }

    const risk = conflictSample
      ? {
          title: "Conflito entre atendimentos",
          reason: `${conflictSample.customer?.name ?? "Cliente"} disputa horário com outro evento do mesmo responsável.`,
          impact:
            "A equipe pode perder a janela de execução e empurrar O.S., Timeline e governança para tratamento corretivo.",
          ctaLabel: "Resolver conflito de horário",
          appointmentId: conflictSample.id,
          action: "reschedule" as const,
        }
      : overloadedOwner
        ? {
            title: "Responsável sobrecarregado",
            reason: `${getPersonName(people, overloadedOwner.ownerId)} concentra ${overloadedOwner.count} agendamentos ativos no recorte.`,
            impact:
              "A distribuição desigual aumenta chance de atraso, remarcação e execução sem prova operacional no tempo certo.",
            ctaLabel: "Rebalancear agenda",
            appointmentId: overloadedOwner.group[0]?.id,
            action: "rebalance" as const,
          }
        : delayedSample
          ? {
              title: "Risco de atrasar execução",
              reason: `${delayedSample.customer?.name ?? "Cliente"} já passou do horário planejado e segue ativo.`,
              impact:
                "Atraso no calendário reduz previsibilidade de O.S. e compromete a trilha de Timeline/Governança.",
              ctaLabel: "Revisar agenda do dia",
              appointmentId: delayedSample.id,
              action: "review" as const,
            }
          : unconfirmedSample
            ? {
                title: "Agendamentos sem confirmação",
                reason: `${unconfirmed.length} evento(s) ainda estão como agendado, sem confirmação operacional.`,
                impact:
                  "Janelas não confirmadas podem virar ociosidade, remarcação ou conflito de última hora.",
                ctaLabel: "Confirmar agendamento",
                appointmentId: unconfirmedSample.id,
                action: "confirm" as const,
              }
            : emptyWindowSignal
              ? {
                  title: "Agenda vazia demais",
                  reason: `${possibleFits} janelas úteis permanecem disponíveis no recorte filtrado.`,
                  impact:
                    "Capacidade sem ocupação reduz previsibilidade de produção e pode ocultar demanda fora do calendário.",
                  ctaLabel: "Preencher janela operacional",
                  appointmentId: activeAppointments[0]?.id,
                  action: "fill" as const,
                }
              : {
                  title: "Calendário saudável",
                  reason:
                    "Não há conflito, sobrecarga, atraso ou vazio crítico no recorte atual.",
                  impact:
                    "A operação pode usar o calendário para revisão preventiva da semana sem acionar fluxo automático.",
                  ctaLabel: "Revisar semana",
                  appointmentId: activeAppointments[0]?.id,
                  action: "reviewWeek" as const,
                };

    const nextAction = {
      title: risk.ctaLabel,
      entity: risk.appointmentId
        ? `Agendamento #${risk.appointmentId}`
        : "Calendário operacional",
      reason: risk.reason,
      impact: risk.impact,
      primaryActionLabel: risk.ctaLabel,
      appointmentId: risk.appointmentId,
      action: risk.action,
    };

    return {
      level,
      stateReason,
      stateImpact,
      risk,
      nextAction,
      overloadedOwners,
      unconfirmedCount: unconfirmed.length,
      delayedCount: delayed.length,
      withServiceOrderCount: withServiceOrder.length,
      unassignedCount: unassigned.length,
      emptyWindowSignal,
      busiestDayCount: busiestDay?.[1] ?? 0,
    };
  }, [
    activeAppointments,
    conflictIds,
    delayedIds,
    executiveRead.possibleFits,
    people,
  ]);

  const flowStages = useMemo(
    () =>
      [
        {
          id: "time",
          label: "Tempo",
          summary:
            filteredAppointments.length > 0
              ? `${filteredAppointments.length} evento(s) no recorte filtrado.`
              : "Sem eventos no recorte filtrado.",
          state:
            calendarCommand.level === "RESTRICTED"
              ? "blocked"
              : calendarCommand.level === "WARNING"
                ? "warning"
                : filteredAppointments.length > 0
                  ? "active"
                  : "idle",
          countOrValue: String(filteredAppointments.length),
        },
        {
          id: "appointment",
          label: "Agendamento",
          summary:
            calendarCommand.unconfirmedCount > 0
              ? `${calendarCommand.unconfirmedCount} aguardando confirmação.`
              : "Eventos confirmados/concluídos sem pendência crítica.",
          state: calendarCommand.unconfirmedCount > 0 ? "warning" : "done",
          countOrValue: String(activeAppointments.length),
          hrefLabel: "Abrir Agendamentos",
          onClick: () => navigate("/appointments?source=calendar"),
        },
        {
          id: "owner",
          label: "Responsável",
          summary:
            calendarCommand.overloadedOwners.length > 0
              ? `${getPersonName(people, calendarCommand.overloadedOwners[0].ownerId)} está sobrecarregado.`
              : calendarCommand.unassignedCount > 0
                ? `${calendarCommand.unassignedCount} sem responsável.`
                : "Responsáveis sem sobrecarga relevante.",
          state:
            calendarCommand.overloadedOwners.length > 0
              ? "warning"
              : calendarCommand.unassignedCount > 0
                ? "warning"
                : "done",
        },
        {
          id: "service-order",
          label: "O.S.",
          summary:
            calendarCommand.withServiceOrderCount > 0
              ? `${calendarCommand.withServiceOrderCount} agendamento(s) indicam vínculo com O.S.`
              : "Sem vínculo de O.S. retornado no payload do calendário.",
          state: calendarCommand.withServiceOrderCount > 0 ? "active" : "idle",
          hrefLabel: "Ver O.S.",
          onClick: () => navigate("/service-orders?source=calendar"),
        },
        {
          id: "execution",
          label: "Execução",
          summary:
            calendarCommand.delayedCount > 0
              ? `${calendarCommand.delayedCount} atraso(s) pressionam execução.`
              : "Execução depende da fila de O.S.; calendário orienta o tempo.",
          state: calendarCommand.delayedCount > 0 ? "blocked" : "active",
        },
        {
          id: "timeline",
          label: "Timeline",
          summary:
            "Prova oficial não é fabricada; eventos abaixo vêm de datas reais do calendário.",
          state: filteredAppointments.length > 0 ? "active" : "idle",
          hrefLabel: "Abrir Timeline",
          onClick: () => navigate("/timeline?source=calendar"),
        },
        {
          id: "risk",
          label: "Risco/Governança",
          summary:
            calendarCommand.level === "NORMAL"
              ? "Sem risco crítico para governança do tempo."
              : "Sinal exige decisão antes de impactar governança.",
          state:
            calendarCommand.level === "RESTRICTED"
              ? "blocked"
              : calendarCommand.level === "WARNING"
                ? "warning"
                : "done",
          hrefLabel: "Ver Governança",
          onClick: () => navigate("/governance?source=calendar"),
        },
      ] satisfies Array<{
        id: string;
        label: string;
        summary: string;
        state: OperationalFlowStageState;
        countOrValue?: string;
        hrefLabel?: string;
        onClick?: () => void;
      }>,
    [
      activeAppointments.length,
      calendarCommand,
      filteredAppointments.length,
      navigate,
      people,
    ]
  );

  const operationalEvidence = useMemo(() => {
    return [...filteredAppointments]
      .sort(
        (a, b) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
      )
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        type: conflictIds.has(item.id)
          ? "Conflito"
          : delayedIds.has(item.id)
            ? "Atraso"
            : STATUS_LABEL[item.status],
        occurredAt: formatDateTime(item.startsAt),
        entity: item.customer?.name ?? "Cliente não identificado",
        actor: getPersonName(people, item.assignedToPersonId),
        summary: `${item.title ?? "Serviço não informado"}. Evento real do calendário${item.endsAt ? ` até ${formatDateTime(item.endsAt)}` : " sem término informado"}; não substitui Timeline oficial.`,
      }));
  }, [conflictIds, delayedIds, filteredAppointments, people]);

  const runCalendarAction = (appointmentId?: string, action?: string) => {
    if (action === "reviewWeek") {
      setViewMode("timeGridWeek");
      return;
    }
    if (action === "fill") {
      setShowCreateModal(true);
      return;
    }
    if (appointmentId) {
      const queryAction =
        action === "confirm"
          ? "confirm"
          : action === "reschedule" || action === "rebalance"
            ? "reschedule"
            : "review";
      navigate(
        `/appointments?id=${appointmentId}&action=${queryAction}&source=calendar`
      );
      return;
    }
    navigate("/appointments?source=calendar");
  };

  const isLoading =
    appointmentsQuery.isLoading ||
    customersQuery.isLoading ||
    peopleQuery.isLoading;
  const hasError =
    appointmentsQuery.isError || customersQuery.isError || peopleQuery.isError;

  const refetchAll = () => {
    void Promise.all([
      appointmentsQuery.refetch(),
      customersQuery.refetch(),
      peopleQuery.refetch(),
    ]);
  };

  const handleConfirm = async (appointmentId: string) => {
    const appointment = appointments.find(item => item.id === appointmentId);
    await updateAppointment.mutateAsync({
      id: appointmentId,
      status: "CONFIRMED",
      expectedUpdatedAt: appointment?.updatedAt ?? undefined,
    });
    refetchAll();
  };

  return (
    <AppPageShell>
      <AppOperationalHeader
        title="Calendário operacional"
        description="Visualização estratégica do tempo para enxergar conflito, atraso e capacidade sem virar tela de execução."
        primaryAction={
          <Button type="button" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo agendamento
          </Button>
        }
        secondaryActions={
          <Button variant="outline" size="sm" onClick={refetchAll}>
            Atualizar leitura
          </Button>
        }
        contextChips={
          <>
            <AppStatusBadge label={`${executiveRead.conflicts} conflitos`} />
            <AppStatusBadge label={`${executiveRead.overload} próximos (1h)`} />
            <AppPriorityBadge
              label={
                executiveRead.inProgress > 0
                  ? `${executiveRead.inProgress} em andamento`
                  : "Sem execução ativa"
              }
            />
          </>
        }
      >
        <p className="text-sm text-[var(--text-muted)]">
          Calendário mostra distribuição, conflitos, vazios e sobrecarga do
          tempo. Agendamentos continua sendo o fluxo operacional da entrada.
        </p>
      </AppOperationalHeader>

      {!isLoading && !hasError ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <OperationalStateCard
              title="Estado do tempo operacional"
              level={calendarCommand.level}
              reason={calendarCommand.stateReason}
              impact={calendarCommand.stateImpact}
              detailsLabel="Ver calendário"
              onDetails={() => setViewMode("timeGridWeek")}
            />
            <OperationalRiskCard
              title={calendarCommand.risk.title}
              reason={calendarCommand.risk.reason}
              impact={calendarCommand.risk.impact}
              ctaLabel={calendarCommand.risk.ctaLabel}
              onClick={() =>
                runCalendarAction(
                  calendarCommand.risk.appointmentId,
                  calendarCommand.risk.action
                )
              }
            />
            <NextBestActionCard
              title={calendarCommand.nextAction.title}
              entity={calendarCommand.nextAction.entity}
              reason={calendarCommand.nextAction.reason}
              impact={calendarCommand.nextAction.impact}
              safetyNote="A camada orienta e navega; não executa confirmação, remarcação, comunicação ou automação automaticamente."
              primaryActionLabel={calendarCommand.nextAction.primaryActionLabel}
              onPrimaryAction={() =>
                runCalendarAction(
                  calendarCommand.nextAction.appointmentId,
                  calendarCommand.nextAction.action
                )
              }
              secondaryActionLabel="Abrir Agendamentos"
              onSecondaryAction={() =>
                navigate("/appointments?source=calendar")
              }
            />
          </div>

          <OperationalFlowCard
            title="Tempo → Agendamento → Responsável → O.S. → Execução → Timeline → Risco/Governança"
            subtitle="Calendário não substitui Agendamentos; ele mostra como o tempo impacta execução, prova operacional e governança."
            stages={flowStages}
          />

          <EntityTimelineCard
            title="Prova operacional do tempo"
            subtitle="Fallback seguro: eventos derivados de agendamentos com datas reais do calendário; não substitui Timeline oficial."
            events={operationalEvidence}
            fullTimelineLabel="Abrir Timeline oficial"
            onFullTimeline={() => navigate("/timeline?source=calendar")}
          />
        </div>
      ) : null}

      <AppFiltersBar className="mt-4 gap-2 border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
            value={viewMode}
            onChange={event => setViewMode(event.target.value as ViewMode)}
          >
            <option value="timeGridDay">Dia</option>
            <option value="timeGridWeek">Semana</option>
            <option value="dayGridMonth">Mês</option>
          </select>
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
            value={teamFilter}
            onChange={event => setTeamFilter(event.target.value)}
          >
            <option value="all">Equipe: todas</option>
            {people.map((person: any) => (
              <option key={String(person.id)} value={String(person.id)}>
                {String(person.name ?? "Colaborador")}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
            value={serviceFilter}
            onChange={event => setServiceFilter(event.target.value)}
          >
            <option value="all">Serviço: todos</option>
            <option value="instalação">Instalação</option>
            <option value="manutenção">Manutenção</option>
            <option value="vistoria">Vistoria</option>
          </select>
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
          >
            <option value="all">Status: todos</option>
            <option value="SCHEDULED">Agendado</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="DONE">Concluído</option>
            <option value="CANCELED">Cancelado</option>
          </select>
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
            value={customerFilter}
            onChange={event => setCustomerFilter(event.target.value)}
          >
            <option value="all">Cliente: todos</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
      </AppFiltersBar>

      {isLoading ? (
        <AppPageLoadingState description="Consolidando leitura macro do tempo da operação..." />
      ) : null}
      {hasError ? (
        <AppPageErrorState
          description="Não foi possível carregar o calendário da operação."
          onAction={refetchAll}
        />
      ) : null}

      {!isLoading && !hasError ? (
        <>
          {filteredAppointments.length === 0 ? (
            <AppPageEmptyState
              title="Sem eventos para este recorte"
              description="Ajuste filtros ou crie um novo agendamento para preencher vazios operacionais."
            />
          ) : (
            <>
              <AppSectionBlock
                title="1) Atenção imediata"
                subtitle="Sinais operacionais que pedem decisão agora."
              >
                {immediateAttention.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {immediateAttention.map(({ item, tone, label }) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {item.customer?.name ?? "Cliente"}
                          </p>
                          <AppStatusBadge label={label} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {item.title ?? "Serviço não informado"} ·{" "}
                          {new Date(item.startsAt).toLocaleString("pt-BR")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleConfirm(item.id)}
                          >
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(
                                `/appointments?id=${item.id}&action=reschedule&source=calendar`
                              )
                            }
                          >
                            Remarcar
                          </Button>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          {tone === "critical" ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <Clock3 className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span>
                            {tone === "critical"
                              ? "Conflito visível para a equipe."
                              : "Atraso detectado no horário planejado."}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <AppPageEmptyState
                    title="Sem pontos críticos"
                    description="Nenhum conflito ou atraso no recorte atual do calendário."
                  />
                )}
              </AppSectionBlock>

              <AppSectionBlock
                title="2) KPIs leves"
                subtitle="Pulso rápido da distribuição de carga."
              >
                <AppKpiRow
                  items={[
                    {
                      title: "Conflitos detectados",
                      value: String(executiveRead.conflicts),
                      hint: "Choques de agenda no recorte.",
                    },
                    {
                      title: "Sobrecarga próxima (1h)",
                      value: String(executiveRead.overload),
                      hint: "Capacidade pressionada no curto prazo.",
                    },
                    {
                      title: "Confirmados",
                      value: String(executiveRead.confirmed),
                      hint: "Eventos preparados para execução.",
                    },
                    {
                      title: "Capacidade de encaixe",
                      value: String(executiveRead.possibleFits),
                      hint: "Janelas úteis para reorganização.",
                    },
                  ]}
                />
              </AppSectionBlock>

              <div className="grid gap-4 xl:grid-cols-12">
                <AppSectionBlock
                  title="3) Calendário visual"
                  subtitle="Grade de leitura com evento legível: cliente, horário, serviço e status."
                  className="xl:col-span-8"
                >
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-2">
                    <FullCalendar
                      plugins={[
                        dayGridPlugin,
                        timeGridPlugin,
                        interactionPlugin,
                      ]}
                      initialView={viewMode}
                      viewDidMount={view =>
                        setViewMode(view.view.type as ViewMode)
                      }
                      headerToolbar={false}
                      events={events}
                      eventClick={(arg: EventClickArg) =>
                        setSelectedId(arg.event.id)
                      }
                      eventContent={eventInfo => (
                        <div className="space-y-0.5 p-0.5 text-[11px] leading-tight">
                          <p className="truncate font-semibold">
                            {eventInfo.event.extendedProps.timeLabel} ·{" "}
                            {eventInfo.event.extendedProps.customerName}
                          </p>
                          <p className="truncate">
                            {eventInfo.event.extendedProps.serviceName}
                          </p>
                          <p className="truncate opacity-90">
                            {eventInfo.event.extendedProps.signal}
                          </p>
                        </div>
                      )}
                      height={640}
                      editable={false}
                      locale="pt-br"
                      allDaySlot={false}
                    />
                  </div>
                </AppSectionBlock>

                <AppSectionBlock
                  title="4) Ação sem troca de tela"
                  subtitle="Contexto mínimo para decidir e acionar rápido."
                  className="xl:col-span-4"
                >
                  {selected ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {selected.customer?.name ??
                            "Cliente não identificado"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {selected.title ?? "Serviço não informado"}
                        </p>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          {new Date(selected.startsAt).toLocaleString("pt-BR")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AppStatusBadge
                            label={STATUS_LABEL[selected.status]}
                          />
                          <AppPriorityBadge
                            label={
                              new Date(selected.startsAt).getTime() -
                                Date.now() <
                              45 * 60 * 1000
                                ? "Alta"
                                : "Média"
                            }
                          />
                          <AppStatusBadge
                            label={
                              conflictIds.has(selected.id)
                                ? "Conflito"
                                : delayedIds.has(selected.id)
                                  ? "Atraso"
                                  : "Programado"
                            }
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleConfirm(selected.id)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{" "}
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/appointments?id=${selected.id}&action=reschedule&source=calendar`
                            )
                          }
                        >
                          <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Remarcar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/appointments?id=${selected.id}&source=calendar&mode=operational_list`
                            )
                          }
                        >
                          Abrir agendamento
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(getServiceOrderLink(selected))
                          }
                        >
                          Abrir O.S.
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            selected.customerId &&
                            navigate(
                              `/customers?id=${selected.customerId}&source=calendar`
                            )
                          }
                        >
                          Abrir cliente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/whatsapp?customerId=${selected.customerId}&appointmentId=${selected.id}&source=calendar`
                            )
                          }
                        >
                          <MessageSquare className="mr-1 h-3.5 w-3.5" />{" "}
                          Mensagem
                        </Button>
                      </div>
                      <AppTimeline>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">
                            Status atual:{" "}
                            {normalizeEventStatus(selected.status)}
                          </p>
                        </AppTimelineItem>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">
                            Conexão direta com Agendamentos para execução
                            detalhada.
                          </p>
                        </AppTimelineItem>
                        <AppTimelineItem>
                          <p className="text-sm text-[var(--text-primary)]">
                            Calendário mantém leitura de distribuição e não
                            substitui a fila operacional.
                          </p>
                        </AppTimelineItem>
                      </AppTimeline>
                    </div>
                  ) : (
                    <AppPageEmptyState
                      title="Selecione um evento"
                      description="Clique em um agendamento na grade para abrir contexto, ação rápida e links de execução."
                    />
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
