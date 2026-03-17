import React, { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

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

export default function PeoplePage() {
  const { isAuthenticated, isInitializing } = useAuth();

  const canLoadPeople = isAuthenticated && !isInitializing;

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

  const people = useMemo(() => {
    const payload = (listPeople.data as any)?.data ?? listPeople.data ?? [];
    return Array.isArray(payload) ? payload : [];
  }, [listPeople.data]);

  const linkedCount = useMemo(() => {
    const payload = (statsLinked.data as any)?.data ?? statsLinked.data ?? null;
    return typeof payload?.count === "number" ? payload.count : 0;
  }, [statsLinked.data]);

  if (isInitializing) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border p-4 text-sm text-zinc-500 dark:border-zinc-800">
          Faça login para visualizar pessoas.
        </div>
      </div>
    );
  }

  if (listPeople.isLoading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          Carregando pessoas...
        </div>
      </div>
    );
  }

  if (listPeople.isError) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 p-4 text-red-600 dark:border-red-900">
          Erro ao carregar pessoas.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Pessoas</h1>
        <p className="text-sm opacity-70">
          Colaboradores ativos da organização e visão rápida de vínculo institucional.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Pessoas ativas</div>
          <div className="mt-2 text-2xl font-semibold">{people.length}</div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Usuários vinculados</div>
          <div className="mt-2 text-2xl font-semibold">
            {statsLinked.isLoading ? "..." : linkedCount}
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Estados operacionais visíveis</div>
          <div className="mt-2 text-sm opacity-80">
            NORMAL, WARNING, RESTRICTED, SUSPENDED
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        {people.length === 0 ? (
          <div>Nenhuma pessoa.</div>
        ) : (
          <div className="space-y-3">
            {people.map((p: any) => (
              <div
                key={p.id ?? p.name}
                className="flex flex-col gap-3 rounded-xl border p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="font-medium">{p.name ?? "Sem nome"}</div>
                  <div className="text-sm opacity-70">
                    Cargo: {p.role ?? "N/A"}
                  </div>
                  <div className="text-sm opacity-70">
                    Email: {p.email ?? "N/A"}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm md:min-w-[260px]">
                  <div className="rounded border p-2 dark:border-zinc-800">
                    Estado operacional: {getStateLabel(p.operationalState)}
                  </div>
                  <div className="rounded border p-2 dark:border-zinc-800">
                    Ativo: {p.active === false ? "Não" : "Sim"}
                  </div>
                  <div className="rounded border p-2 dark:border-zinc-800">
                    Score de risco: {Number(p.riskScore ?? 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
