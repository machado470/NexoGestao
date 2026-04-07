import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";

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

  const hasData =
    listPeople.isSuccess || statsLinked.isSuccess || serviceOrdersQuery.isSuccess;

  const hasError =
    listPeople.isError || statsLinked.isError || serviceOrdersQuery.isError;

  const errorMessage =
    listPeople.error?.message ||
    statsLinked.error?.message ||
    serviceOrdersQuery.error?.message ||
    "Erro ao carregar pessoas";

  const hasAnyActiveLoading =
    listPeople.isLoading || statsLinked.isLoading || serviceOrdersQuery.isLoading;

  const isInitialLoading = hasAnyActiveLoading && !hasData;

  const shouldBlockForError = hasError && !hasData;

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

  if (isInitialLoading) {
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

  if (shouldBlockForError) {
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

      {hasError && !shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" className="gap-2">
          <Plus className="h-4 w-4" />
          Nova pessoa
        </Button>
      </div>

      <SurfaceSection className="text-sm opacity-80">
        Pessoas vinculadas: {linkedStats?.count ?? 0}
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
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-500">
                {getStateLabel(p.operationalState)}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
