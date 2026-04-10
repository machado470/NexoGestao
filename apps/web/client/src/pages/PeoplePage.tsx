import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Users, Plus } from "lucide-react";
import { Button } from "@/components/design-system";
import { SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import {
  getQueryUiState,
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { ActionBarWrapper, DataTableWrapper, PageWrapper } from "@/components/operating-system/Wrappers";
import { RowActions } from "@/components/operating-system/RowActions";

/* ================= TYPES ================= */

type PersonItem = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  active: boolean;
  riskScore?: number | null;
  operationalState?: string | null;
  userId?: string | null;
};

type LinkedStatsResponse = {
  count: number;
};

type ServiceOrder = {
  id: string;
  title?: string | null;
  status?: string | null;
  createdAt?: string | null;
  assignedToPersonId?: string | null;
};

/* ================= PAGE ================= */

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
    {
      enabled: canLoadPeople,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const people = useMemo(() => {
    return normalizeArrayPayload<PersonItem>(listPeople.data);
  }, [listPeople.data]);

  const linkedStats = useMemo(() => {
    return normalizeObjectPayload<LinkedStatsResponse>(statsLinked.data);
  }, [statsLinked.data]);

  const serviceOrders = useMemo(() => {
    return normalizeArrayPayload<ServiceOrder>(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const activePeople = people.filter((person) => person.active).length;
  const warningPeople = people.filter(
    (person) => person.operationalState === "WARNING" || person.operationalState === "RESTRICTED"
  ).length;
  const unassignedOrders = serviceOrders.filter((order) => !order.assignedToPersonId).length;
  const queue = people
    .map((person) => ({
      person,
      workload: serviceOrders.filter((order) => order.assignedToPersonId === person.id).length,
    }))
    .sort((a, b) => b.workload - a.workload)
    .slice(0, 5);

  const tableRows = useMemo(() => {
    return people.map((person) => {
      const workload = serviceOrders.filter((order) => order.assignedToPersonId === person.id).length;
      const severity = person.operationalState === "RESTRICTED" || person.operationalState === "SUSPENDED"
        ? "critical"
        : person.operationalState === "WARNING"
          ? "overdue"
          : workload === 0
            ? "pending"
            : "normal";
      return { ...person, workload, severity };
    });
  }, [people, serviceOrders]);

  const columns = useMemo(() => [
    { key: "name", label: "Pessoa", sortable: true },
    { key: "role", label: "Papel", render: (value: string | null) => value || "—" },
    {
      key: "severity",
      label: "Estado operacional",
      render: (value: string) => {
        const map = {
          critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
          overdue: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
          pending: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
          normal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        } as const;
        const labels = { critical: "Crítico", overdue: "Atrasado", pending: "Pendente", normal: "Em dia" } as const;
        return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${map[value as keyof typeof map]}`}>{labels[value as keyof typeof labels]}</span>;
      },
    },
    {
      key: "workload",
      label: "Carga",
      sortable: true,
      render: (value: number) => `${value} O.S.`,
    },
  ] as const, []);


  const smartPriorities = useMemo(() => [
    {
      id: "people-unassigned",
      type: "stalled_service_orders" as const,
      title: "O.S. sem responsável",
      count: unassignedOrders,
      impactCents: unassignedOrders * 32000,
      ctaLabel: "Distribuir equipe",
      ctaPath: "/people",
      helperText: "Sem responsável, a operação para e o faturamento atrasa.",
    },
    {
      id: "people-warning",
      type: "operational_risk" as const,
      title: "Equipe em estado de atenção",
      count: warningPeople,
      impactCents: warningPeople * 15000,
      ctaLabel: "Rebalancear carga",
      ctaPath: "/people",
      helperText: "Sinais de risco operacional aumentam chance de gargalo.",
    },
    {
      id: "people-capacity",
      type: "idle_cash" as const,
      title: "Capacidade ativa da equipe",
      count: activePeople,
      impactCents: activePeople * 9000,
      ctaLabel: "Acelerar execução",
      ctaPath: "/service-orders",
      helperText: "Pessoas ativas sem direcionamento viram capacidade ociosa.",
    },
  ], [activePeople, unassignedOrders, warningPeople]);

  const hasRenderableData =
    listPeople.data !== undefined ||
    statsLinked.data !== undefined ||
    serviceOrdersQuery.data !== undefined;

  const hasError =
    listPeople.isError || statsLinked.isError || serviceOrdersQuery.isError;

  const errorMessage =
    listPeople.error?.message ||
    statsLinked.error?.message ||
    serviceOrdersQuery.error?.message ||
    "Erro ao carregar pessoas";

  const queryState = getQueryUiState(
    [listPeople, statsLinked, serviceOrdersQuery],
    hasRenderableData
  );

  if (isInitializing) {
    return (
      <PageWrapper title="Pessoas" subtitle="Carregando sessão...">
        <SurfaceSection className="flex min-h-[180px] items-center justify-center">
          <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando sessão...
          </div>
        </SurfaceSection>
      </PageWrapper>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Pessoas" subtitle="Sua sessão não está ativa.">
        <SurfaceSection className="text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">Faça login para acessar pessoas.</SurfaceSection>
      </PageWrapper>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageWrapper title="Pessoas" subtitle="Carregando base de pessoas...">
        <SurfaceSection className="flex min-h-[220px] items-center justify-center">
          <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando base de pessoas...
          </div>
        </SurfaceSection>
      </PageWrapper>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageWrapper title="Pessoas" subtitle="Não foi possível carregar os dados de pessoas.">
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">{errorMessage}</SurfaceSection>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Pessoas"
      subtitle="Base de pessoas conectada à operação, com a mesma leitura visual do dashboard executivo."
    >
      <ActionBarWrapper
        secondaryActions={(
          <>
            <Button type="button" variant="outline" onClick={() => navigate("/service-orders")}>Ir para O.S.</Button>
            <Button type="button" variant="outline" onClick={() => navigate("/finances")}>Ir para cobrança</Button>
          </>
        )}
        primaryAction={(
          <Button type="button" className="min-h-12 gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova pessoa
          </Button>
        )}
      />


      <SurfaceSection className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Direção da equipe
            </p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">
              {unassignedOrders > 0 ? "Ordens sem responsável" : "Monitorar equipe em atenção"}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {unassignedOrders} O.S. podem travar por falta de responsável.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              if (unassignedOrders > 0) {
                navigate("/service-orders");
                return;
              }
              setIsCreateOpen(true);
            }}
          >
            {unassignedOrders > 0 ? "Distribuir ordens" : "Nova pessoa"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {smartPriorities.slice(0, 3).map(priority => (
            <span key={priority.id} className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)]">
              {priority.title}: {priority.count}
            </span>
          ))}
        </div>
      </SurfaceSection>

      {queryState.hasBackgroundUpdate ? (
        <SurfaceSection className="border-blue-500/30 bg-blue-500/10 text-sm text-blue-200">
          Atualizando pessoas em segundo plano...
        </SurfaceSection>
      ) : null}

      {hasError && !queryState.shouldBlockForError ? (
        <SurfaceSection className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
          {errorMessage}
        </SurfaceSection>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">Pessoas vinculadas</p><p className="text-2xl font-bold">{linkedStats?.count ?? 0}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">Ativas</p><p className="text-2xl font-bold">{activePeople}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">Com atenção</p><p className="text-2xl font-bold">{warningPeople}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">O.S. sem responsável</p><p className="text-2xl font-bold">{unassignedOrders}</p></div>
      </div>

      <SurfaceSection>
        <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
          Bloco analítico: distribua carga da equipe para evitar gargalos de execução e reduzir riscos operacionais.
        </p>
      </SurfaceSection>

      <SurfaceSection className="space-y-2">
        <h2 className="font-semibold">Fila operacional da equipe</h2>
        {queue.length > 0 ? queue.map((item) => (
          <div key={item.person.id} className="nexo-subtle-surface flex items-center justify-between p-3">
            <span>{item.person.name}</span>
            <span className="text-sm text-[var(--text-muted)]">{item.workload} O.S.</span>
          </div>
        )) : <p className="text-sm text-[var(--text-muted)]">Sem carga operacional registrada.</p>}
      </SurfaceSection>

      {people.length === 0 ? (
        <SurfaceSection>
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="Nenhuma pessoa cadastrada ainda"
            description="Cadastre membros da equipe para distribuir ordens de serviço, acompanhar estado operacional e dar contexto às execuções."
            action={{
              label: "Atualizar lista",
              onClick: () => void listPeople.refetch(),
            }}
          />
        </SurfaceSection>
      ) : (
        <DataTableWrapper
          columns={columns as any}
          data={tableRows}
          searchFields={["name", "role", "operationalState"]}
          rowActions={(row) => (
            <RowActions
              onEdit={() => setEditingPersonId(row.id)}
              onView={() => navigate(`/service-orders?personId=${row.id}`)}
            />
          )}
        />
      )}

      <CreatePersonModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => {
          void listPeople.refetch();
          void statsLinked.refetch();
          void serviceOrdersQuery.refetch();
        }}
      />

      <EditPersonModal
        open={Boolean(editingPersonId)}
        personId={editingPersonId ?? undefined}
        onClose={() => setEditingPersonId(null)}
        onSaved={() => {
          void listPeople.refetch();
          void statsLinked.refetch();
          void serviceOrdersQuery.refetch();
        }}
      />
    </PageWrapper>
  );
}
