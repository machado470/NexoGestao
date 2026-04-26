import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { Button } from "@/components/design-system";
import { FormModal } from "@/components/app-modal-system";
import {
  AppEmptyState,
  AppErrorState,
  AppField,
  AppForm,
  AppInput,
  AppRowActionsDropdown,
  AppSelect,
  AppStatusBadge,
  AppTimeline,
  AppTimelineItem,
} from "@/components/app-system";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";

type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "CANCELED" | "DONE" | "NO_SHOW";
type FilterKey = "all" | "today" | "tomorrow" | "week" | "unconfirmed" | "confirmed" | "overdue" | "canceled";

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
  const normalized = String(status ?? "SCHEDULED").toUpperCase() as AppointmentStatus;
  if (normalized === "SCHEDULED") return { label: "Não confirmado", tone: "warning" as const };
  if (normalized === "CONFIRMED") return { label: "Confirmado", tone: "success" as const };
  if (normalized === "DONE") return { label: "Concluído", tone: "info" as const };
  if (normalized === "CANCELED") return { label: "Cancelado", tone: "danger" as const };
  return { label: "No-show", tone: "accent" as const };
}

export default function AppointmentsPage() {
  const [location, navigate] = useLocation();
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("today");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [openServiceOrderModal, setOpenServiceOrderModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    const params = new URLSearchParams(queryString);
    return {
      customerId: params.get("customerId"),
      appointmentId: params.get("appointmentId"),
    };
  }, [location]);

  const utils = trpc.useUtils();
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const timelineQuery = trpc.nexo.timeline.listByCustomer.useQuery(
    { customerId: queryParams.customerId ?? "", limit: 25 },
    { enabled: Boolean(queryParams.customerId), retry: false }
  );

  const createMutation = trpc.nexo.appointments.create.useMutation();
  const updateMutation = trpc.nexo.appointments.update.useMutation();

  const appointments = useMemo(() => normalizeArrayPayload<AppointmentRow>(appointmentsQuery.data), [appointmentsQuery.data]);
  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const timeline = useMemo(() => normalizeArrayPayload<any>(timelineQuery.data), [timelineQuery.data]);

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
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const tomorrowStart = new Date(dayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(dayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const weekEnd = new Date(dayEnd); weekEnd.setDate(weekEnd.getDate() + 7);
  const periodStart = new Date(dayStart); periodStart.setDate(periodStart.getDate() - 7);

  const mapped = useMemo(() => appointments.map((item) => {
    const start = asDate(item.startsAt);
    const status = String(item.status ?? "SCHEDULED").toUpperCase();
    const customerId = String(item.customerId ?? item.customer?.id ?? "");
    const customerName = item.customer?.name || customerById.get(customerId) || "Cliente não identificado";
    const order = orderByAppointment.get(String(item.id ?? ""));
    const isOverdue = Boolean(start && start < now && ["SCHEDULED", "CONFIRMED"].includes(status));
    const startsSoon = Boolean(start && start >= now && (start.getTime() - now.getTime()) / 60000 <= 120);
    return {
      item,
      status,
      start,
      customerId,
      customerName,
      ownerName: personById.get(String(item.assignedToPersonId ?? item.personId ?? "")) ?? "Não definido",
      order,
      isOverdue,
      startsSoon,
    };
  }), [appointments, customerById, orderByAppointment, personById, now]);

  const filtered = useMemo(() => {
    let base = mapped;
    if (queryParams.customerId) base = base.filter((row) => row.customerId === queryParams.customerId);

    if (selectedFilter === "today") base = base.filter((row) => row.start && row.start >= dayStart && row.start <= dayEnd);
    if (selectedFilter === "tomorrow") base = base.filter((row) => row.start && row.start >= tomorrowStart && row.start <= tomorrowEnd);
    if (selectedFilter === "week") base = base.filter((row) => row.start && row.start >= dayStart && row.start <= weekEnd);
    if (selectedFilter === "unconfirmed") base = base.filter((row) => row.status === "SCHEDULED");
    if (selectedFilter === "confirmed") base = base.filter((row) => row.status === "CONFIRMED");
    if (selectedFilter === "overdue") base = base.filter((row) => row.isOverdue);
    if (selectedFilter === "canceled") base = base.filter((row) => row.status === "CANCELED");

    const search = queryText.trim().toLowerCase();
    if (search) {
      base = base.filter((row) => `${row.customerName} ${row.item.title ?? ""} ${row.item.notes ?? ""}`.toLowerCase().includes(search));
    }

    return [...base].sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));
  }, [mapped, queryParams.customerId, selectedFilter, queryText, dayStart, dayEnd, tomorrowStart, tomorrowEnd, weekEnd]);

  useEffect(() => {
    if (queryParams.appointmentId) {
      setSelectedAppointmentId(queryParams.appointmentId);
      return;
    }
    if (!selectedAppointmentId && filtered[0]?.item?.id) setSelectedAppointmentId(String(filtered[0].item.id));
  }, [queryParams.appointmentId, filtered, selectedAppointmentId]);

  const selected = filtered.find((row) => String(row.item.id ?? "") === String(selectedAppointmentId ?? "")) ?? null;

  const stats = useMemo(() => ({
    unconfirmed: mapped.filter((row) => row.status === "SCHEDULED").length,
    soon: mapped.filter((row) => row.startsSoon).length,
    overdue: mapped.filter((row) => row.isOverdue).length,
    canceled: mapped.filter((row) => row.status === "CANCELED" && row.start && row.start >= periodStart).length,
  }), [mapped, periodStart]);

  const [form, setForm] = useState({ customerId: "", date: "", time: "", status: "SCHEDULED" as AppointmentStatus, notes: "", assignedToPersonId: "", durationMinutes: "60" });

  useEffect(() => {
    if (!openModal) return;
    if (editing) {
      const start = asDate(editing.startsAt);
      const end = asDate(editing.endsAt);
      setForm({
        customerId: String(editing.customerId ?? editing.customer?.id ?? queryParams.customerId ?? ""),
        date: start ? start.toISOString().slice(0, 10) : "",
        time: start ? start.toISOString().slice(11, 16) : "",
        status: String(editing.status ?? "SCHEDULED").toUpperCase() as AppointmentStatus,
        notes: String(editing.notes ?? ""),
        assignedToPersonId: String(editing.assignedToPersonId ?? editing.personId ?? ""),
        durationMinutes: start && end ? String(Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000))) : "60",
      });
      return;
    }
    setForm({ customerId: queryParams.customerId ?? "", date: "", time: "", status: "SCHEDULED", notes: "", assignedToPersonId: "", durationMinutes: "60" });
  }, [openModal, editing, queryParams.customerId]);

  const saveAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    const startsAt = new Date(`${form.date}T${form.time}`);
    if (!form.customerId || Number.isNaN(startsAt.getTime())) {
      toast.error("Cliente, data e hora são obrigatórios.");
      return;
    }
    const endsAt = new Date(startsAt.getTime() + Math.max(15, Number(form.durationMinutes) || 60) * 60000);

    try {
      if (editing?.id) {
        await updateMutation.mutateAsync({
          id: String(editing.id),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          status: form.status,
          notes: form.notes.trim() || undefined,
        });
        setSuccessMessage("Agendamento atualizado com sucesso.");
      } else {
        await createMutation.mutateAsync({
          customerId: form.customerId,
          assignedToPersonId: form.assignedToPersonId || undefined,
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

  const updateStatus = async (appointmentId: string, status: AppointmentStatus) => {
    try {
      setSuccessMessage(null);
      await updateMutation.mutateAsync({ id: appointmentId, status });
      await utils.nexo.appointments.list.invalidate();
      setSuccessMessage(status === "CONFIRMED" ? "Agendamento confirmado." : "Agendamento cancelado.");
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao atualizar status.");
    }
  };

  const loading = appointmentsQuery.isLoading || customersQuery.isLoading || peopleQuery.isLoading || serviceOrdersQuery.isLoading;
  const hasError = appointmentsQuery.isError || customersQuery.isError || peopleQuery.isError || serviceOrdersQuery.isError;

  return (
    <PageWrapper
      title="Agendamentos"
      subtitle="controle do tempo, confirmação e preparação da execução"
      primaryAction={<Button className="bg-orange-500 text-white hover:bg-orange-400" onClick={() => { setEditing(null); setOpenModal(true); }}>Novo agendamento</Button>}
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Agendamentos</h1>
          <p className="text-sm text-[var(--text-muted)]">controle do tempo, confirmação e preparação da execução</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Total real: {mapped.length} agendamento(s)</p>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Não confirmados</p><p className="text-lg font-semibold">{stats.unconfirmed}</p></div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Próximos</p><p className="text-lg font-semibold">{stats.soon}</p></div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Atrasados</p><p className="text-lg font-semibold">{stats.overdue}</p></div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Cancelados (período)</p><p className="text-lg font-semibold">{stats.canceled}</p></div>
        </section>

        <section className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button key={filter.key} type="button" onClick={() => setSelectedFilter(filter.key)} className={`rounded-full border px-3 py-1 text-xs ${selectedFilter === filter.key ? "border-orange-400 text-orange-300" : "border-[var(--border-subtle)] text-[var(--text-muted)]"}`}>
              {filter.label}
            </button>
          ))}
          <AppInput value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar cliente, observação, serviço" className="ml-auto w-full md:w-72" />
        </section>

        {successMessage ? <p className="text-sm text-emerald-400">{successMessage}</p> : null}

        {loading ? <p className="text-sm text-[var(--text-muted)]">Carregando agendamentos...</p> : null}
        {hasError ? <AppErrorState message="Erro ao carregar dados operacionais de agendamentos." /> : null}
        {!loading && !hasError && mapped.length === 0 ? <AppEmptyState title="Sem agendamentos" description="Não há agendamentos cadastrados no backend para este ambiente." /> : null}
        {!loading && !hasError && mapped.length > 0 && filtered.length === 0 ? <AppEmptyState title="Busca sem resultado" description="Nenhum agendamento encontrado para o filtro atual." /> : null}

        {!loading && !hasError && filtered.length > 0 ? (
          <section className="space-y-3">
            {filtered.map((row) => {
              const status = mapStatus(row.item.status);
              const orderId = row.order?.id ? String(row.order.id) : null;
              return (
                <article key={String(row.item.id)} className={`rounded-2xl border p-4 ${selectedAppointmentId === String(row.item.id) ? "border-orange-400" : "border-[var(--border-subtle)]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" className="space-y-1 text-left" onClick={() => setSelectedAppointmentId(String(row.item.id ?? ""))}>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{formatDateTime(row.item.startsAt)} · {row.customerName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{row.item.title || row.item.notes || "Sem observação"}</p>
                      <p className="text-xs text-[var(--text-muted)]">Responsável: {row.ownerName} · Duração: {durationLabel(row.item.startsAt, row.item.endsAt)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{orderId ? `O.S. #${orderId}` : "sem O.S."}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <AppStatusBadge label={status.label} tone={status.tone} />
                      <AppRowActionsDropdown
                        triggerLabel="Ações do agendamento"
                        items={[
                          { label: "Confirmar", onSelect: () => void updateStatus(String(row.item.id), "CONFIRMED"), disabled: !row.item.id, tone: "primary" },
                          { label: "Cancelar", onSelect: () => void updateStatus(String(row.item.id), "CANCELED"), disabled: !row.item.id },
                          { label: "Editar/Remarcar", onSelect: () => { setEditing(row.item); setOpenModal(true); }, disabled: !row.item.id },
                          { label: "Criar O.S.", onSelect: () => { setSelectedAppointmentId(String(row.item.id)); setOpenServiceOrderModal(true); }, disabled: !row.item.id },
                          { type: "separator" },
                          { label: "Abrir cliente", onSelect: () => navigate(`/customers?customerId=${row.customerId}`), disabled: !row.customerId },
                          { label: "Enviar WhatsApp", onSelect: () => navigate(`/whatsapp?customerId=${row.customerId}&appointmentId=${row.item.id}`), disabled: !row.customerId || !row.item.id },
                          { label: "Abrir O.S.", onSelect: () => orderId ? navigate(`/service-orders?customerId=${row.customerId}&appointmentId=${row.item.id}`) : undefined, disabled: !orderId },
                        ]}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Detalhe do agendamento</h2>
          {!selected ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Selecione um agendamento para ver contexto operacional.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p><strong>Cliente:</strong> {selected.customerName}</p>
              <p><strong>Data/hora:</strong> {formatDateTime(selected.item.startsAt)}</p>
              <p><strong>Status:</strong> {mapStatus(selected.item.status).label}</p>
              <p><strong>Observações:</strong> {selected.item.notes || "—"}</p>
              <p><strong>Responsável:</strong> {selected.ownerName}</p>
              <p><strong>O.S. vinculada:</strong> {selected.order?.id ? `#${selected.order.id}` : "sem O.S."}</p>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" onClick={() => void updateStatus(String(selected.item.id), "CONFIRMED")} disabled={!selected.item.id}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => void updateStatus(String(selected.item.id), "CANCELED")} disabled={!selected.item.id}>Cancelar</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(selected.item); setOpenModal(true); }} disabled={!selected.item.id}>Remarcar/Editar</Button>
                <Button size="sm" variant="outline" onClick={() => setOpenServiceOrderModal(true)} disabled={!selected.item.id}>Abrir/criar O.S.</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/whatsapp?customerId=${selected.customerId}&appointmentId=${selected.item.id}`)} disabled={!selected.customerId || !selected.item.id}>Enviar WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/customers?customerId=${selected.customerId}`)} disabled={!selected.customerId}>Abrir cliente</Button>
              </div>

              <div className="pt-2">
                <p className="mb-2 text-xs uppercase text-[var(--text-muted)]">Timeline / histórico</p>
                {queryParams.customerId ? (
                  <AppTimeline>
                    {timeline.slice(0, 5).map((event: any) => (
                      <AppTimelineItem key={String(event?.id ?? `${event?.createdAt}-${event?.action}`)}>
                        <p className="text-xs text-[var(--text-primary)]">{String(event?.action ?? "Evento")}</p>
                        <p className="text-xs text-[var(--text-muted)]">{String(event?.description ?? event?.summary ?? "Sem descrição")}</p>
                      </AppTimelineItem>
                    ))}
                    {!timeline.length ? <p className="text-xs text-[var(--text-muted)]">Sem histórico para este cliente.</p> : null}
                  </AppTimeline>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">Histórico disponível ao abrir com customerId na URL.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <FormModal
        open={openModal}
        onOpenChange={(next) => { if (!next) { setOpenModal(false); setEditing(null); } }}
        title={editing ? "Editar agendamento" : "Novo agendamento"}
        description="Operação real conectada ao backend"
        closeBlocked={createMutation.isPending || updateMutation.isPending}
        contentClassName="bg-[#0B1220]"
        footer={(
          <>
            <p className="mr-auto text-xs text-[var(--text-muted)]">Resumo: {form.customerId ? (customerById.get(form.customerId) ?? "Cliente") : "Selecione cliente"} · {form.date || "Data"} {form.time || "Hora"}</p>
            <Button type="button" variant="outline" onClick={() => { setOpenModal(false); setEditing(null); }} disabled={createMutation.isPending || updateMutation.isPending}>Cancelar</Button>
            <Button type="submit" form="appointment-form" className="bg-orange-500 text-white hover:bg-orange-400" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}</Button>
          </>
        )}
      >
        <AppForm id="appointment-form" onSubmit={saveAppointment}>
          <AppField label="Cliente">
            <AppSelect
              value={form.customerId}
              onValueChange={(customerId) => setForm((prev) => ({ ...prev, customerId }))}
              placeholder="Selecione"
              options={customers.map((item: any) => ({ value: String(item.id), label: String(item.name ?? "Cliente") }))}
            />
          </AppField>
          <div className="grid gap-3 md:grid-cols-2">
            <AppField label="Data"><AppInput type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} /></AppField>
            <AppField label="Hora"><AppInput type="time" value={form.time} onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))} /></AppField>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <AppField label="Status">
              <AppSelect value={form.status} onValueChange={(status) => setForm((prev) => ({ ...prev, status: status as AppointmentStatus }))} options={[
                { value: "SCHEDULED", label: "Não confirmado" },
                { value: "CONFIRMED", label: "Confirmado" },
                { value: "DONE", label: "Concluído" },
                { value: "CANCELED", label: "Cancelado" },
                { value: "NO_SHOW", label: "No-show" },
              ]} />
            </AppField>
            <AppField label="Duração (min)"><AppInput type="number" min={15} value={form.durationMinutes} onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))} /></AppField>
          </div>
          <AppField label="Responsável">
            <AppSelect value={form.assignedToPersonId || undefined} onValueChange={(assignedToPersonId) => setForm((prev) => ({ ...prev, assignedToPersonId }))} placeholder="Opcional" options={people.map((item: any) => ({ value: String(item.id), label: String(item.name ?? "Responsável") }))} />
          </AppField>
          <AppField label="Observação"><AppInput value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Observação operacional" /></AppField>
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
        customers={customers.map((item: any) => ({ id: String(item.id), name: String(item.name ?? "Cliente") }))}
        people={people.map((item: any) => ({ id: String(item.id), name: String(item.name ?? "Pessoa") }))}
        initialCustomerId={selected?.customerId ?? queryParams.customerId}
        appointmentId={selected?.item?.id ? String(selected.item.id) : undefined}
      />
    </PageWrapper>
  );
}
