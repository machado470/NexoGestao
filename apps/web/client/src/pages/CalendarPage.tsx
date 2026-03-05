import { useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg, type EventDropArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, X, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Status colors ──────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#3b82f6",
  CONFIRMED: "#22c55e",
  IN_PROGRESS: "#f59e0b",
  DONE: "#10b981",
  CANCELED: "#ef4444",
  NO_SHOW: "#6b7280",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface AppointmentEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  customer?: { id: string; name: string };
  description?: string | null;
  notes?: string | null;
}

interface CreateModalState {
  open: boolean;
  startStr: string;
  endStr: string;
}

interface DetailModalState {
  open: boolean;
  event: AppointmentEvent | null;
}

// ─── Create Appointment Modal ─────────────────────────────────────────────────
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
    title: "",
    description: "",
    notes: "",
    status: "SCHEDULED",
    startsAt: state.startStr,
    endsAt: state.endStr,
  });

  const createMutation = trpc.nexo.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error("Erro ao criar agendamento: " + err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.title || !form.startsAt) {
      toast.error("Cliente, título e data/hora de início são obrigatórios");
      return;
    }
    createMutation.mutate({
      customerId: form.customerId,
      title: form.title,
      description: form.description || undefined,
      notes: form.notes || undefined,
      status: form.status,
      startsAt: form.startsAt,
      endsAt: form.endsAt || undefined,
    });
  };

  if (!state.open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Novo Agendamento
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cliente *
            </label>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="">Selecione um cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Consulta de rotina"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Início *
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fim
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="SCHEDULED">Agendado</option>
              <option value="CONFIRMED">Confirmado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Detalhes do agendamento..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
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
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Criar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function EventDetailModal({
  state,
  onClose,
  onUpdate,
}: {
  state: DetailModalState;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const updateMutation = trpc.nexo.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento atualizado!");
      onUpdate();
      onClose();
    },
    onError: (err) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  if (!state.open || !state.event) return null;

  const ev = state.event;
  const statusLabel: Record<string, string> = {
    SCHEDULED: "Agendado",
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "Em Andamento",
    DONE: "Concluído",
    CANCELED: "Cancelado",
    NO_SHOW: "Não Compareceu",
  };

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate({ id: ev.id, data: { status: newStatus } });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">
            {ev.title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {ev.customer && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Cliente
              </span>
              <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                {ev.customer.name}
              </p>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Início
            </span>
            <p className="text-sm text-gray-900 dark:text-white mt-0.5">
              {new Date(ev.startsAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Fim
            </span>
            <p className="text-sm text-gray-900 dark:text-white mt-0.5">
              {new Date(ev.endsAt).toLocaleString("pt-BR")}
            </p>
          </div>
          {ev.description && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Descrição
              </span>
              <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                {ev.description}
              </p>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Status
            </span>
            <div className="mt-1.5">
              <select
                value={ev.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updateMutation.isPending}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              >
                {Object.entries(statusLabel).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Skeleton ────────────────────────────────────────────────────────
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

// ─── Main CalendarPage ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [createModal, setCreateModal] = useState<CreateModalState>({
    open: false,
    startStr: "",
    endStr: "",
  });
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    open: false,
    event: null,
  });

  // Buscar agendamentos via nexo proxy
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Buscar clientes para o modal de criação
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateMutation = trpc.nexo.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento atualizado!");
      appointmentsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Erro ao atualizar: " + err.message);
      appointmentsQuery.refetch(); // reverter visualmente
    },
  });

  // Transformar appointments em eventos do FullCalendar
  const rawAppointments: AppointmentEvent[] = Array.isArray(
    appointmentsQuery.data?.data
  )
    ? (appointmentsQuery.data.data as AppointmentEvent[])
    : Array.isArray(appointmentsQuery.data)
    ? (appointmentsQuery.data as AppointmentEvent[])
    : [];

  const events: EventInput[] = rawAppointments.map((appt) => ({
    id: String(appt.id),
    title: appt.customer
      ? `${appt.title} — ${appt.customer.name}`
      : appt.title,
    start: appt.startsAt,
    end: appt.endsAt,
    backgroundColor: STATUS_COLORS[appt.status] ?? "#6b7280",
    borderColor: STATUS_COLORS[appt.status] ?? "#6b7280",
    extendedProps: { ...appt },
  }));

  const customers: Array<{ id: string; name: string }> = Array.isArray(
    customersQuery.data?.data
  )
    ? (customersQuery.data.data as Array<{ id: string; name: string }>)
    : [];

  // Handlers
  const handleDateClick = useCallback((arg: DateClickArg) => {
    const startStr = arg.dateStr.includes("T")
      ? arg.dateStr.slice(0, 16)
      : `${arg.dateStr}T09:00`;
    const endDate = new Date(startStr);
    endDate.setMinutes(endDate.getMinutes() + 60);
    const endStr = endDate.toISOString().slice(0, 16);
    setCreateModal({ open: true, startStr, endStr });
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const appt = arg.event.extendedProps as AppointmentEvent;
    setDetailModal({ open: true, event: appt });
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
    appointmentsQuery.refetch();
  }, [appointmentsQuery]);

  const isLoading = appointmentsQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-8 h-8 text-orange-500" />
            Calendário
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Visualize e gerencie todos os agendamentos
          </p>
        </div>
        <Button
          onClick={() => {
            const now = new Date();
            const startStr = now.toISOString().slice(0, 16);
            const end = new Date(now.getTime() + 60 * 60 * 1000);
            const endStr = end.toISOString().slice(0, 16);
            setCreateModal({ open: true, startStr, endStr });
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries({
          SCHEDULED: "Agendado",
          CONFIRMED: "Confirmado",
          IN_PROGRESS: "Em Andamento",
          DONE: "Concluído",
          CANCELED: "Cancelado",
        }).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 overflow-hidden">
        {isLoading ? (
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
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
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
      </div>

      {/* Modals */}
      <CreateAppointmentModal
        state={createModal}
        onClose={() => setCreateModal({ open: false, startStr: "", endStr: "" })}
        onSuccess={handleCreateSuccess}
        customers={customers}
      />
      <EventDetailModal
        state={detailModal}
        onClose={() => setDetailModal({ open: false, event: null })}
        onUpdate={() => appointmentsQuery.refetch()}
      />
    </div>
  );
}
