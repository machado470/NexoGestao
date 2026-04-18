import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/design-system";
import { EmptyState } from "@/components/EmptyState";
import {
  getQueryUiState,
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppDataTable,
  AppKpiRow,
  AppListBlock,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

type PersonItem = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  active: boolean;
  operationalState?: string | null;
};

type LinkedStatsResponse = {
  count: number;
};

type ServiceOrder = {
  id: string;
  assignedToPersonId?: string | null;
};

function getPersonStatusLabel(person: PersonItem, workload: number) {
  if (person.operationalState === "SUSPENDED" || person.operationalState === "RESTRICTED") return "Restrito";
  if (person.operationalState === "WARNING") return "Atenção";
  if (!person.active) return "Inativo";
  if (workload === 0) return "Sem atribuição";
  return "Ativo";
}

export default function PeoplePage() {
  const [, navigate] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadPeople = isAuthenticated;

  const listPeople = trpc.people.list.useQuery(undefined, {
    enabled: canLoadPeople,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const statsLinked = trpc.people.statsLinked.useQuery(undefined, {
    enabled: canLoadPeople,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: canLoadPeople, retry: false, refetchOnWindowFocus: false }
  );

  const people = useMemo(() => normalizeArrayPayload<PersonItem>(listPeople.data), [listPeople.data]);
  const linkedStats = useMemo(
    () => normalizeObjectPayload<LinkedStatsResponse>(statsLinked.data),
    [statsLinked.data]
  );
  const serviceOrders = useMemo(
    () => normalizeArrayPayload<ServiceOrder>(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );

  const tableRows = useMemo(() => {
    return people.map((person) => {
      const workload = serviceOrders.filter((order) => order.assignedToPersonId === person.id).length;
      return { ...person, workload, statusLabel: getPersonStatusLabel(person, workload) };
    });
  }, [people, serviceOrders]);

  const activePeople = tableRows.filter((person) => person.statusLabel === "Ativo").length;
  const assignedPeople = tableRows.filter((person) => person.workload > 0).length;
  const avgWorkload = tableRows.length > 0
    ? (tableRows.reduce((acc, item) => acc + item.workload, 0) / tableRows.length).toFixed(1)
    : "0";
  const unassignedOrders = serviceOrders.filter((order) => !order.assignedToPersonId).length;
  const overloadedPeople = tableRows.filter((person) => person.workload >= 5).length;

  const queue = tableRows
    .sort((a, b) => b.workload - a.workload)
    .slice(0, 5)
    .map((person) => ({
      title: person.name,
      subtitle: `${person.role ?? "Função não informada"} · ${person.workload} O.S. atribuídas`,
      right: <AppStatusBadge label={person.statusLabel} />,
      action: (
        <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/service-orders?personId=${person.id}`)}>
          Ver O.S.
        </Button>
      ),
    }));

  const hasRenderableData =
    listPeople.data !== undefined ||
    statsLinked.data !== undefined ||
    serviceOrdersQuery.data !== undefined;
  const queryState = getQueryUiState([listPeople, statsLinked, serviceOrdersQuery], hasRenderableData);
  const errorMessage =
    listPeople.error?.message ||
    statsLinked.error?.message ||
    serviceOrdersQuery.error?.message ||
    "Erro ao carregar pessoas";

  if (isInitializing) {
    return (
      <PageWrapper title="Pessoas" subtitle="Carregando sessão...">
        <AppSectionBlock title="Sessão" subtitle="Validação de acesso" compact>
          <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando sessão...
          </div>
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Pessoas" subtitle="Sua sessão não está ativa.">
        <AppSectionBlock title="Acesso" subtitle="Sessão necessária" compact>
          <p className="text-sm text-[var(--text-muted)]">Faça login para acessar pessoas.</p>
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageWrapper title="Pessoas" subtitle="Carregando base de pessoas...">
        <AppSectionBlock title="Pessoas" subtitle="Sincronizando time" compact>
          <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando base de pessoas...
          </div>
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageWrapper title="Pessoas" subtitle="Não foi possível carregar os dados de pessoas.">
        <AppSectionBlock title="Falha" subtitle="Tente novamente" compact>
          <p className="text-sm text-rose-400">{errorMessage}</p>
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Pessoas"
      subtitle="Gestão operacional da equipe com carga, status e ações conectadas à execução."
    >
      <OperationalTopCard
        contextLabel="Direção da equipe"
        title={unassignedOrders > 0 ? "Distribuir ordens sem responsável" : "Equipe operacional estável"}
        description={`${unassignedOrders} O.S. sem responsável e ${overloadedPeople} pessoas com possível sobrecarga.`}
        chips={
          <>
            <AppStatusBadge label={`${linkedStats?.count ?? 0} pessoas vinculadas`} />
            <AppStatusBadge label={`${assignedPeople} com O.S. atribuídas`} />
          </>
        }
        primaryAction={
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            Nova pessoa
          </Button>
        }
        secondaryActions={
          <Button type="button" variant="outline" onClick={() => navigate("/service-orders")}>
            Abrir O.S.
          </Button>
        }
      />

      <AppKpiRow
        items={[
          { title: "Total de pessoas", value: String(linkedStats?.count ?? 0), hint: "vínculo organizacional" },
          { title: "Pessoas ativas", value: String(activePeople), hint: "em execução" },
          { title: "Com O.S. atribuídas", value: String(assignedPeople), hint: "ocupação operacional" },
          { title: "Carga média", value: `${avgWorkload} O.S.`, hint: "por pessoa" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <AppSectionBlock title="Equipe e carga" subtitle="Leitura principal da operação" className="xl:col-span-2">
          {tableRows.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="Nenhuma pessoa cadastrada"
              description="Cadastre membros para distribuir ordens e equilibrar execução."
              action={{ label: "Atualizar lista", onClick: () => void listPeople.refetch() }}
            />
          ) : (
            <AppDataTable>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Papel</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Carga atual</th>
                    <th className="px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border-subtle)]/60">
                      <td className="px-3 py-2 text-[var(--text-primary)]">{row.name}</td>
                      <td className="px-3 py-2">{row.role ?? "—"}</td>
                      <td className="px-3 py-2"><AppStatusBadge label={row.statusLabel} /></td>
                      <td className="px-3 py-2">{row.workload} O.S.</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/appointments?personId=${row.id}`)}>
                            Agenda
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/service-orders?personId=${row.id}`)}>
                            O.S.
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingPersonId(row.id)}>
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AppDataTable>
          )}
        </AppSectionBlock>

        <AppSectionBlock title="Contexto operacional" subtitle="Pontos de atenção da equipe" compact>
          <AppListBlock
            compact
            items={queue.length > 0 ? queue : [{ title: "Sem carga operacional", subtitle: "Ainda não há ordens atribuídas.", action: <Button size="sm" variant="outline" onClick={() => navigate("/service-orders")}>Abrir O.S.</Button> }]}
          />
        </AppSectionBlock>
      </div>

      <CreatePersonModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => {
          setIsCreateOpen(false);
          void Promise.all([listPeople.refetch(), statsLinked.refetch(), serviceOrdersQuery.refetch()]);
        }}
      />

      <EditPersonModal
        open={Boolean(editingPersonId)}
        personId={editingPersonId}
        onClose={() => setEditingPersonId(null)}
        onSaved={() => {
          setEditingPersonId(null);
          void Promise.all([listPeople.refetch(), statsLinked.refetch(), serviceOrdersQuery.refetch()]);
        }}
      />
    </PageWrapper>
  );
}
