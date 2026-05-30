import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useLocation } from "wouter";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { AppStatCard } from "@/components/app-system";
import { Button } from "@/components/design-system";
import { AppDataTable, AppPageEmptyState, AppPageErrorState, AppPageLoadingState, AppSectionBlock, AppStatusBadge } from "@/components/internal-page-system";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";

type LoadStatus = "IDLE" | "NORMAL" | "BUSY" | "OVERLOADED";
type CapacityStatus = "UNDER_CAPACITY" | "AT_CAPACITY" | "OVER_CAPACITY";
type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE_NOW" | "UNAVAILABLE_SOON";
type AvailabilityException = { id: string; startsAt: string; endsAt: string; reason?: string | null };
type OperationalPerson = {
  personId: string; name: string; role: string; status: "ACTIVE" | "INACTIVE";
  openServiceOrdersCount: number; overdueServiceOrdersCount: number; futureAppointmentsCount: number; todayAppointmentsCount: number;
  lastActivityAt?: string | null; loadStatus: LoadStatus;
  dailyServiceOrderCapacity: number | null; dailyAppointmentCapacity: number | null; workloadNotes?: string | null;
  serviceOrderCapacityUsagePct: number | null; appointmentCapacityUsagePct: number | null; capacityStatus: CapacityStatus;
  availabilityStatus: AvailabilityStatus; currentAvailabilityException?: AvailabilityException | null; nextAvailabilityException?: AvailabilityException | null;
};

const loadLabels: Record<LoadStatus, string> = { IDLE: "Sem carga", NORMAL: "Normal", BUSY: "Ocupado", OVERLOADED: "Sobrecarregado" };
const capacityLabels: Record<CapacityStatus, string> = { UNDER_CAPACITY: "Dentro da capacidade", AT_CAPACITY: "Perto do limite", OVER_CAPACITY: "Acima da capacidade" };
const availabilityLabels: Record<AvailabilityStatus, string> = { AVAILABLE: "Disponível", UNAVAILABLE_NOW: "Indisponível agora", UNAVAILABLE_SOON: "Indisponível em breve" };
const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não registrada";
const formatCapacity = (value: number | null) => value == null ? "Não configurada" : `${value}/dia`;
const formatUsage = (value: number | null) => value == null ? "Uso indisponível" : `${value}% usado`;
const formatDifference = (current: number, capacity: number | null) => capacity == null ? "Diferença indisponível" : `${capacity - current} de margem`;

