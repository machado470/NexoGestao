import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Pencil, Plus, Users } from "lucide-react";
import { useLocation } from "wouter";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { AppStatCard } from "@/components/app-system";
import { Button } from "@/components/design-system";
import {
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";

type LoadStatus = "IDLE" | "NORMAL" | "BUSY" | "OVERLOADED";

type OperationalPerson = {
  personId: string;
  name: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  openServiceOrdersCount: number;
  overdueServiceOrdersCount: number;
  futureAppointmentsCount: number;
  todayAppointmentsCount: number;
  lastActivityAt?: string | null;
  loadStatus: LoadStatus;
};

type OperationalSummary = { people: OperationalPerson[] };

const loadLabels: Record<LoadStatus, string> = {
  IDLE: "Sem carga",
  NORMAL: "Normal",
  BUSY: "Ocupado",
  OVERLOADED: "Sobrecarregado",
};

function formatLastActivity(value?: string | null) {
  if (!value) return "Sem atividade registrada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function PeoplePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const summaryQuery = trpc.people.operationalSummary.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const summary = (summaryQuery.data ?? { people: [] }) as OperationalSummary;
  const people = summary.people ?? [];
  const selectedPerson = people.find((person) => person.personId === selectedPersonId) ?? null;
  const header = useMemo(() => ({
    activePeople: people.filter((person) => person.status === "ACTIVE").length,
    overloadedPeople: people.filter((person) => person.loadStatus === "OVERLOADED").length,
    overdueServiceOrders: people.reduce((total, person) => total + person.overdueServiceOrdersCount, 0),
    todayAppointments: people.reduce((total, person) => total + person.todayAppointmentsCount, 0),
  }), [people]);

  const refresh = () => void summaryQuery.refetch();

  if (isInitializing) {
    return <PageWrapper title="Pessoas"><AppPageLoadingState title="Carregando equipe operacional" /></PageWrapper>;
  }

  if (!isAuthenticated) {
    return <PageWrapper title="Pessoas"><AppPageErrorState description="Sua sessão expirou. Entre novamente para supervisionar a equipe." onAction={() => navigate("/login")} /></PageWrapper>;
  }

  return (
    <PageWrapper title="Pessoas" subtitle="Capacidade operacional real por responsável, sem métricas artificiais de performance.">
      <OperationalTopCard
        title="Equipe em execução"
        description="Veja quem está executando, onde existe atraso atribuído e onde a carga exige intervenção."
        primaryAction={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova pessoa</Button>}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="people-operational-header">
        <AppStatCard label="Pessoas ativas" value={`${header.activePeople}`} helper="Responsáveis disponíveis na operação." />
        <AppStatCard label="Sobrecarregados" value={`${header.overloadedPeople}`} helper="Com atraso atribuído ou carga alta." />
        <AppStatCard label="O.S. atrasadas atribuídas" value={`${header.overdueServiceOrders}`} helper="O.S. abertas vencidas com responsável." />
        <AppStatCard label="Agendamentos hoje" value={`${header.todayAppointments}`} helper="Agenda ativa de hoje por responsável." />
      </div>

      {summaryQuery.isLoading ? <AppPageLoadingState title="Consolidando carga por responsável" /> : null}
      {summaryQuery.isError ? <AppPageErrorState description="Não foi possível carregar o resumo operacional da equipe." onAction={refresh} /> : null}

      {!summaryQuery.isLoading && !summaryQuery.isError ? (
        <AppSectionBlock title="Carga por responsável" subtitle="Contagens reais de O.S. abertas e agenda futura atribuída.">
          {people.length === 0 ? (
            <AppPageEmptyState title="Nenhuma pessoa cadastrada" description="Cadastre responsáveis para transformar a execução em capacidade operacional visível." />
          ) : (
            <AppDataTable>
              <table className="w-full min-w-[1040px] text-left text-sm" data-testid="people-workload-table">
                <thead className="bg-[var(--surface-elevated)] text-xs uppercase text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Função</th><th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">O.S. abertas</th><th className="px-4 py-3">O.S. atrasadas</th>
                    <th className="px-4 py-3">Agendamentos hoje</th><th className="px-4 py-3">Próximos agendamentos</th>
                    <th className="px-4 py-3">Carga</th><th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {people.map((person) => (
                    <tr key={person.personId} className="text-[var(--text-secondary)]">
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{person.name}</td>
                      <td className="px-4 py-3">{person.role}</td>
                      <td className="px-4 py-3"><AppStatusBadge label={person.status === "ACTIVE" ? "Ativo" : "Inativo"} /></td>
                      <td className="px-4 py-3">{person.openServiceOrdersCount}</td>
                      <td className="px-4 py-3">{person.overdueServiceOrdersCount}</td>
                      <td className="px-4 py-3">{person.todayAppointmentsCount}</td>
                      <td className="px-4 py-3">{person.futureAppointmentsCount}</td>
                      <td className="px-4 py-3"><AppStatusBadge label={loadLabels[person.loadStatus]} /></td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedPersonId(person.personId)}>Detalhe</Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate("/service-orders")}><ClipboardList className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate("/appointments")}><CalendarDays className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditPersonId(person.personId)}><Pencil className="h-4 w-4" /></Button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AppDataTable>
          )}
        </AppSectionBlock>
      ) : null}

      <AppSectionBlock title="Detalhe operacional" subtitle="Leitura leve do responsável selecionado; sem score ou desempenho inventado.">
        {selectedPerson ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--border-subtle)] p-4"><Users className="mb-2 h-4 w-4" /><p className="font-semibold">{selectedPerson.name}</p><p className="text-sm text-[var(--text-muted)]">{selectedPerson.role} · {selectedPerson.status === "ACTIVE" ? "Ativo" : "Inativo"}</p></div>
            <div className="rounded-xl border border-[var(--border-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">O.S. atribuídas</p><p className="mt-1 text-2xl font-semibold">{selectedPerson.openServiceOrdersCount}</p><p className="text-xs text-[var(--text-muted)]">{selectedPerson.overdueServiceOrdersCount} atrasadas</p></div>
            <div className="rounded-xl border border-[var(--border-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Agenda atribuída</p><p className="mt-1 text-2xl font-semibold">{selectedPerson.futureAppointmentsCount}</p><p className="text-xs text-[var(--text-muted)]">{selectedPerson.todayAppointmentsCount} hoje</p></div>
            <div className="rounded-xl border border-[var(--border-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Última atividade confiável</p><p className="mt-1 text-sm font-semibold">{formatLastActivity(selectedPerson.lastActivityAt)}</p><p className="text-xs text-[var(--text-muted)]">Fonte: timeline operacional.</p></div>
          </div>
        ) : <AppPageEmptyState title="Selecione uma pessoa" description="Abra o detalhe para inspecionar atribuições reais e a última atividade disponível." />}
      </AppSectionBlock>

      <CreatePersonModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} />
      <EditPersonModal open={Boolean(editPersonId)} personId={editPersonId} onClose={() => setEditPersonId(null)} onSaved={refresh} />
    </PageWrapper>
  );
}
