import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import type { OperationalSeverity } from "@/lib/operations/operational-intelligence";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { Button } from "@/components/design-system";
import { FormModal } from "@/components/app-modal-system";
import {
  AppDataTable,
  AppField,
  AppForm,
  AppInput,
  AppPageShell,
  AppPriorityBadge,
  AppRowActionsDropdown,
  AppSelect,
  AppStatusBadge,
  type AppOperationalStatus,
  type AppPriorityLevel,
} from "@/components/app-system";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { PersonAssignmentWarning } from "@/components/PersonAssignmentWarning";
import { useAssigneeWarningTelemetry } from "@/hooks/useAssigneeWarningTelemetry";
import {
  AppActionBar,
  AppFiltersBar,
  AppEmbeddedTimeline,
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPagination,
  AppSectionBlock,
  AppNextBestActionBlock,
} from "@/components/internal-page-system";

type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "CANCELED"
  | "DONE"
  | "NO_SHOW";
type FilterKey =
  | "all"
  | "today"
  | "tomorrow"
  | "week"
  | "unconfirmed"
  | "confirmed"
  | "overdue"
  | "canceled";

type AppointmentRow = {
  id?: string;
  customerId?: string;
  customer?: { id?: string; name?: string };
  assignedToPersonId?: string | null;
  personId?: string | null;
  title?: string | null;
  notes?: string | null;
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "today", label: "Hoje" },
  { key: "tomorrow", label: "Amanhã" },
  { key: "week", label: "Semana" },
  { key: "unconfirmed", label: "Não confirmados" },
  { key: "confirmed", label: "Confirmados" },
  { key: "overdue", label: "Atrasados" },
  { key: "canceled", label: "Cancelados" },
];

function asDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value?: string | null) {
  const date = asDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function durationLabel(startsAt?: string | null, endsAt?: string | null) {
  const start = asDate(startsAt);
  const end = asDate(endsAt);
  if (!start || !end || end <= start) return "—";
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${minutes} min`;
}

function mapStatus(status?: string | null) {
  const normalized = String(status ?? "SCHEDULED").toUpperCase();
  if (normalized === "SCHEDULED")
    return { label: "Agendado", tone: "warning" as const };
  if (normalized === "CONFIRMED")
    return { label: "Confirmado", tone: "success" as const };
  if (normalized === "IN_PROGRESS")
    return { label: "Em andamento", tone: "info" as const };
  if (normalized === "DONE")
    return { label: "Concluído", tone: "info" as const };
  if (normalized === "CANCELED")
    return { label: "Cancelado", tone: "danger" as const };
  return { label: "No-show", tone: "accent" as const };
}

type MappedAppointment = {
  item: AppointmentRow;
  status: string;
  start: Date | null;
  customerId: string;
  customerName: string;
  ownerName: string;
  order: any;
  isOverdue: boolean;
  startsSoon: boolean;
};

function deriveAppointmentOperationalStatus(
  row: MappedAppointment
): AppOperationalStatus {
  if (row.status === "NO_SHOW") return "CRÍTICO";
  if (row.isOverdue) return "RISCO";
  if (row.status === "SCHEDULED" && row.startsSoon) return "ATENÇÃO";
  if (row.status === "CANCELED") return "ATENÇÃO";
  return "NORMAL";
}

function deriveAppointmentPriority(
  row: MappedAppointment
): AppPriorityLevel | null {
  if (row.status === "NO_SHOW" || row.isOverdue) return "P0";
  if (row.status === "SCHEDULED" && row.startsSoon) return "P1";
  if (row.status === "SCHEDULED" && !row.order) return "P2";
  return null;
}

function appointmentPriorityLabel(priority: AppPriorityLevel) {
  if (priority === "P0") return "P0 · agir agora";
  if (priority === "P1") return "P1 · confirmar hoje";
  if (priority === "P2") return "P2 · preparar";
  return "P3 · informativo";
}

function mapOperationalStatusBadge(row: MappedAppointment) {
  if (row.isOverdue) return { label: "Atrasado", tone: "danger" as const };
  if (row.startsSoon && row.status !== "DONE" && row.status !== "CANCELED")
    return { label: "Próximo do horário", tone: "warning" as const };
  if (row.status === "NO_SHOW")
    return { label: "Risco de no-show", tone: "danger" as const };
  if (row.status === "SCHEDULED")
    return { label: "Precisa confirmar", tone: "warning" as const };
  if (row.status === "CONFIRMED")
    return { label: "Preparado", tone: "success" as const };
  if (row.status === "DONE")
    return { label: "Concluído", tone: "info" as const };
  return { label: "Encerrado", tone: "neutral" as const };
}

function mapOperationalStatus(row: MappedAppointment) {
  const status = deriveAppointmentOperationalStatus(row);
  const tone =
    status === "CRÍTICO"
      ? ("danger" as const)
      : status === "RISCO"
        ? ("accent" as const)
        : status === "ATENÇÃO"
          ? ("warning" as const)
          : ("success" as const);
  return { label: status, tone };
}

function nextActionLabel(row: MappedAppointment) {
  if (row.isOverdue) return "Remarcar/cancelar";
  if (row.status === "SCHEDULED") return "Confirmar";
  if (["SCHEDULED", "CONFIRMED"].includes(row.status) && !row.order)
    return "Gerar O.S.";
  if (row.status === "IN_PROGRESS") return "Acompanhar atendimento";
  if (row.order?.id) return "Iniciar atendimento";
  if (row.status === "DONE") return "Revisar histórico";
  if (row.status === "CANCELED") return "Reagendar se necessário";
  return "Abrir detalhe";
}

export default function AppointmentsPage() {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("today");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [queryText, setQueryText] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [openServiceOrderModal, setOpenServiceOrderModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const _operationalSeverityContract: OperationalSeverity = "healthy";
  void _operationalSeverityContract;

  const queryParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    const params = new URLSearchParams(queryString);
    return {
      customerId: params.get("customerId"),
      appointmentId: params.get("appointmentId"),
    };
  }, [location]);

  const utils = trpc.useUtils();
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    responsibleFilter === "all"
      ? { limit: 100 }
      : { assignedToPersonId: responsibleFilter, limit: 100 },
    { enabled: isAuthenticated, retry: false }
  );
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const peopleQuery = trpc.people.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: isAuthenticated, retry: false }
  );
  const timelineQuery = trpc.nexo.timeline.listByCustomer.useQuery(
    { customerId: queryParams.customerId ?? "", limit: 25 },
    {
      enabled: isAuthenticated && Boolean(queryParams.customerId),
      retry: false,
    }
  );

  const createMutation = trpc.nexo.appointments.create.useMutation();
  const updateMutation = trpc.nexo.appointments.update.useMutation();

  const appointments = useMemo(
    () => normalizeArrayPayload<AppointmentRow>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const customers = useMemo(
    () => normalizeArrayPayload<any>(customersQuery.data),
    [customersQuery.data]
  );
  const people = useMemo(
    () => normalizeArrayPayload<any>(peopleQuery.data),
    [peopleQuery.data]
  );
  const serviceOrders = useMemo(
    () => normalizeArrayPayload<any>(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );
  const timeline = useMemo(
    () => normalizeArrayPayload<any>(timelineQuery.data),
    [timelineQuery.data]
  );

  const customerById = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const item of customers) {
      const id = String((item as any)?.id ?? "");
      if (!id) continue;
      entries.push([id, String((item as any)?.name ?? "Cliente")]);
    }
    return new Map<string, string>(entries);
  }, [customers]);
  const personById = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const item of people) {
      const id = String((item as any)?.id ?? "");
      if (!id) continue;
      entries.push([id, String((item as any)?.name ?? "Responsável")]);
    }
    return new Map<string, string>(entries);
  }, [people]);
  const orderByAppointment = useMemo(() => {
    const map = new Map<string, any>();
    for (const order of serviceOrders) {
      const appointmentId = String(order?.appointmentId ?? "");
      if (appointmentId) map.set(appointmentId, order);
    }
    return map;
  }, [serviceOrders]);

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
  const tomorrowStart = new Date(dayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(dayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const weekEnd = new Date(dayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const mapped = useMemo(
    () =>
      appointments.map(item => {
        const start = asDate(item.startsAt);
        const status = String(item.status ?? "SCHEDULED").toUpperCase();
        const customerId = String(item.customerId ?? item.customer?.id ?? "");
        const customerName =
          item.customer?.name ||
          customerById.get(customerId) ||
          "Cliente não identificado";
        const order = orderByAppointment.get(String(item.id ?? ""));
        const isOverdue = Boolean(
          start && start < now && ["SCHEDULED", "CONFIRMED"].includes(status)
        );
        const startsSoon = Boolean(
          start &&
          start >= now &&
          (start.getTime() - now.getTime()) / 60000 <= 120
        );
        return {
          item,
          status,
          start,
          customerId,
          customerName,
          ownerName:
            personById.get(
              String(item.assignedToPersonId ?? item.personId ?? "")
            ) ?? "Não definido",
          order,
          isOverdue,
          startsSoon,
        };
      }),
    [appointments, customerById, orderByAppointment, personById, now]
  );

  const filtered = useMemo(() => {
    let base = mapped;
    if (queryParams.customerId)
      base = base.filter(row => row.customerId === queryParams.customerId);

    if (selectedFilter === "today")
      base = base.filter(
        row => row.start && row.start >= dayStart && row.start <= dayEnd
      );
    if (selectedFilter === "tomorrow")
      base = base.filter(
        row =>
          row.start && row.start >= tomorrowStart && row.start <= tomorrowEnd
      );
    if (selectedFilter === "week")
      base = base.filter(
        row => row.start && row.start >= dayStart && row.start <= weekEnd
      );
    if (selectedFilter === "unconfirmed")
      base = base.filter(row => row.status === "SCHEDULED");
    if (selectedFilter === "confirmed")
      base = base.filter(row => row.status === "CONFIRMED");
    if (selectedFilter === "overdue") base = base.filter(row => row.isOverdue);
    if (selectedFilter === "canceled")
      base = base.filter(row => row.status === "CANCELED");

    const search = queryText.trim().toLowerCase();
    if (search) {
      base = base.filter(row =>
        `${row.customerName} ${row.item.title ?? ""} ${row.item.notes ?? ""}`
          .toLowerCase()
          .includes(search)
      );
    }

    return [...base].sort(
      (a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0)
    );
  }, [
    mapped,
    queryParams.customerId,
    selectedFilter,
    queryText,
    dayStart,
    dayEnd,
    tomorrowStart,
    tomorrowEnd,
    weekEnd,
  ]);
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [queryText, queryParams.customerId, responsibleFilter, selectedFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, filtered.length, pageSize]);

  useEffect(() => {
    if (queryParams.appointmentId) {
      setSelectedAppointmentId(queryParams.appointmentId);
      return;
    }
    if (!selectedAppointmentId && filtered[0]?.item?.id)
      setSelectedAppointmentId(String(filtered[0].item.id));
  }, [queryParams.appointmentId, filtered, selectedAppointmentId]);

  const selected =
    filtered.find(
      row => String(row.item.id ?? "") === String(selectedAppointmentId ?? "")
    ) ?? null;

  const assigneeWarningTelemetry = useAssigneeWarningTelemetry("APPOINTMENT");
  const [form, setForm] = useState({
    customerId: "",
    date: "",
    time: "",
    status: "SCHEDULED" as AppointmentStatus,
    notes: "",
    assignedToPersonId: "unassigned",
    durationMinutes: "60",
  });

  useEffect(() => {
    if (!openModal) {
      assigneeWarningTelemetry.reset();
      return;
    }
    if (editing) {
      const start = asDate(editing.startsAt);
      const end = asDate(editing.endsAt);
      setForm({
        customerId: String(
          editing.customerId ??
            editing.customer?.id ??
            queryParams.customerId ??
            ""
        ),
        date: start ? start.toISOString().slice(0, 10) : "",
        time: start ? start.toISOString().slice(11, 16) : "",
        status: String(
          editing.status ?? "SCHEDULED"
        ).toUpperCase() as AppointmentStatus,
        notes: String(editing.notes ?? ""),
        assignedToPersonId: String(
          editing.assignedToPersonId ?? editing.personId ?? "unassigned"
        ),
        durationMinutes:
          start && end
            ? String(
                Math.max(
                  15,
                  Math.round((end.getTime() - start.getTime()) / 60000)
                )
              )
            : "60",
      });
      return;
    }
    setForm({
      customerId: queryParams.customerId ?? "",
      date: "",
      time: "",
      status: "SCHEDULED",
      notes: "",
      assignedToPersonId: "unassigned",
      durationMinutes: "60",
    });
  }, [
    assigneeWarningTelemetry.reset,
    openModal,
    editing,
    queryParams.customerId,
  ]);

  const saveAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    const startsAt = new Date(`${form.date}T${form.time}`);
    if (!form.customerId || Number.isNaN(startsAt.getTime())) {
      toast.error("Cliente, data e hora são obrigatórios.");
      return;
    }
    const endsAt = new Date(
      startsAt.getTime() +
        Math.max(15, Number(form.durationMinutes) || 60) * 60000
    );

    try {
      const assignedToPersonId =
        form.assignedToPersonId === "unassigned"
          ? undefined
          : form.assignedToPersonId;
      assigneeWarningTelemetry.trackConfirmed(
        assignedToPersonId,
        editing?.id ? String(editing.id) : undefined
      );

      if (editing?.id) {
        await updateMutation.mutateAsync({
          id: String(editing.id),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          status: form.status,
          notes: form.notes.trim() || undefined,
          assignedToPersonId:
            form.assignedToPersonId === "unassigned"
              ? null
              : form.assignedToPersonId,
          expectedUpdatedAt: editing.updatedAt ?? undefined,
        });
        setSuccessMessage("Agendamento atualizado com sucesso.");
      } else {
        await createMutation.mutateAsync({
          customerId: form.customerId,
          assignedToPersonId:
            form.assignedToPersonId === "unassigned"
              ? undefined
              : form.assignedToPersonId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          status: form.status,
          notes: form.notes.trim() || undefined,
        });
        setSuccessMessage("Agendamento criado com sucesso.");
      }
      await Promise.all([
        utils.nexo.appointments.list.invalidate(),
        utils.nexo.serviceOrders.list.invalidate({ page: 1, limit: 100 }),
      ]);
      setOpenModal(false);
      setEditing(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao salvar agendamento.");
    }
  };

  const updateStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus) => {
      try {
        setSuccessMessage(null);
        const appointment = appointments.find(
          item => String(item.id) === appointmentId
        );
        await updateMutation.mutateAsync({
          id: appointmentId,
          status,
          expectedUpdatedAt: appointment?.updatedAt ?? undefined,
        });
        await utils.nexo.appointments.list.invalidate();
        setSuccessMessage(
          status === "CONFIRMED"
            ? "Agendamento confirmado."
            : "Agendamento cancelado."
        );
      } catch (error: any) {
        toast.error(error?.message ?? "Falha ao atualizar status.");
      }
    },
    [appointments, updateMutation, utils.nexo.appointments.list]
  );

  const loading =
    appointmentsQuery.isLoading ||
    customersQuery.isLoading ||
    peopleQuery.isLoading ||
    serviceOrdersQuery.isLoading;
  const hasError =
    appointmentsQuery.isError ||
    customersQuery.isError ||
    peopleQuery.isError ||
    serviceOrdersQuery.isError;

  const agendaHealth = useMemo(() => {
    const scheduled = mapped.filter(row => row.status === "SCHEDULED").length;
    const confirmed = mapped.filter(row => row.status === "CONFIRMED").length;
    const overdue = mapped.filter(row => row.isOverdue).length;
    const done = mapped.filter(row => row.status === "DONE").length;
    const noShow = mapped.filter(row => row.status === "NO_SHOW").length;
    const today = mapped.filter(
      row => row.start && row.start >= dayStart && row.start <= dayEnd
    ).length;
    return { scheduled, confirmed, overdue, done, noShow, today };
  }, [mapped, dayStart, dayEnd]);

  const attentionItems = useMemo(() => {
    const urgentRows = mapped
      .filter(
        row =>
          row.isOverdue ||
          row.status === "SCHEDULED" ||
          row.status === "NO_SHOW" ||
          (row.startsSoon && !row.order)
      )
      .sort(
        (a, b) =>
          (deriveAppointmentPriority(a) ?? "P3").localeCompare(
            deriveAppointmentPriority(b) ?? "P3"
          ) ||
          (a.start?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (b.start?.getTime() ?? Number.MAX_SAFE_INTEGER)
      );

    return urgentRows.slice(0, 4);
  }, [mapped]);

  const nextBestAction = useMemo(() => {
    const actionable = [...mapped].sort((a, b) => {
      const priorityOrder: Record<AppPriorityLevel, number> = {
        P0: 0,
        P1: 1,
        P2: 2,
        P3: 3,
      };
      const priorityA = deriveAppointmentPriority(a) ?? "P3";
      const priorityB = deriveAppointmentPriority(b) ?? "P3";
      if (priorityOrder[priorityA] !== priorityOrder[priorityB])
        return priorityOrder[priorityA] - priorityOrder[priorityB];
      return (
        (a.start?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.start?.getTime() ?? Number.MAX_SAFE_INTEGER)
      );
    });
    const overdue = actionable.find(row => row.isOverdue && row.item.id);
    if (overdue) {
      return {
        row: overdue,
        priority:
          deriveAppointmentPriority(overdue) ?? ("P0" as AppPriorityLevel),
        action: "Remarcar ou cancelar agendamento vencido",
        reason: `${overdue.customerName} ficou com horário vencido em ${formatDateTime(overdue.item.startsAt)}.`,
        impact:
          "Evita quebra do fluxo Cliente → Agendamento → O.S. → Financeiro.",
        ctaLabel: "Ver detalhe",
        onClick: () => setSelectedAppointmentId(String(overdue.item.id)),
      };
    }
    const unconfirmedSoon = actionable.find(
      row => row.status === "SCHEDULED" && row.startsSoon && row.item.id
    );
    if (unconfirmedSoon) {
      return {
        row: unconfirmedSoon,
        priority:
          deriveAppointmentPriority(unconfirmedSoon) ??
          ("P1" as AppPriorityLevel),
        action: "Confirmar agendamento próximo",
        reason: `${unconfirmedSoon.customerName} ainda não está confirmado e está próximo do horário.`,
        impact:
          "Reduz no-show e prepara responsável, cliente e materiais antes da execução.",
        ctaLabel: "Confirmar",
        onClick: () =>
          void updateStatus(String(unconfirmedSoon.item.id), "CONFIRMED"),
      };
    }
    const withoutOrder = actionable.find(
      row =>
        ["SCHEDULED", "CONFIRMED"].includes(row.status) &&
        !row.order &&
        row.item.id
    );
    if (withoutOrder) {
      return {
        row: withoutOrder,
        priority:
          deriveAppointmentPriority(withoutOrder) ?? ("P2" as AppPriorityLevel),
        action: "Preparar O.S. do próximo agendamento",
        reason: `${withoutOrder.customerName} ainda não possui O.S. vinculada neste carregamento.`,
        impact:
          "Antecipar a preparação evita retrabalho na passagem para execução.",
        ctaLabel: "Criar O.S.",
        onClick: () => {
          setSelectedAppointmentId(String(withoutOrder.item.id));
          setOpenServiceOrderModal(true);
        },
      };
    }
    return null;
  }, [mapped, updateStatus]);

  function goToWhatsAppAppointment(customerId: string, appointmentId: string) {
    if (!String(customerId ?? "").trim()) {
      toast.error("Agendamento sem cliente válido para WhatsApp.");
      return;
    }
    if (!String(appointmentId ?? "").trim()) {
      toast.error("Agendamento inválido para abrir WhatsApp.");
      return;
    }
    navigate(
      `/whatsapp?customerId=${customerId}&appointmentId=${appointmentId}&template=APPOINTMENT_REMINDER`
    );
  }
  return (
    <AppPageShell>
      <div className="flex flex-col gap-4">
        <AppOperationalHeader
          title="Agendamentos"
          description="Controle do tempo, confirmação e preparação da execução"
          density="compact"
          primaryAction={
            <Button
              className="bg-[var(--accent-primary)] text-[var(--primary-foreground)] hover:bg-[var(--accent-primary-hover)]"
              onClick={() => {
                setEditing(null);
                setOpenModal(true);
              }}
            >
              Novo agendamento
            </Button>
          }
        >
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <AppInput
              value={queryText}
              onChange={event => setQueryText(event.target.value)}
              placeholder="Buscar cliente, observação ou serviço"
              className="h-9"
            />
            <div className="flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-muted)]">
              {mapped.length} agendamento(s)
            </div>
          </div>
        </AppOperationalHeader>

        <AppSectionBlock
          title="Resumo operacional"
          subtitle="KPIs da agenda para confirmar, prevenir atraso e preparar execução."
          compact
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Saúde calculada com a carteira carregada, sem mudar filtros ou
              regras de status.
            </p>
            <AppStatusBadge
              label={
                agendaHealth.noShow > 0
                  ? "CRÍTICO"
                  : agendaHealth.overdue > 0
                    ? "RISCO"
                    : agendaHealth.scheduled > 0
                      ? "ATENÇÃO"
                      : "NORMAL"
              }
              tone={
                agendaHealth.noShow > 0
                  ? "danger"
                  : agendaHealth.overdue > 0
                    ? "accent"
                    : agendaHealth.scheduled > 0
                      ? "warning"
                      : "success"
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["Hoje", agendaHealth.today, "Entradas previstas para o dia."],
              [
                "Confirmados",
                agendaHealth.confirmed,
                "Agenda preparada para execução.",
              ],
              [
                "Não confirmados",
                agendaHealth.scheduled,
                "Pedem confirmação para reduzir no-show.",
              ],
              [
                "Atrasados",
                agendaHealth.overdue,
                "Horários vencidos ainda abertos.",
              ],
              [
                "Concluídos",
                agendaHealth.done,
                "Atendimentos encerrados no carregamento.",
              ],
            ].map(([label, value, helper]) => (
              <article
                key={String(label)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"
              >
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {value}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {helper}
                </p>
              </article>
            ))}
          </div>
        </AppSectionBlock>

        {/* Contrato AppSectionCard oficial preservado via AppSectionBlock: Próxima melhor ação. */}
        <AppNextBestActionBlock
          title="Próxima melhor ação"
          subtitle="Sugestão calculada somente com os agendamentos, clientes, responsáveis e O.S. já carregados."
          compact
        >
          {nextBestAction ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AppPriorityBadge
                    priority={nextBestAction.priority}
                    label={appointmentPriorityLabel(nextBestAction.priority)}
                  />
                  <AppStatusBadge
                    {...mapOperationalStatus(nextBestAction.row)}
                  />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {nextBestAction.action}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Motivo: {nextBestAction.reason}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Impacto: {nextBestAction.impact}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={nextBestAction.onClick}
              >
                {nextBestAction.ctaLabel}
              </Button>
            </div>
          ) : (
            <AppPageEmptyState
              title="Sem ação imediata"
              description="Não há agendamento carregado exigindo confirmação, remarcação ou preparação de O.S. agora."
            />
          )}
        </AppNextBestActionBlock>

        <AppSectionBlock
          title="Atenção imediata"
          subtitle="Não confirmados, atrasos, risco de no-show e preparação pendente."
          compact
        >
          {attentionItems.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {attentionItems.map(row => {
                const priority = deriveAppointmentPriority(row) ?? "P3";
                return (
                  <article
                    key={String(
                      row.item.id ?? `${row.customerId}-${row.item.startsAt}`
                    )}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <AppPriorityBadge
                        priority={priority}
                        label={appointmentPriorityLabel(priority)}
                      />
                      <AppStatusBadge {...mapOperationalStatusBadge(row)} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                      {row.customerName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatDateTime(row.item.startsAt)} · {row.ownerName}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      Próxima ação: {nextActionLabel(row)}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <AppPageEmptyState
              title="Sem atenção imediata"
              description="Nenhum agendamento carregado está atrasado, sem confirmação ou com preparação pendente crítica."
            />
          )}
        </AppSectionBlock>

        <AppFiltersBar className="shrink-0 gap-2 border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-3">
          {FILTERS.map(filter => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSelectedFilter(filter.key)}
              className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                selectedFilter === filter.key
                  ? "bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                  : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
              }`}
            >
              {filter.label}
            </button>
          ))}
          <select
            className="h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-muted)]"
            value={responsibleFilter}
            onChange={event => setResponsibleFilter(event.target.value)}
          >
            <option value="all">Responsável: todos</option>
            {people.map((person: any) => (
              <option key={String(person.id)} value={String(person.id)}>
                {String(person.name ?? "Colaborador")}
              </option>
            ))}
          </select>
        </AppFiltersBar>

        {successMessage ? (
          <p className="text-sm text-[var(--success)]">{successMessage}</p>
        ) : null}

        <AppSectionBlock
          title="Carteira operacional"
          subtitle="Visão compacta de execução com leitura rápida por card."
          className="flex flex-col"
        >
          {loading ? (
            <AppPageLoadingState description="Carregando agendamentos..." />
          ) : hasError ? (
            <AppPageErrorState
              description="Erro ao carregar dados operacionais de agendamentos."
              actionLabel="Tentar novamente"
              onAction={() => {
                void Promise.all([
                  appointmentsQuery.refetch(),
                  customersQuery.refetch(),
                  peopleQuery.refetch(),
                  serviceOrdersQuery.refetch(),
                ]);
              }}
            />
          ) : mapped.length === 0 ? (
            <AppPageEmptyState
              title="Sem agendamentos"
              description="Não há agendamentos cadastrados no backend para este ambiente."
            />
          ) : filtered.length === 0 ? (
            <AppPageEmptyState
              title="Busca sem resultado"
              description="Nenhum agendamento encontrado para o filtro atual."
            />
          ) : (
            <>
              <AppDataTable className="min-w-[1180px]">
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Cliente</th>
                    <th>Observação curta</th>
                    <th>Status</th>
                    <th>Responsável</th>
                    <th>Duração</th>
                    <th>Próxima ação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAppointments.map(row => {
                    const status = mapStatus(row.item.status);
                    const orderId = row.order?.id ? String(row.order.id) : null;
                    const appointmentId = String(row.item.id ?? "");
                    const isSelected = selectedAppointmentId === appointmentId;
                    const operationalStatus =
                      deriveAppointmentOperationalStatus(row);
                    const priority = deriveAppointmentPriority(row);
                    const operationalBadge = mapOperationalStatusBadge(row);
                    return (
                      <tr
                        key={appointmentId}
                        className={
                          isSelected
                            ? "bg-[var(--nexo-table-row-selected,var(--surface-subtle))]"
                            : undefined
                        }
                        onClick={() => setSelectedAppointmentId(appointmentId)}
                      >
                        <td>{formatDateTime(row.item.startsAt)}</td>
                        <td className="font-semibold text-[var(--text-primary)]">
                          {row.customerName}
                        </td>
                        <td className="max-w-[220px] truncate">
                          {row.item.title || row.item.notes || "Sem observação"}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <AppStatusBadge
                              label={status.label}
                              tone={status.tone}
                            />
                            <AppStatusBadge {...operationalBadge} />
                            <AppStatusBadge
                              label={operationalStatus}
                              tone={mapOperationalStatus(row).tone}
                            />
                          </div>
                        </td>
                        <td>{row.ownerName}</td>
                        <td>
                          {durationLabel(row.item.startsAt, row.item.endsAt)}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            {priority ? (
                              <AppPriorityBadge
                                priority={priority}
                                label={appointmentPriorityLabel(priority)}
                              />
                            ) : null}
                            <span>{nextActionLabel(row)}</span>
                            <span className="text-[var(--text-muted)]">
                              {orderId ? `· O.S. #${orderId}` : "· sem O.S."}
                            </span>
                          </div>
                        </td>
                        <td onClick={event => event.stopPropagation()}>
                          <AppRowActionsDropdown
                            triggerLabel="Ações do agendamento"
                            items={[
                              {
                                label: "Confirmar",
                                onSelect: () =>
                                  void updateStatus(
                                    String(row.item.id),
                                    "CONFIRMED"
                                  ),
                                disabled: !row.item.id,
                                tone: "primary",
                              },
                              {
                                label: "Iniciar atendimento",
                                onSelect: () => {
                                  if (orderId) {
                                    navigate(
                                      `/service-orders?customerId=${row.customerId}&appointmentId=${row.item.id}`
                                    );
                                    return;
                                  }
                                  setSelectedAppointmentId(String(row.item.id));
                                  setOpenServiceOrderModal(true);
                                },
                                disabled: !row.item.id,
                              },
                              {
                                label: "Cancelar",
                                onSelect: () =>
                                  void updateStatus(
                                    String(row.item.id),
                                    "CANCELED"
                                  ),
                                disabled: !row.item.id,
                              },
                              {
                                label: "Editar/Remarcar",
                                onSelect: () => {
                                  setEditing(row.item);
                                  setOpenModal(true);
                                },
                                disabled: !row.item.id,
                              },
                              {
                                label: "Criar O.S.",
                                onSelect: () => {
                                  setSelectedAppointmentId(String(row.item.id));
                                  setOpenServiceOrderModal(true);
                                },
                                disabled: !row.item.id,
                              },
                              { type: "separator" },
                              {
                                label: "Abrir detalhe",
                                onSelect: () =>
                                  setSelectedAppointmentId(String(row.item.id)),
                                disabled: !row.item.id,
                              },
                              {
                                label: "Abrir cliente",
                                onSelect: () =>
                                  navigate(
                                    `/customers?customerId=${row.customerId}`
                                  ),
                                disabled: !row.customerId,
                              },
                              {
                                label: "Enviar WhatsApp",
                                onSelect: () =>
                                  goToWhatsAppAppointment(
                                    String(row.customerId ?? ""),
                                    String(row.item.id ?? "")
                                  ),
                                disabled: !row.customerId || !row.item.id,
                              },
                              {
                                label: "Abrir O.S.",
                                onSelect: () =>
                                  orderId
                                    ? navigate(
                                        `/service-orders?customerId=${row.customerId}&appointmentId=${row.item.id}`
                                      )
                                    : undefined,
                                disabled: !orderId,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </AppDataTable>
              <AppPagination
                currentPage={currentPage}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </AppSectionBlock>

        <AppSectionBlock
          title="Detalhe do agendamento"
          subtitle="Resumo, histórico e ações operacionais do agendamento selecionado."
          className="flex flex-col"
        >
          {!selected ? (
            <AppPageEmptyState
              title="Selecione um agendamento"
              description="Escolha um card da carteira para abrir os detalhes operacionais."
            />
          ) : (
            <div className="space-y-3">
              <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/35 p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {selected.customerName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <AppStatusBadge
                    label={mapStatus(selected.item.status).label}
                    tone={mapStatus(selected.item.status).tone}
                  />
                  <AppStatusBadge {...mapOperationalStatusBadge(selected)} />
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {formatDateTime(selected.item.startsAt)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Responsável: {selected.ownerName} · Duração:{" "}
                  {durationLabel(selected.item.startsAt, selected.item.endsAt)}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Observações: {selected.item.notes || "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  O.S. vinculada:{" "}
                  {selected.order?.id ? `#${selected.order.id}` : "sem O.S."}
                </p>
              </article>

              <AppActionBar className="gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void updateStatus(String(selected.item.id), "CONFIRMED")
                  }
                  disabled={!selected.item.id}
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void updateStatus(String(selected.item.id), "CANCELED")
                  }
                  disabled={!selected.item.id}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(selected.item);
                    setOpenModal(true);
                  }}
                  disabled={!selected.item.id}
                >
                  Remarcar/Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenServiceOrderModal(true)}
                  disabled={!selected.item.id}
                >
                  Abrir/criar O.S.
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    goToWhatsAppAppointment(
                      String(selected.customerId ?? ""),
                      String(selected.item.id ?? "")
                    )
                  }
                  disabled={!selected.customerId || !selected.item.id}
                >
                  Enviar WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(`/customers?customerId=${selected.customerId}`)
                  }
                  disabled={!selected.customerId}
                >
                  Abrir cliente
                </Button>
              </AppActionBar>

              <div className="pt-1">
                <p className="mb-2 text-xs uppercase text-[var(--text-muted)]">
                  Timeline / histórico
                </p>
                {queryParams.customerId ? (
                  <AppEmbeddedTimeline
                    items={timeline.slice(0, 5).map((event: any) => ({
                      id: String(
                        event?.id ?? `${event?.createdAt}-${event?.action}`
                      ),
                      type: String(event?.action ?? "Evento"),
                      summary: String(
                        event?.description ?? event?.summary ?? "Sem descrição"
                      ),
                      entity: String(event?.entityType ?? "Agendamento"),
                      actor: String(
                        event?.actorName ?? event?.actor ?? "Sistema"
                      ),
                      happenedAt: formatDateTime(
                        String(event?.createdAt ?? event?.occurredAt ?? "")
                      ),
                    }))}
                    emptyMessage="Sem histórico para este cliente."
                  />
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    Histórico disponível ao abrir com customerId na URL.
                  </p>
                )}
              </div>
            </div>
          )}
        </AppSectionBlock>
      </div>

      <FormModal
        open={openModal}
        onOpenChange={next => {
          if (!next) {
            setOpenModal(false);
            setEditing(null);
          }
        }}
        title={editing ? "Editar agendamento" : "Novo agendamento"}
        description="Operação real conectada ao backend"
        closeBlocked={createMutation.isPending || updateMutation.isPending}
        contentClassName="bg-[var(--modal-bg)]"
        footer={
          <>
            <p className="mr-auto text-xs text-[var(--text-muted)]">
              Resumo:{" "}
              {form.customerId
                ? (customerById.get(form.customerId) ?? "Cliente")
                : "Selecione cliente"}{" "}
              · {form.date || "Data"} {form.time || "Hora"}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpenModal(false);
                setEditing(null);
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="appointment-form"
              className="bg-[var(--accent-primary)] text-[var(--primary-foreground)] hover:bg-[var(--accent-primary-hover)]"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Salvando..."
                : "Salvar"}
            </Button>
          </>
        }
      >
        <AppForm id="appointment-form" onSubmit={saveAppointment}>
          <AppField label="Cliente">
            <AppSelect
              value={form.customerId}
              onValueChange={customerId =>
                setForm(prev => ({ ...prev, customerId }))
              }
              placeholder="Selecione"
              options={customers.map((item: any) => ({
                value: String(item.id),
                label: String(item.name ?? "Cliente"),
              }))}
            />
          </AppField>
          <div className="grid gap-3 md:grid-cols-2">
            <AppField label="Data">
              <AppInput
                type="date"
                value={form.date}
                onChange={event =>
                  setForm(prev => ({ ...prev, date: event.target.value }))
                }
              />
            </AppField>
            <AppField label="Hora">
              <AppInput
                type="time"
                value={form.time}
                onChange={event =>
                  setForm(prev => ({ ...prev, time: event.target.value }))
                }
              />
            </AppField>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <AppField label="Status">
              <AppSelect
                value={form.status}
                onValueChange={status =>
                  setForm(prev => ({
                    ...prev,
                    status: status as AppointmentStatus,
                  }))
                }
                options={[
                  { value: "SCHEDULED", label: "Não confirmado" },
                  { value: "CONFIRMED", label: "Confirmado" },
                  { value: "DONE", label: "Concluído" },
                  { value: "CANCELED", label: "Cancelado" },
                  { value: "NO_SHOW", label: "No-show" },
                ]}
              />
            </AppField>
            <AppField label="Duração (min)">
              <AppInput
                type="number"
                min={15}
                value={form.durationMinutes}
                onChange={event =>
                  setForm(prev => ({
                    ...prev,
                    durationMinutes: event.target.value,
                  }))
                }
              />
            </AppField>
          </div>
          <AppField label="Responsável">
            <AppSelect
              value={form.assignedToPersonId}
              onValueChange={assignedToPersonId =>
                setForm(prev => ({ ...prev, assignedToPersonId }))
              }
              placeholder="Opcional"
              options={[
                { value: "unassigned", label: "Sem responsável" },
                ...people.map((item: any) => ({
                  value: String(item.id),
                  label: String(item.name ?? "Responsável"),
                })),
              ]}
            />
            <PersonAssignmentWarning
              personId={
                form.assignedToPersonId === "unassigned"
                  ? null
                  : form.assignedToPersonId
              }
              onWarningShown={assigneeWarningTelemetry.trackShown}
            />
          </AppField>
          <AppField label="Observação">
            <AppInput
              value={form.notes}
              onChange={event =>
                setForm(prev => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Observação operacional"
            />
          </AppField>
        </AppForm>
      </FormModal>

      <CreateServiceOrderModal
        isOpen={openServiceOrderModal}
        onClose={() => setOpenServiceOrderModal(false)}
        onSuccess={() => {
          setSuccessMessage("O.S. criada com sucesso.");
          void Promise.all([
            utils.nexo.serviceOrders.list.invalidate({ page: 1, limit: 100 }),
            utils.nexo.appointments.list.invalidate(),
          ]);
        }}
        customers={customers.map((item: any) => ({
          id: String(item.id),
          name: String(item.name ?? "Cliente"),
        }))}
        people={people.map((item: any) => ({
          id: String(item.id),
          name: String(item.name ?? "Pessoa"),
        }))}
        initialCustomerId={selected?.customerId ?? queryParams.customerId}
        appointmentId={
          selected?.item?.id ? String(selected.item.id) : undefined
        }
      />
    </AppPageShell>
  );
}
