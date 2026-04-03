import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
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
  Sparkles,
  ArrowRight,
  Briefcase,
  ShieldCheck,
  Lock,
  PauseCircle,
  Mail,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { buildServiceOrdersDeepLink } from "@/lib/operations/operations.utils";

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
  assignedPersonId?: string | null;
  assignedTo?: {
    id?: string | null;
    name?: string | null;
  } | null;
  assignedPerson?: {
    id?: string | null;
    name?: string | null;
  } | null;
  customer?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

function normalizePeoplePayload(payload: unknown): PersonItem[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
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
    })
    .filter((person) => person.id);
}

function normalizeLinkedStats(payload: unknown): LinkedStatsResponse {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return { count: 0 };
  }

  return {
    count:
      typeof (raw as any).count === "number" && Number.isFinite((raw as any).count)
        ? (raw as any).count
        : 0,
  };
}

function normalizeServiceOrders(payload: unknown): ServiceOrder[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw as ServiceOrder[];
  }

  if (Array.isArray((raw as any)?.items)) {
    return (raw as any).items as ServiceOrder[];
  }

  if (Array.isArray((payload as any)?.items)) {
    return (payload as any).items as ServiceOrder[];
  }

  return [];
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

function getStatePanelTone(value?: string | null) {
  switch (value) {
    case "NORMAL":
      return {
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
        icon: ShieldCheck,
      };
    case "WARNING":
      return {
        className:
          "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
        icon: AlertTriangle,
      };
    case "RESTRICTED":
      return {
        className:
          "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
        icon: Lock,
      };
    case "SUSPENDED":
      return {
        className:
          "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
        icon: PauseCircle,
      };
    default:
      return {
        className:
          "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300",
        icon: ShieldAlert,
      };
  }
}

