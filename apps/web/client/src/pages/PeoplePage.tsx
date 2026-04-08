import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Users, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell, SmartPage, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import {
  getQueryUiState,
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";

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

/* ================= HELPERS ================= */

function getStateLabel(value?: string | null) {
  switch (value) {
    case "NORMAL":
      return "Normal";
    case "WARNING":
      return "Atenção";
    case "RESTRICTED":
      return "Restrito";
    case "SUSPENDED":
      return "Suspenso";
    default:
      return value || "N/A";
  }
}

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
      <PageShell>
        <PageHero eyebrow="Pessoas" title="Pessoas" description="Carregando sessão..." />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center">
          <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando sessão...
          </div>
        </SurfaceSection>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <PageHero eyebrow="Pessoas" title="Pessoas" description="Sua sessão não está ativa." />
      </PageShell>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageShell>
        <PageHero eyebrow="Pessoas" title="Pessoas" description="Carregando base de pessoas..." />
        <SurfaceSection className="flex min-h-[220px] items-center justify-center">
          <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando base de pessoas...
          </div>
        </SurfaceSection>
      </PageShell>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageShell>
        <PageHero eyebrow="Pessoas" title="Pessoas" description="Não foi possível carregar os dados de pessoas." />
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">{errorMessage}</SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Pessoas"
        title="Pessoas"
        description="Base de pessoas conectada à operação, com a mesma leitura visual do dashboard executivo."
      />


      <SmartPage
        pageContext="people"
        headline="Equipe orientada por gargalo"
        dominantProblem={unassignedOrders > 0 ? "Ordens sem responsável" : "Monitorar equipe em atenção"}
        dominantImpact={`${unassignedOrders} O.S. podem travar por falta de dono`}
        dominantCta={{
          label: unassignedOrders > 0 ? "Distribuir ordens agora" : "Nova pessoa",
          onClick: () => {
            if (unassignedOrders > 0) {
              navigate("/service-orders");
              return;
            }
            setIsCreateOpen(true);
          },
          path: "/people",
        }}
        priorities={smartPriorities}
      />

      {queryState.hasBackgroundUpdate ? (
        <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
          Atualizando pessoas em segundo plano...
        </div>
      ) : null}

      {hasError && !queryState.shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" className="min-h-12 gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova pessoa
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="nexo-kpi-card p-4"><p className="text-xs text-zinc-500">Pessoas vinculadas</p><p className="text-2xl font-bold">{linkedStats?.count ?? 0}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-zinc-500">Ativas</p><p className="text-2xl font-bold">{activePeople}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-zinc-500">Com atenção</p><p className="text-2xl font-bold">{warningPeople}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-zinc-500">O.S. sem responsável</p><p className="text-2xl font-bold">{unassignedOrders}</p></div>
      </div>

      <SurfaceSection>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Bloco analítico: distribua carga da equipe para evitar gargalos de execução e reduzir riscos operacionais.
        </p>
      </SurfaceSection>

      <SurfaceSection className="space-y-2">
        <h2 className="font-semibold">Fila operacional da equipe</h2>
        {queue.length > 0 ? queue.map((item) => (
          <div key={item.person.id} className="nexo-subtle-surface flex items-center justify-between p-3">
            <span>{item.person.name}</span>
            <span className="text-sm text-zinc-500">{item.workload} O.S.</span>
          </div>
        )) : <p className="text-sm text-zinc-500">Sem carga operacional registrada.</p>}
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
        <div className="space-y-2">
          {people.map((p) => (
            <div key={p.id} className="nexo-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-gray-500">
                    {getStateLabel(p.operationalState)}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setEditingPersonId(p.id)}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              </div>
            </div>
          ))}
        </div>
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
    </PageShell>
  );
}
