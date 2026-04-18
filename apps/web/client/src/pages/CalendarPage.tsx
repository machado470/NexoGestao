import { useMemo, useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, {
  type DateClickArg,
} from "@fullcalendar/interaction";
import type {
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/design-system";
import {
  Plus,
  MessageCircle,
  Briefcase,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getConcurrencyErrorMessage,
  isConcurrentConflictError,
} from "@/lib/concurrency";
import { AppKpiRow, AppListBlock, AppSectionBlock, AppStatusBadge } from "@/components/internal-page-system";

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#f97316",
  CONFIRMED: "#22c55e",
  DONE: "#10b981",
  CANCELED: "#ef4444",
  NO_SHOW: "#6b7280",
};

type CustomerRef = {
  id: string;
  name: string;
  phone?: string | null;
};

type AppointmentEvent = {
  id: string;
  customerId: string;
  customer?: CustomerRef | null;
  startsAt: string;
  endsAt: string | null;
  status: "SCHEDULED" | "CONFIRMED" | "DONE" | "CANCELED" | "NO_SHOW";
  notes?: string | null;
  updatedAt?: string | null;
};

interface CreateModalState {
  open: boolean;
  startStr: string;
  endStr: string;
}

interface DetailModalState {
  open: boolean;
  event: AppointmentEvent | null;
}

function formatDateTimeLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getStatusLabel(status: AppointmentEvent["status"]) {
  const labels: Record<AppointmentEvent["status"], string> = {
    SCHEDULED: "Agendado",
    CONFIRMED: "Confirmado",
    DONE: "Concluído",
    CANCELED: "Cancelado",
    NO_SHOW: "Não compareceu",
  };

  return labels[status];
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>

      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="h-24" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EventDetailModal({
  state,
  onClose,
  onUpdate,
  onOpenExecution,
  onOpenWhatsApp,
}: {
  state: DetailModalState;
  onClose: () => void;
  onUpdate: () => void;
  onOpenExecution: (customerId: string) => void;
  onOpenWhatsApp: (customerId: string) => void;
}) {
  const updateMutation = trpc.nexo.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento atualizado!");
      onUpdate();
      onClose();
    },
    onError: err => {
      if (isConcurrentConflictError(err)) {
        toast.error(getConcurrencyErrorMessage("agendamento"), {
          action: { label: "Recarregar", onClick: onUpdate },
        });
        return;
      }
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  if (!state.event) return null;

  const event = state.event;

  const handleStatusChange = (newStatus: AppointmentEvent["status"]) => {
    updateMutation.mutate({
      id: event.id,
      status: newStatus,
      expectedUpdatedAt: event.updatedAt ?? undefined,
    });
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-sm border-[var(--border-subtle)] bg-[var(--card-bg)] p-0 text-[var(--text-primary)] shadow-2xl backdrop-blur">
        <DialogHeader className="border-b border-[var(--border-subtle)] px-6 py-5">
          <DialogTitle className="pr-2 text-lg font-semibold">
            Detalhes do Agendamento
          </DialogTitle>
          <DialogDescription className="text-[var(--text-muted)]">
            Atualize o status ou siga para execução e atendimento no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-5">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Cliente
            </span>
            <p className="mt-0.5 text-sm text-[var(--text-primary)]">
              {event.customer?.name ?? "Cliente não identificado"}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Início
            </span>
            <p className="mt-0.5 text-sm text-[var(--text-primary)]">
              {new Date(event.startsAt).toLocaleString("pt-BR")}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Fim
            </span>
            <p className="mt-0.5 text-sm text-[var(--text-primary)]">
              {event.endsAt
                ? new Date(event.endsAt).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Status
            </span>
            <div className="mt-1.5">
              <Select
                value={event.status}
                onValueChange={(value) => handleStatusChange(value as AppointmentEvent["status"])}
              >
                <SelectTrigger disabled={updateMutation.isPending}>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Agendado</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                  <SelectItem value="DONE">Concluído</SelectItem>
                  <SelectItem value="CANCELED">Cancelado</SelectItem>
                  <SelectItem value="NO_SHOW">Não compareceu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Observações
            </span>
            <p className="mt-0.5 text-sm text-[var(--text-primary)]">
              {event.notes?.trim() ? event.notes : "—"}
            </p>
          </div>
        </div>

        <DialogFooter className="space-y-2 border-t border-[var(--border-subtle)] px-6 py-4 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full"
            disabled={updateMutation.isPending}
            onClick={() => onOpenExecution(event.customerId)}
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Abrir execução
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={updateMutation.isPending}
            onClick={() => onOpenWhatsApp(event.customerId)}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Falar com cliente
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [, navigate] = useLocation();
  const [createModal, setCreateModal] = useState<CreateModalState>({
    open: false,
    startStr: "",
    endStr: "",
  });
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    open: false,
    event: null,
  });

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateMutation = trpc.nexo.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento atualizado!");
      void appointmentsQuery.refetch();
    },
    onError: err => {
      if (isConcurrentConflictError(err)) {
        toast.error(getConcurrencyErrorMessage("agendamento"));
        void appointmentsQuery.refetch();
        return;
      }
      toast.error("Erro ao atualizar: " + err.message);
      void appointmentsQuery.refetch();
    },
  });

  const rawAppointments = useMemo(() => {
    const payload = appointmentsQuery.data;
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows as AppointmentEvent[];
  }, [appointmentsQuery.data]);

  const events: EventInput[] = useMemo(() => {
    return rawAppointments.map(appointment => ({
      id: String(appointment.id),
      title: `${appointment.customer?.name ?? "Agendamento"} • ${getStatusLabel(
        appointment.status
      )}`,
      start: appointment.startsAt,
      end: appointment.endsAt ?? undefined,
      backgroundColor: STATUS_COLORS[appointment.status] ?? "#6b7280",
      borderColor: STATUS_COLORS[appointment.status] ?? "#6b7280",
      extendedProps: appointment,
    }));
  }, [rawAppointments]);
  const scheduledCount = rawAppointments.filter((item) => item.status === "SCHEDULED").length;
  const confirmedCount = rawAppointments.filter((item) => item.status === "CONFIRMED").length;
  const noShowCount = rawAppointments.filter((item) => item.status === "NO_SHOW").length;
  const doneCount = rawAppointments.filter((item) => item.status === "DONE").length;

  const customers = useMemo(() => {
    const payload = customersQuery.data;
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows.map((customer: any) => ({
      id: String(customer.id),
      name: String(customer.name),
    }));
  }, [customersQuery.data]);

  const handleDateClick = useCallback((arg: DateClickArg) => {
    const startDate = arg.date;
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    setCreateModal({
      open: true,
      startStr: formatDateTimeLocalInput(startDate),
      endStr: formatDateTimeLocalInput(endDate),
    });
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const appointment = arg.event.extendedProps as AppointmentEvent;
    setDetailModal({ open: true, event: appointment });
  }, []);

  const handleEventDrop = useCallback(
    (arg: EventDropArg) => {
      const id = arg.event.id;
      const newStart = arg.event.start;
      const newEnd = arg.event.end;

      if (!newStart) {
        arg.revert();
        return;
      }

      updateMutation.mutate({
        id,
        startsAt: newStart.toISOString(),
        endsAt: newEnd ? newEnd.toISOString() : undefined,
        expectedUpdatedAt:
          (arg.event.extendedProps as AppointmentEvent | undefined)?.updatedAt ?? undefined,
      });
    },
    [updateMutation]
  );

  const handleCreateSuccess = useCallback(() => {
    void appointmentsQuery.refetch();
  }, [appointmentsQuery]);

  const handleOpenExecution = useCallback(
    (customerId: string) => {
      navigate(`/customers?customerId=${customerId}`);
      setDetailModal({ open: false, event: null });
    },
    [navigate]
  );

  const handleOpenWhatsApp = useCallback(
    (customerId: string) => {
      navigate(`/whatsapp?customerId=${customerId}`);
      setDetailModal({ open: false, event: null });
    },
    [navigate]
  );

  const todayItems = rawAppointments
    .filter((item) => {
      const start = new Date(item.startsAt);
      const now = new Date();
      return start.toDateString() === now.toDateString();
    })
    .slice(0, 5)
    .map((item) => ({
      title: `${item.customer?.name ?? "Cliente"} · ${new Date(item.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      subtitle: getStatusLabel(item.status),
      right: <AppStatusBadge label={getStatusLabel(item.status)} />,
      action: <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/appointments?id=${item.id}`)}>Abrir</Button>,
    }));

  return (
    <PageWrapper title="Calendário" subtitle="Leitura visual da agenda operacional conectada à execução.">
      <OperationalTopCard
        contextLabel="Direção de agenda"
        title="Calendário operacional"
        description="Visão da rotina diária com ações diretas para cliente, agendamento e O.S."
        primaryAction={
          <Button
            onClick={() => {
              const now = new Date();
              const end = new Date(now.getTime() + 60 * 60 * 1000);
              setCreateModal({ open: true, startStr: formatDateTimeLocalInput(now), endStr: formatDateTimeLocalInput(end) });
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        }
      />

      <AppKpiRow
        items={[
          { title: "Agendados", value: String(scheduledCount), hint: "aguardando confirmação" },
          { title: "Confirmados", value: String(confirmedCount), hint: "prontos para atendimento" },
          { title: "Concluídos", value: String(doneCount), hint: "execução finalizada" },
          { title: "Conflitos/No-show", value: String(noShowCount), hint: "pedem reação comercial" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <AppSectionBlock title="Calendário da operação" subtitle="Agenda integrada ao fluxo de execução" className="xl:col-span-2">
          {appointmentsQuery.error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-red-200">Não foi possível carregar os agendamentos. {appointmentsQuery.error.message}</p>
                <Button variant="outline" onClick={() => void appointmentsQuery.refetch()}>Tentar novamente</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
              {appointmentsQuery.isLoading ? (
                <CalendarSkeleton />
              ) : (
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="timeGridWeek"
                  headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
                  buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
                  locale="pt-br"
                  firstDay={0}
                  slotMinTime="06:00:00"
                  slotMaxTime="22:00:00"
                  allDaySlot={false}
                  editable
                  selectable
                  selectMirror
                  dayMaxEvents
                  weekends
                  events={events}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  eventDrop={handleEventDrop}
                  eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: false, hour12: false }}
                  height="auto"
                  eventClassNames="cursor-pointer hover:opacity-90 transition-opacity"
                />
              )}
            </div>
          )}
        </AppSectionBlock>

        <AppSectionBlock title="Agenda do dia e conflitos" subtitle="Itens do dia para reação rápida" compact>
          <AppListBlock
            compact
            items={todayItems.length > 0 ? todayItems : [{ title: "Sem agenda para hoje", subtitle: "Use novo agendamento para preencher a rotina.", action: <Button size="sm" variant="outline" onClick={() => setCreateModal({ open: true, startStr: formatDateTimeLocalInput(new Date()), endStr: formatDateTimeLocalInput(new Date(Date.now() + 60*60*1000)) })}>Agendar</Button> }]}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {([ ["SCHEDULED", "Agendado"], ["CONFIRMED", "Confirmado"], ["DONE", "Concluído"], ["CANCELED", "Cancelado"], ["NO_SHOW", "Não compareceu"] ] as const).map(([status, label]) => (
              <span key={status} className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />{label}
              </span>
            ))}
          </div>
        </AppSectionBlock>
      </div>

      <CreateAppointmentModal
        isOpen={createModal.open}
        onClose={() => setCreateModal({ open: false, startStr: "", endStr: "" })}
        onSuccess={handleCreateSuccess}
        customers={customers}
        initialStartsAt={createModal.startStr}
        initialEndsAt={createModal.endStr}
      />

      <EventDetailModal
        state={detailModal}
        onClose={() => setDetailModal({ open: false, event: null })}
        onUpdate={() => void appointmentsQuery.refetch()}
        onOpenExecution={handleOpenExecution}
        onOpenWhatsApp={handleOpenWhatsApp}
      />
    </PageWrapper>
  );
}
