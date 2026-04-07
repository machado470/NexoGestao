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
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Plus,
  X,
  Loader2,
  MessageCircle,
  Briefcase,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#3b82f6",
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

function CreateAppointmentModal({
  state,
  onClose,
  onSuccess,
  customers,
}: {
  state: CreateModalState;
  onClose: () => void;
  onSuccess: () => void;
  customers: Array<{ id: string; name: string }>;
}) {
  const [form, setForm] = useState({
    customerId: "",
    startsAt: state.startStr,
    endsAt: state.endStr,
    status: "SCHEDULED" as AppointmentEvent["status"],
    notes: "",
  });

  const createMutation = trpc.nexo.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      onSuccess();
      onClose();
      setForm({
        customerId: "",
        startsAt: "",
        endsAt: "",
        status: "SCHEDULED",
        notes: "",
      });
    },
    onError: err => {
      toast.error("Erro ao criar agendamento: " + err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerId || !form.startsAt) {
      toast.error("Cliente e data/hora de início são obrigatórios");
      return;
    }

    if (
      form.endsAt &&
      new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()
    ) {
      toast.error("Data/hora final deve ser maior que a inicial");
      return;
    }

    createMutation.mutate({
      customerId: form.customerId,
      startsAt: form.startsAt,
      endsAt: form.endsAt || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    });
  };

  if (!state.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Novo Agendamento
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            type="button"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Cliente *
            </label>
            <select
              value={form.customerId}
              onChange={e =>
                setForm(prev => ({ ...prev, customerId: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Selecione um cliente</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Início *
            </label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={e =>
                setForm(prev => ({ ...prev, startsAt: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Fim
            </label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={e =>
                setForm(prev => ({ ...prev, endsAt: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              value={form.status}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  status: e.target.value as AppointmentEvent["status"],
                }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="SCHEDULED">Agendado</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="DONE">Concluído</option>
              <option value="CANCELED">Cancelado</option>
              <option value="NO_SHOW">Não compareceu</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Observações
            </label>
            <textarea
              value={form.notes}
              onChange={e =>
                setForm(prev => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              placeholder="Observações do agendamento"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar"
              )}
            </Button>
          </div>
        </form>
      </div>
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
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  if (!state.open || !state.event) return null;

  const event = state.event;

  const handleStatusChange = (newStatus: AppointmentEvent["status"]) => {
    updateMutation.mutate({
      id: event.id,
      data: { status: newStatus },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <h2 className="pr-2 text-lg font-semibold text-gray-900 dark:text-white">
            Detalhes do Agendamento
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            type="button"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Cliente
            </span>
            <p className="mt-0.5 text-sm text-gray-900 dark:text-white">
              {event.customer?.name ?? "Cliente não identificado"}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Início
            </span>
            <p className="mt-0.5 text-sm text-gray-900 dark:text-white">
              {new Date(event.startsAt).toLocaleString("pt-BR")}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Fim
            </span>
            <p className="mt-0.5 text-sm text-gray-900 dark:text-white">
              {event.endsAt
                ? new Date(event.endsAt).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Status
            </span>
            <div className="mt-1.5">
              <select
                value={event.status}
                onChange={e =>
                  handleStatusChange(
                    e.target.value as AppointmentEvent["status"]
                  )
                }
                disabled={updateMutation.isPending}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="SCHEDULED">Agendado</option>
                <option value="CONFIRMED">Confirmado</option>
                <option value="DONE">Concluído</option>
                <option value="CANCELED">Cancelado</option>
                <option value="NO_SHOW">Não compareceu</option>
              </select>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Observações
            </span>
            <p className="mt-0.5 text-sm text-gray-900 dark:text-white">
              {event.notes?.trim() ? event.notes : "—"}
            </p>
          </div>
        </div>

        <div className="space-y-2 px-5 pb-5">
          <Button
            type="button"
            className="w-full"
            onClick={() => onOpenExecution(event.customerId)}
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Abrir execução
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenWhatsApp(event.customerId)}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Falar com cliente
          </Button>

          <Button variant="outline" onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    </div>
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
        data: {
          startsAt: newStart.toISOString(),
          endsAt: newEnd ? newEnd.toISOString() : undefined,
        },
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

  return (
    <PageShell>
      <PageHero
        eyebrow="Agenda"
        title={
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-orange-500" />
            Calendário
          </span>
        }
        description="Agenda operacional conectada com atendimento, execução e contato com o cliente."
        actions={
          <Button
            onClick={() => {
              const now = new Date();
              const end = new Date(now.getTime() + 60 * 60 * 1000);

              setCreateModal({
                open: true,
                startStr: formatDateTimeLocalInput(now),
                endStr: formatDateTimeLocalInput(end),
              });
            }}
            className="gap-2 bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        }
      />

      <SurfaceSection className="space-y-6">
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["SCHEDULED", "Agendado"],
              ["CONFIRMED", "Confirmado"],
              ["DONE", "Concluído"],
              ["CANCELED", "Cancelado"],
              ["NO_SHOW", "Não compareceu"],
            ] as const
          ).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {label}
              </span>
            </div>
          ))}
        </div>

        <SurfaceSection className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {appointmentsQuery.isLoading ? (
            <CalendarSkeleton />
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              buttonText={{
                today: "Hoje",
                month: "Mês",
                week: "Semana",
                day: "Dia",
              }}
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
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                meridiem: false,
                hour12: false,
              }}
              height="auto"
              eventClassNames="cursor-pointer hover:opacity-90 transition-opacity"
            />
          )}
        </SurfaceSection>
      </SurfaceSection>

      <CreateAppointmentModal
        state={createModal}
        onClose={() =>
          setCreateModal({ open: false, startStr: "", endStr: "" })
        }
        onSuccess={handleCreateSuccess}
        customers={customers}
      />

      <EventDetailModal
        state={detailModal}
        onClose={() => setDetailModal({ open: false, event: null })}
        onUpdate={() => void appointmentsQuery.refetch()}
        onOpenExecution={handleOpenExecution}
        onOpenWhatsApp={handleOpenWhatsApp}
      />
    </PageShell>
  );
}