export default function PeoplePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isInitializing, role } = useAuth();
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const summaryQuery = trpc.people.operationalSummary.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const exceptionsQuery = trpc.people.listAvailabilityExceptions.useQuery({ personId: selectedPersonId ?? "" }, { enabled: Boolean(selectedPersonId), retry: false });
  const createAvailabilityException = trpc.people.createAvailabilityException.useMutation({ onSuccess: async () => { setStartsAt(""); setEndsAt(""); setReason(""); await Promise.all([utils.people.operationalSummary.invalidate(), utils.people.listAvailabilityExceptions.invalidate()]); } });
  const deleteAvailabilityException = trpc.people.deleteAvailabilityException.useMutation({ onSuccess: async () => { await Promise.all([utils.people.operationalSummary.invalidate(), utils.people.listAvailabilityExceptions.invalidate()]); } });
  const people = ((summaryQuery.data ?? { people: [] }) as { people: OperationalPerson[] }).people ?? [];
  const selectedPerson = people.find((person) => person.personId === selectedPersonId) ?? null;
  const exceptions = (exceptionsQuery.data ?? []) as AvailabilityException[];
  const isAdmin = role === "ADMIN";
  const header = useMemo(() => ({
    activePeople: people.filter((person) => person.status === "ACTIVE").length,
    overloadedPeople: people.filter((person) => person.loadStatus === "OVERLOADED").length,
    overdueServiceOrders: people.reduce((total, person) => total + person.overdueServiceOrdersCount, 0),
    todayAppointments: people.reduce((total, person) => total + person.todayAppointmentsCount, 0),
  }), [people]);
  const refresh = () => void summaryQuery.refetch();
  const submitAvailability = () => selectedPersonId && createAvailabilityException.mutate({ personId: selectedPersonId, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), reason: reason.trim() || null });

  if (isInitializing) return <PageWrapper title="Pessoas"><AppPageLoadingState title="Carregando equipe operacional" /></PageWrapper>;
  if (!isAuthenticated) return <PageWrapper title="Pessoas"><AppPageErrorState description="Sua sessão expirou. Entre novamente para supervisionar a equipe." onAction={() => navigate("/login")} /></PageWrapper>;

  return <PageWrapper title="Pessoas" subtitle="Carga atual, capacidade planejada e indisponibilidade temporária por responsável.">
    <OperationalTopCard title="Equipe em execução" description="Compare atribuições reais com a capacidade diária e sinalize exceções temporárias, sem escala automática." primaryAction={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova pessoa</Button>} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="people-operational-header">
      <AppStatCard label="Pessoas ativas" value={`${header.activePeople}`} helper="Responsáveis cadastrados na operação." /><AppStatCard label="Sobrecarregados" value={`${header.overloadedPeople}`} helper="Carga operacional atual alta ou com atraso." /><AppStatCard label="O.S. atrasadas atribuídas" value={`${header.overdueServiceOrders}`} helper="O.S. abertas vencidas com responsável." /><AppStatCard label="Agendamentos hoje" value={`${header.todayAppointments}`} helper="Agenda ativa de hoje por responsável." />
    </div>
    {summaryQuery.isLoading ? <AppPageLoadingState title="Consolidando carga por responsável" /> : null}
    {summaryQuery.isError ? <AppPageErrorState description="Não foi possível carregar o resumo operacional da equipe." onAction={refresh} /> : null}
    {!summaryQuery.isLoading && !summaryQuery.isError ? <AppSectionBlock title="Carga por responsável" subtitle="Carga real, capacidade planejada e disponibilidade como sinais separados.">
      {people.length === 0 ? <AppPageEmptyState title="Nenhuma pessoa cadastrada" description="Cadastre responsáveis para transformar a execução em capacidade operacional visível." /> : <AppDataTable><table className="w-full min-w-[1480px] text-left text-sm" data-testid="people-workload-table"><thead className="bg-[var(--surface-elevated)] text-xs uppercase text-[var(--text-muted)]"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Função</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Disponibilidade</th><th className="px-4 py-3">O.S. abertas</th><th className="px-4 py-3">O.S. atrasadas</th><th className="px-4 py-3">Agendamentos hoje</th><th className="px-4 py-3">Próximos agendamentos</th><th className="px-4 py-3">Capacidade O.S.</th><th className="px-4 py-3">Capacidade agenda</th><th className="px-4 py-3">Carga</th><th className="px-4 py-3">Capacidade</th><th className="px-4 py-3">Ações</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{people.map((person) => <tr key={person.personId} className="text-[var(--text-secondary)]"><td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{person.name}</td><td className="px-4 py-3">{person.role}</td><td className="px-4 py-3"><AppStatusBadge label={person.status === "ACTIVE" ? "Ativo" : "Inativo"} /></td><td className="px-4 py-3"><AppStatusBadge label={availabilityLabels[person.availabilityStatus]} /></td><td className="px-4 py-3">{person.openServiceOrdersCount}</td><td className="px-4 py-3">{person.overdueServiceOrdersCount}</td><td className="px-4 py-3">{person.todayAppointmentsCount}</td><td className="px-4 py-3">{person.futureAppointmentsCount}</td><td className="px-4 py-3">{formatCapacity(person.dailyServiceOrderCapacity)}<br /><span className="text-xs text-[var(--text-muted)]">{formatUsage(person.serviceOrderCapacityUsagePct)}</span></td><td className="px-4 py-3">{formatCapacity(person.dailyAppointmentCapacity)}<br /><span className="text-xs text-[var(--text-muted)]">{formatUsage(person.appointmentCapacityUsagePct)}</span></td><td className="px-4 py-3"><AppStatusBadge label={loadLabels[person.loadStatus]} /></td><td className="px-4 py-3"><AppStatusBadge label={capacityLabels[person.capacityStatus]} /></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => setSelectedPersonId(person.personId)}>Detalhe</Button><Button size="sm" variant="ghost" onClick={() => navigate("/service-orders")}><ClipboardList className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => navigate("/appointments")}><CalendarDays className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => setEditPersonId(person.personId)}><Pencil className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table></AppDataTable>}
    </AppSectionBlock> : null}
    <AppSectionBlock title="Detalhe operacional" subtitle="Disponibilidade temporária é um sinal separado da capacidade; não é escala completa.">
      {selectedPerson ? <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border border-[var(--border-subtle)] p-4"><Users className="mb-2 h-4 w-4" /><p className="font-semibold">{selectedPerson.name}</p><p className="text-sm text-[var(--text-muted)]">{selectedPerson.role} · {selectedPerson.status === "ACTIVE" ? "Ativo" : "Inativo"}</p></div><div className="rounded-xl border border-[var(--border-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Carga atual de O.S. / capacidade</p><p className="mt-1 text-2xl font-semibold">{selectedPerson.openServiceOrdersCount} / {formatCapacity(selectedPerson.dailyServiceOrderCapacity)}</p><p className="text-xs text-[var(--text-muted)]">{formatDifference(selectedPerson.openServiceOrdersCount, selectedPerson.dailyServiceOrderCapacity)}</p></div><div className="rounded-xl border border-[var(--border-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Disponibilidade atual</p><p className="mt-1 font-semibold">{availabilityLabels[selectedPerson.availabilityStatus]}</p><p className="text-xs text-[var(--text-muted)]">Próxima indisponibilidade: {formatDateTime(selectedPerson.nextAvailabilityException?.startsAt)}</p></div><div className="rounded-xl border border-[var(--border-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Capacidade planejada</p><AppStatusBadge label={capacityLabels[selectedPerson.capacityStatus]} /><p className="mt-2 text-xs text-[var(--text-muted)]">{selectedPerson.workloadNotes || "Sem nota operacional."}</p><p className="mt-2 text-xs text-[var(--text-muted)]">Última atividade: {formatDateTime(selectedPerson.lastActivityAt)}</p></div></div>
        {isAdmin ? <div className="grid gap-2 rounded-xl border border-[var(--border-subtle)] p-4 md:grid-cols-4" data-testid="availability-exception-form"><label className="text-sm">Início<input aria-label="Início" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Fim<input aria-label="Fim" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Motivo<input aria-label="Motivo" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded border p-2" /></label><Button className="self-end" disabled={!startsAt || !endsAt || createAvailabilityException.isPending} onClick={submitAvailability}>Adicionar indisponibilidade</Button></div> : null}
        <div><p className="mb-2 text-sm font-semibold">Indisponibilidades recentes e futuras</p>{exceptionsQuery.isLoading ? <p className="text-sm text-[var(--text-muted)]">Carregando indisponibilidades...</p> : exceptions.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhuma indisponibilidade registrada.</p> : <div className="space-y-2">{exceptions.map((exception) => <div key={exception.id} className="flex items-center justify-between gap-3 rounded border border-[var(--border-subtle)] p-3 text-sm"><span>{formatDateTime(exception.startsAt)} até {formatDateTime(exception.endsAt)} · {exception.reason || "Sem motivo informado"}</span>{isAdmin ? <Button size="sm" variant="ghost" onClick={() => deleteAvailabilityException.mutate({ personId: selectedPerson.personId, exceptionId: exception.id })}><Trash2 className="h-4 w-4" /> Remover</Button> : null}</div>)}</div>}</div>
      </div> : <AppPageEmptyState title="Selecione uma pessoa" description="Abra o detalhe para comparar atribuições reais, capacidade planejada e indisponibilidades temporárias." />}
    </AppSectionBlock>
    <CreatePersonModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} /><EditPersonModal open={Boolean(editPersonId)} personId={editPersonId} onClose={() => setEditPersonId(null)} onSaved={refresh} />
  </PageWrapper>;
}