function getRiskBand(score?: number | null) {
  const value = Number(score ?? 0);

  if (value >= 80) {
    return {
      label: "Crítico",
      className:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };
  }

  if (value >= 60) {
    return {
      label: "Alto",
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    };
  }

  if (value >= 40) {
    return {
      label: "Moderado",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    };
  }

  if (value > 0) {
    return {
      label: "Baixo",
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    };
  }

  return {
    label: "Sem score",
    className:
      "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  };
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm opacity-70">
        <Icon className="h-4 w-4 text-orange-500" />
        {title}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${valueClassName ?? ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs opacity-70">{subtitle}</div>
    </div>
  );
}

export default function PeoplePage() {
  const [, navigate] = useLocation();
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

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    {
      enabled: canLoadPeople,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const deactivatePerson = trpc.people.deactivate.useMutation({
    onSuccess: async () => {
      toast.success("Pessoa desativada com sucesso.");
      setDeactivatingId(null);
      await Promise.all([
        utils.people.list.invalidate(),
        utils.people.statsLinked.invalidate(),
        utils.nexo.serviceOrders.list.invalidate(),
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

  const serviceOrders = useMemo(() => {
    return normalizeServiceOrders(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const peopleWithOperationalData = useMemo(() => {
    return people.map((person) => {
      const linkedOrders = serviceOrders.filter((order) => {
        const assignedId =
          order.assignedToPersonId ??
          order.assignedPersonId ??
          order.assignedTo?.id ??
          order.assignedPerson?.id ??
          null;

        return String(assignedId ?? "") === person.id;
      });

      const openOrders = linkedOrders.filter((order) => {
        const status = String(order.status ?? "").toUpperCase();
        return ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status);
      });

      const doneOrders = linkedOrders.filter((order) => {
        const status = String(order.status ?? "").toUpperCase();
        return status === "DONE";
      });

      const recentOrder =
        [...linkedOrders].sort((a, b) => {
          const dateA = new Date(a.createdAt ?? 0).getTime();
          const dateB = new Date(b.createdAt ?? 0).getTime();
          return dateB - dateA;
        })[0] ?? null;

      return {
        ...person,
        linkedOrders,
        openOrders,
        doneOrders,
        recentOrder,
      };
    });
  }, [people, serviceOrders]);

  const restrictedCount = useMemo(() => {
    return peopleWithOperationalData.filter((person) =>
      ["WARNING", "RESTRICTED", "SUSPENDED"].includes(
        String(person.operationalState || "")
      )
    ).length;
  }, [peopleWithOperationalData]);

  const activeCount = useMemo(() => {
    return peopleWithOperationalData.filter((person) => person.active !== false)
      .length;
  }, [peopleWithOperationalData]);

  const peopleWithAssignmentsCount = useMemo(() => {
    return peopleWithOperationalData.filter((person) => person.linkedOrders.length > 0)
      .length;
  }, [peopleWithOperationalData]);

  const openAssignmentsCount = useMemo(() => {
    return peopleWithOperationalData.reduce(
      (acc, person) => acc + person.openOrders.length,
      0
    );
  }, [peopleWithOperationalData]);

  const isLoading =
    listPeople.isLoading || statsLinked.isLoading || serviceOrdersQuery.isLoading;

  const hasError =
    listPeople.isError || statsLinked.isError || serviceOrdersQuery.isError;

  const errorMessage =
    listPeople.error?.message ||
    statsLinked.error?.message ||
    serviceOrdersQuery.error?.message ||
    "Não foi possível carregar a equipe da organização agora.";

  const handleRefresh = async () => {
    await Promise.all([
      listPeople.refetch(),
      statsLinked.refetch(),
      serviceOrdersQuery.refetch(),
    ]);
  };

  const handleSaved = async () => {
    setCreateOpen(false);
    setEditingPersonId(null);
    await Promise.all([
      utils.people.list.invalidate(),
      utils.people.statsLinked.invalidate(),
      utils.nexo.serviceOrders.list.invalidate(),
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

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar pessoas
          </div>

          <p className="mt-2 text-sm">{errorMessage}</p>

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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              Equipe com contexto operacional
            </div>

            <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6 text-orange-500" />
              Pessoas
            </h1>

            <p className="mt-2 text-sm opacity-70">
              Aqui a equipe deixa de ser cadastro morto e vira leitura operacional:
              quem está vinculado à execução, quem concentra risco e quem precisa de atenção.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRefresh()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>

            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="gap-2 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Nova pessoa
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Pessoas ativas"
            value={activeCount}
            subtitle="Equipe utilizável no fluxo"
            icon={Users}
          />
          <SummaryCard
            title="Usuários vinculados"
            value={linkedStats.count}
            subtitle="Acesso conectado à conta"
            icon={UserCheck}
          />
          <SummaryCard
            title="Com atenção operacional"
            value={restrictedCount}
            subtitle="WARNING, RESTRICTED ou SUSPENDED"
            icon={ShieldAlert}
            valueClassName="text-orange-600 dark:text-orange-400"
          />
          <SummaryCard
            title="Com ordens atribuídas"
            value={peopleWithAssignmentsCount}
            subtitle="Participação real na operação"
            icon={Briefcase}
          />
          <SummaryCard
            title="Ordens em aberto"
            value={openAssignmentsCount}
            subtitle="Carga operacional atual"
            icon={ArrowRight}
            valueClassName="text-blue-600 dark:text-blue-400"
          />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {peopleWithOperationalData.length === 0 ? (
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
            <div className="space-y-4">
              {peopleWithOperationalData.map((person) => {
                const stateTone = getStatePanelTone(person.operationalState);
                const StateIcon = stateTone.icon;
                const riskBand = getRiskBand(person.riskScore);

                const nextAction =
                  person.active === false
                    ? {
                        title: "Pessoa inativa",
                        description:
                          "Registro mantido para histórico, mas fora da operação ativa.",
                        className:
                          "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300",
                      }
                    : person.openOrders.length > 0
                      ? {
                          title: "Acompanhar execução",
                          description: `${person.openOrders.length} ordem(ns) aberta(s) atribuída(s).`,
                          className:
                            "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
                        }
                      : ["WARNING", "RESTRICTED", "SUSPENDED"].includes(
                            String(person.operationalState ?? "")
                          )
                        ? {
                            title: "Revisar risco da pessoa",
                            description:
                              "A pessoa entrou no radar operacional e precisa de leitura mais próxima.",
                            className:
                              "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
                          }
                        : {
                            title: "Sem pressão imediata",
                            description:
                              "Sem carga operacional aberta relevante no momento.",
                            className:
                              "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
                          };

                return (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-zinc-950 dark:text-white">
                              {person.name}
                            </div>

                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStateBadgeClass(
                                person.operationalState
                              )}`}
                            >
                              {getStateLabel(person.operationalState)}
                            </span>

                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${riskBand.className}`}
                            >
                              Risco {riskBand.label}
                            </span>

                            {person.active === false ? (
                              <span className="inline-flex rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                Inativa
                              </span>
                            ) : null}

                            {person.userId ? (
                              <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                Usuário vinculado
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
                                <UserRound className="h-3.5 w-3.5" />
                                Cargo
                              </div>
                              <div className="mt-2 text-sm font-medium text-zinc-950 dark:text-white">
                                {person.role || "N/A"}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
                                <Mail className="h-3.5 w-3.5" />
                                Email
                              </div>
                              <div className="mt-2 break-all text-sm font-medium text-zinc-950 dark:text-white">
                                {person.email || "N/A"}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Score de risco
                              </div>
                              <div className="mt-2 text-sm font-medium text-zinc-950 dark:text-white">
                                {Number(person.riskScore ?? 0)}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
                                <Briefcase className="h-3.5 w-3.5" />
                                Ordens vinculadas
                              </div>
                              <div className="mt-2 text-sm font-medium text-zinc-950 dark:text-white">
                                {person.linkedOrders.length}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditingPersonId(person.id)}
                            className="gap-2"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (person.recentOrder?.id) {
                                navigate(buildServiceOrdersDeepLink(person.recentOrder.id));
                                return;
                              }

                              navigate("/service-orders");
                            }}
                            className="gap-2"
                          >
                            <Briefcase className="h-4 w-4" />
                            {person.recentOrder?.id ? "Abrir O.S." : "Ver ordens"}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDeactivate(person)}
                            disabled={
                              person.active === false ||
                              deactivatePerson.isPending ||
                              deactivatingId === person.id
                            }
                            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            {deactivatingId === person.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            {person.active === false ? "Inativa" : "Desativar"}
                          </Button>
                        </div>
                      </div>

                      <div className={`rounded-xl border p-4 ${stateTone.className}`}>
                        <div className="flex items-start gap-2">
                          <StateIcon className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold">
                              Estado operacional da pessoa
                            </p>
                            <p className="mt-1 text-sm">
                              {getStateLabel(person.operationalState)}
                            </p>
                            <p className="mt-1 text-xs opacity-90">
                              Essa leitura ajuda a separar equipe saudável de equipe
                              que já está acumulando atrito, risco ou limitação.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`rounded-xl border p-4 ${nextAction.className}`}>
                        <div className="flex items-start gap-2">
                          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold">
                              Próxima ação recomendada
                            </p>
                            <p className="mt-1 text-sm">{nextAction.title}</p>
                            <p className="mt-1 text-xs opacity-90">
                              {nextAction.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-3">
                        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="mb-3 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-orange-500" />
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                              Carga operacional
                            </h3>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-70">Ordens em aberto</span>
                              <span className="font-medium text-zinc-950 dark:text-white">
                                {person.openOrders.length}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-70">Ordens concluídas</span>
                              <span className="font-medium text-zinc-950 dark:text-white">
                                {person.doneOrders.length}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-70">Total atribuído</span>
                              <span className="font-medium text-zinc-950 dark:text-white">
                                {person.linkedOrders.length}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="mb-3 flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-orange-500" />
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                              Leitura de risco
                            </h3>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-70">Banda</span>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${riskBand.className}`}
                              >
                                {riskBand.label}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-70">Score</span>
                              <span className="font-medium text-zinc-950 dark:text-white">
                                {Number(person.riskScore ?? 0)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-70">Estado</span>
                              <span className="font-medium text-zinc-950 dark:text-white">
                                {getStateLabel(person.operationalState)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="mb-3 flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-orange-500" />
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                              Última referência operacional
                            </h3>
                          </div>

                          {person.recentOrder ? (
                            <div className="space-y-2 text-sm">
                              <div className="font-medium text-zinc-950 dark:text-white">
                                {person.recentOrder.title || "Ordem de serviço"}
                              </div>

                              <div className="opacity-70">
                                Status: {person.recentOrder.status || "N/A"}
                              </div>

                              <div className="opacity-70">
                                Cliente: {person.recentOrder.customer?.name || "Sem cliente"}
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(buildServiceOrdersDeepLink(person.recentOrder!.id))
                                }
                                className="mt-2 gap-2"
                              >
                                <Briefcase className="h-4 w-4" />
                                Abrir ordem
                              </Button>
                            </div>
                          ) : (
                            <div className="text-sm opacity-70">
                              Nenhuma ordem atribuída visível no payload atual.
                            </div>
                          )}
                        </div>
                      </div>

                      {person.openOrders.length > 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                          <div className="mb-3 flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-orange-500" />
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                              Ordens abertas atribuídas
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {person.openOrders.slice(0, 3).map((order) => (
                              <div
                                key={order.id}
                                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                              >
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="font-medium text-zinc-950 dark:text-white">
                                      {order.title || "Ordem de serviço"}
                                    </div>
                                    <div className="mt-1 text-sm opacity-70">
                                      {order.customer?.name || "Sem cliente"} · Status{" "}
                                      {order.status || "N/A"}
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(buildServiceOrdersDeepLink(order.id))}
                                    className="gap-2"
                                  >
                                    <Briefcase className="h-4 w-4" />
                                    Abrir
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
