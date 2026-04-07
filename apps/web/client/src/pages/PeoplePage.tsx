import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
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

  const hasNormalizedPeople = listPeople.data !== undefined;
  const hasNormalizedStats = statsLinked.data !== undefined;
  const hasNormalizedOrders = serviceOrdersQuery.data !== undefined;
  const hasAnyData =
    hasNormalizedPeople || hasNormalizedStats || hasNormalizedOrders;

  const hasError =
    listPeople.isError || statsLinked.isError || serviceOrdersQuery.isError;

  const errorMessage =
    listPeople.error?.message ||
    statsLinked.error?.message ||
    serviceOrdersQuery.error?.message ||
    "Erro ao carregar pessoas";

  const hasAnyActiveLoading =
    listPeople.isLoading || statsLinked.isLoading || serviceOrdersQuery.isLoading;

  const isInitialLoading = hasAnyActiveLoading && !hasAnyData;

  const shouldBlockForError = hasError && !hasAnyData;

  if (isInitializing) {
    return <div className="p-6">Carregando sessão...</div>;
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
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
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

      <Button type="button">Nova pessoa</Button>

      <SurfaceSection className="text-sm opacity-80">
        Pessoas vinculadas: {linkedStats?.count ?? 0}
      </SurfaceSection>

      {people.length === 0 ? (
        <SurfaceSection>Nenhuma pessoa</SurfaceSection>
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
