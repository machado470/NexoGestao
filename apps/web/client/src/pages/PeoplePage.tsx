import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
  Pencil,
  Power,
} from "lucide-react";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";

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

function normalizePeoplePayload(payload: unknown): PersonItem[] {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const candidate = (item ?? {}) as Partial<PersonItem>;

    return {
      id: typeof candidate.id === "string" ? candidate.id : "",
      name: typeof candidate.name === "string" ? candidate.name : "Sem nome",
      role: typeof candidate.role === "string" ? candidate.role : null,
      email: typeof candidate.email === "string" ? candidate.email : null,
      active: candidate.active === false ? false : true,
      riskScore:
        typeof candidate.riskScore === "number" && Number.isFinite(candidate.riskScore)
          ? candidate.riskScore
          : 0,
      operationalState:
        typeof candidate.operationalState === "string"
          ? candidate.operationalState
          : null,
      userId: typeof candidate.userId === "string" ? candidate.userId : null,
    };
  });
}

function normalizeLinkedStats(payload: unknown): LinkedStatsResponse {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return { count: 0 };
  }

  const candidate = raw as Partial<LinkedStatsResponse>;

  return {
    count:
      typeof candidate.count === "number" && Number.isFinite(candidate.count)
        ? candidate.count
        : 0,
  };
}

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

function getStateBadgeClass(value?: string | null) {
  switch (value) {
    case "NORMAL":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "WARNING":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "RESTRICTED":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "SUSPENDED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export default function PeoplePage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadPeople = isAuthenticated && !isInitializing;

  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

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

  const deactivatePerson = trpc.people.deactivate.useMutation({
    onSuccess: async () => {
      toast.success("Pessoa desativada com sucesso.");
      setDeactivatingId(null);
      await Promise.all([
        utils.people.list.invalidate(),
        utils.people.statsLinked.invalidate(),
      ]);
    },
    onError: (error) => {
      setDeactivatingId(null);
      toast.error(error.message || "Erro ao desativar pessoa.");
    },
  });

  const people = useMemo(() => {
    return normalizePeoplePayload(listPeople.data);
  }, [listPeople.data]);

  const linkedStats = useMemo(() => {
    return normalizeLinkedStats(statsLinked.data);
  }, [statsLinked.data]);

  const restrictedCount = useMemo(() => {
    return people.filter((person) =>
      ["WARNING", "RESTRICTED", "SUSPENDED"].includes(
        String(person.operationalState || "")
      )
    ).length;
  }, [people]);

  const activeCount = useMemo(() => {
    return people.filter((person) => person.active !== false).length;
  }, [people]);

  const handleRefresh = async () => {
    await Promise.all([listPeople.refetch(), statsLinked.refetch()]);
  };

  const handleSaved = async () => {
    setCreateOpen(false);
    setEditingPersonId(null);
    await Promise.all([
      utils.people.list.invalidate(),
      utils.people.statsLinked.invalidate(),
    ]);
  };

  const handleDeactivate = (person: PersonItem) => {
    const confirmed = window.confirm(
      `Desativar ${person.name}? Essa ação faz soft delete e bloqueia uso operacional ativo.`
    );

    if (!confirmed) {
      return;
    }

    setDeactivatingId(person.id);
    deactivatePerson.mutate({ id: person.id });
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
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
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (listPeople.isError) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar pessoas
          </div>

          <p className="mt-2 text-sm">
            Não foi possível carregar a equipe da organização agora.
          </p>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/40"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CreatePersonModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void handleSaved()}
      />

      <EditPersonModal
        open={Boolean(editingPersonId)}
        personId={editingPersonId}
        onClose={() => setEditingPersonId(null)}
        onSaved={() => void handleSaved()}
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-semibold">Pessoas</h1>
            <p className="text-sm opacity-70">
              Gestão da equipe da organização com vínculo operacional e visão rápida de risco.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Nova pessoa
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <Users className="h-4 w-4" />
              Pessoas ativas
            </div>
            <div className="mt-2 text-2xl font-semibold">{activeCount}</div>
          </div>

          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <UserCheck className="h-4 w-4" />
              Usuários vinculados
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {statsLinked.isLoading ? "..." : linkedStats.count}
            </div>
          </div>

          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <ShieldAlert className="h-4 w-4" />
              Pessoas com atenção operacional
            </div>
            <div className="mt-2 text-2xl font-semibold">{restrictedCount}</div>
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          {people.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Users className="h-10 w-10 opacity-40" />
              <div>
                <div className="font-medium">Nenhuma pessoa cadastrada</div>
                <p className="mt-1 text-sm opacity-70">
                  Cadastre a primeira pessoa da organização para começar a gestão da equipe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
              >
                <Plus className="h-4 w-4" />
                Cadastrar primeira pessoa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {people.map((person) => (
                <div
                  key={person.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{person.name}</div>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStateBadgeClass(
                          person.operationalState
                        )}`}
                      >
                        {getStateLabel(person.operationalState)}
                      </span>

                      {person.active === false ? (
                        <span className="inline-flex rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          Inativa
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-1 text-sm opacity-80">
                      <div>Cargo: {person.role || "N/A"}</div>
                      <div>Email: {person.email || "N/A"}</div>
                      <div>Score de risco: {Number(person.riskScore ?? 0)}</div>
                      <div>
                        Vínculo com usuário: {person.userId ? "Sim" : "Não"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPersonId(person.id)}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeactivate(person)}
                      disabled={
                        person.active === false ||
                        deactivatePerson.isPending ||
                        deactivatingId === person.id
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {deactivatingId === person.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                      {person.active === false ? "Inativa" : "Desativar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
