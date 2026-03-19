import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  ClipboardList,
  User,
  Calendar,
  AlertCircle,
  Wallet,
  Clock3,
  Receipt,
  CheckCircle2,
  CircleDashed,
  CircleOff,
  BadgeDollarSign,
  ArrowRightLeft,
  Search,
  X,
} from "lucide-react";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { toast } from "sonner";

type ServiceOrderStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELED";

type ChargeStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELED";

type FinancialFilter =
  | "ALL"
  | "NO_CHARGE"
  | "READY_TO_CHARGE"
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELED";

type CustomerRef = {
  id: string;
  name: string;
  phone?: string | null;
};

type AssignedPersonRef = {
  id: string;
  name: string;
};

type AppointmentRef = {
  id: string;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
};

type FinancialSummary = {
  hasCharge: boolean;
  chargeId: string | null;
  chargeStatus: ChargeStatus | null;
  chargeAmountCents: number | null;
  chargeDueDate?: string | null;
  paidAt?: string | null;
};

type ServiceOrder = {
  id: string;
  customerId: string;
  customer?: CustomerRef | null;
  assignedToPersonId?: string | null;
  assignedTo?: AssignedPersonRef | null;
  appointmentId?: string | null;
  appointment?: AppointmentRef | null;
  title: string;
  description?: string | null;
  status: ServiceOrderStatus;
  priority?: number | null;
  scheduledFor?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  amountCents?: number | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  financialSummary?: FinancialSummary | null;
};

type ServiceOrdersPagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type ServiceOrdersListResult = {
  data: ServiceOrder[];
  pagination: ServiceOrdersPagination;
};

type GenerateChargeResponse = {
  created?: boolean;
  chargeId?: string;
};

const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  OPEN: "Aberta",
  ASSIGNED: "Atribuída",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};

const STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ASSIGNED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IN_PROGRESS:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CANCELED: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

function getPriorityLabel(priority?: number | null) {
  switch (priority) {
    case 1:
      return "Muito baixa";
    case 2:
      return "Baixa";
    case 3:
      return "Média";
    case 4:
      return "Alta";
    case 5:
      return "Urgente";
    default:
      return "Baixa";
  }
}

function getPriorityColor(priority?: number | null) {
  switch (priority) {
    case 5:
      return "text-red-500";
    case 4:
      return "text-orange-500";
    case 3:
      return "text-blue-500";
    case 2:
      return "text-gray-500";
    case 1:
      return "text-zinc-400";
    default:
      return "text-gray-500";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(cents?: number | null) {
  const amount = Number(cents ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount / 100);
}

function getChargeBadge(financialSummary?: FinancialSummary | null) {
  if (!financialSummary?.hasCharge || !financialSummary.chargeStatus) {
    return {
      label: "Sem cobrança",
      className:
        "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
    };
  }

  switch (financialSummary.chargeStatus) {
    case "PAID":
      return {
        label: "Cobrança paga",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      };
    case "OVERDUE":
      return {
        label: "Cobrança vencida",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      };
    case "CANCELED":
      return {
        label: "Cobrança cancelada",
        className:
          "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      };
    case "PENDING":
    default:
      return {
        label: "Cobrança pendente",
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      };
  }
}

function getOperationalStage(os: ServiceOrder) {
  switch (os.status) {
    case "OPEN":
      return {
        label: "Aguardando início",
        description: "A O.S. existe, mas ainda não foi colocada em execução.",
        className:
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300",
        icon: CircleDashed,
      };
    case "ASSIGNED":
      return {
        label: "Aguardando execução",
        description:
          "A O.S. já foi atribuída e espera o início real do serviço.",
        className:
          "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/20 dark:text-yellow-300",
        icon: User,
      };
    case "IN_PROGRESS":
      return {
        label: "Execução em andamento",
        description: "O serviço está rodando e ainda não foi concluído.",
        className:
          "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-300",
        icon: Clock3,
      };
    case "DONE":
      return {
        label: "Execução concluída",
        description: "A operação foi finalizada e já entrou na etapa financeira.",
        className:
          "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300",
        icon: CheckCircle2,
      };
    case "CANCELED":
    default:
      return {
        label: "Execução cancelada",
        description: "A O.S. foi encerrada sem continuidade operacional.",
        className:
          "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
        icon: CircleOff,
      };
  }
}

function getFinancialStage(os: ServiceOrder) {
  const financialSummary = os.financialSummary ?? null;
  const amountDefined = Boolean(os.amountCents && os.amountCents > 0);

  if (financialSummary?.chargeStatus === "PAID") {
    return {
      label: "Fluxo financeiro fechado",
      description: "Existe cobrança vinculada e o pagamento já foi registrado.",
      className:
        "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300",
      icon: BadgeDollarSign,
    };
  }

  if (financialSummary?.chargeStatus === "OVERDUE") {
    return {
      label: "Cobrança vencida",
      description: "A cobrança existe, mas está em atraso e exige ação.",
      className:
        "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300",
      icon: AlertCircle,
    };
  }

  if (financialSummary?.chargeStatus === "PENDING") {
    return {
      label: "Cobrança pendente",
      description: "A cobrança foi gerada e aguarda pagamento.",
      className:
        "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/20 dark:text-yellow-300",
      icon: Wallet,
    };
  }

  if (financialSummary?.chargeStatus === "CANCELED") {
    return {
      label: "Cobrança cancelada",
      description: "Existe cobrança vinculada, mas ela foi cancelada.",
      className:
        "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
      icon: Receipt,
    };
  }

  if (os.status === "DONE" && amountDefined) {
    return {
      label: "Pronta para cobrança",
      description:
        "A execução terminou, há valor definido e a cobrança ainda precisa ser vinculada.",
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300",
      icon: ArrowRightLeft,
    };
  }

  if (os.status === "DONE" && !amountDefined) {
    return {
      label: "Sem valor definido",
      description:
        "A O.S. foi concluída, mas ainda não há valor suficiente para preparar a cobrança.",
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300",
      icon: AlertCircle,
    };
  }

  return {
    label: "Financeiro ainda não iniciado",
    description:
      "A etapa financeira ainda depende do fechamento operacional da O.S.",
    className:
      "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    icon: Wallet,
  };
}

function getFinancialFilterLabel(value: FinancialFilter) {
  switch (value) {
    case "ALL":
      return "Todos os estados financeiros";
    case "NO_CHARGE":
      return "Sem cobrança";
    case "READY_TO_CHARGE":
      return "Prontas para cobrança";
    case "PENDING":
      return "Cobrança pendente";
    case "PAID":
      return "Cobrança paga";
    case "OVERDUE":
      return "Cobrança vencida";
    case "CANCELED":
      return "Cobrança cancelada";
    default:
      return value;
  }
}

function matchesFinancialFilter(
  os: ServiceOrder,
  filter: FinancialFilter
) {
  if (filter === "ALL") return true;

  const summary = os.financialSummary ?? null;
  const amountDefined = Boolean(os.amountCents && os.amountCents > 0);

  if (filter === "NO_CHARGE") {
    return !summary?.hasCharge;
  }

  if (filter === "READY_TO_CHARGE") {
    return os.status === "DONE" && amountDefined && !summary?.hasCharge;
  }

  return summary?.chargeStatus === filter;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export default function ServiceOrdersPage() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const limit = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | "">("");
  const [financialFilter, setFinancialFilter] =
    useState<FinancialFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const listQuery = trpc.nexo.serviceOrders.list.useQuery(
    {
      page,
      limit,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const serviceOrdersResult = (listQuery.data ?? {
    data: [],
    pagination: {
      page: 1,
      limit,
      total: 0,
      pages: 1,
    },
  }) as ServiceOrdersListResult;

  const serviceOrders = useMemo(() => {
    return Array.isArray(serviceOrdersResult.data) ? serviceOrdersResult.data : [];
  }, [serviceOrdersResult]);

  const filteredServiceOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return serviceOrders.filter((os) => {
      const matchesText =
        !q ||
        String(os.title ?? "").toLowerCase().includes(q) ||
        String(os.description ?? "").toLowerCase().includes(q) ||
        String(os.customer?.name ?? "").toLowerCase().includes(q) ||
        String(os.assignedTo?.name ?? "").toLowerCase().includes(q);

      const matchesFinance = matchesFinancialFilter(os, financialFilter);

      return matchesText && matchesFinance;
    });
  }, [financialFilter, searchQuery, serviceOrders]);

  const pagination = serviceOrdersResult.pagination ?? {
    page: 1,
    limit,
    total: 0,
    pages: 1,
  };

  const updateMutation = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: () => {
      toast.success("OS atualizada com sucesso!");
      void listQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao atualizar OS");
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const generateChargeMutation = trpc.nexo.serviceOrders.generateCharge.useMutation({
    onError: (err) => {
      toast.error(err.message || "Erro ao gerar cobrança");
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const customers = useMemo(() => {
    const payload = customersQuery.data;
    const rows = Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows.map((customer: any) => ({
      id: String(customer.id),
      name: String(customer.name),
    }));
  }, [customersQuery.data]);

  useEffect(() => {
    if (listQuery.error) {
      toast.error("Erro ao carregar ordens de serviço: " + listQuery.error.message);
    }
  }, [listQuery.error]);

  const handleStatusChange = (id: string, newStatus: ServiceOrderStatus) => {
    setProcessingId(id);
    updateMutation.mutate({
      id,
      data: { status: newStatus },
    });
  };

  const handleStartExecution = (id: string) => {
    setProcessingId(id);
    updateMutation.mutate({
      id,
      data: { status: "IN_PROGRESS" },
    });
  };

  const handleFinishExecution = (id: string) => {
    setProcessingId(id);
    updateMutation.mutate({
      id,
      data: { status: "DONE" },
    });
  };

  const handleGenerateCharge = async (serviceOrder: ServiceOrder) => {
    if (!serviceOrder.customerId) {
      toast.error("OS sem cliente vinculado.");
      return;
    }

    if (!serviceOrder.amountCents || serviceOrder.amountCents <= 0) {
      toast.error("Defina um valor válido na OS antes de gerar cobrança.");
      return;
    }

    setProcessingId(serviceOrder.id);

    try {
      const payload = (await generateChargeMutation.mutateAsync({
        id: serviceOrder.id,
      })) as GenerateChargeResponse;

      await Promise.all([
        listQuery.refetch(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);

      if (payload?.created) {
        toast.success("Cobrança gerada com sucesso!");
        return;
      }

      if (payload?.chargeId) {
        toast.success("Cobrança já existia e foi reaproveitada.");
        return;
      }

      toast.success("Verificação de cobrança concluída.");
    } catch {
      // toast já tratado
    }
  };

  const handleOpenCharge = (serviceOrderId: string) => {
    navigate(`/finances?serviceOrderId=${encodeURIComponent(serviceOrderId)}`);
  };

  const handleApplySearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleClearLocalFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setFinancialFilter("ALL");
  };

  const total = filteredServiceOrders.length;
  const totalOpen = filteredServiceOrders.filter((os) => os.status === "OPEN").length;
  const totalAssigned = filteredServiceOrders.filter((os) => os.status === "ASSIGNED").length;
  const totalInProgress = filteredServiceOrders.filter(
    (os) => os.status === "IN_PROGRESS"
  ).length;

  const doneWithCharge = filteredServiceOrders.filter((os) => {
    if (os.status !== "DONE") return false;
    return Boolean(os.financialSummary?.hasCharge);
  }).length;

  const doneWithoutCharge = filteredServiceOrders.filter((os) => {
    if (os.status !== "DONE") return false;
    if (!os.amountCents || os.amountCents <= 0) return false;
    return !os.financialSummary?.hasCharge;
  }).length;

  const hasLocalFilters = Boolean(searchQuery) || financialFilter !== "ALL";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <ClipboardList className="h-6 w-6 text-orange-500" />
            Ordens de Serviço
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Execução, fechamento operacional e transição para cobrança em uma leitura só.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="mr-1 h-4 w-4" />
            Nova OS
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_260px_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApplySearch();
            }}
            placeholder="Buscar por título, cliente, descrição ou responsável"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <select
          value={financialFilter}
          onChange={(e) => setFinancialFilter(e.target.value as FinancialFilter)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="ALL">Todos os estados financeiros</option>
          <option value="NO_CHARGE">Sem cobrança</option>
          <option value="READY_TO_CHARGE">Prontas para cobrança</option>
          <option value="PENDING">Cobrança pendente</option>
          <option value="PAID">Cobrança paga</option>
          <option value="OVERDUE">Cobrança vencida</option>
          <option value="CANCELED">Cobrança cancelada</option>
        </select>

        <Button onClick={handleApplySearch}>Buscar</Button>

        <Button
          variant="outline"
          onClick={handleClearLocalFilters}
          disabled={!hasLocalFilters && !searchInput}
        >
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </div>

      {hasLocalFilters ? (
        <div className="flex flex-wrap gap-2 text-sm text-gray-500">
          {searchQuery ? (
            <span className="rounded-full border px-3 py-1">
              Busca local: {searchQuery}
            </span>
          ) : null}
          {financialFilter !== "ALL" ? (
            <span className="rounded-full border px-3 py-1">
              Financeiro: {getFinancialFilterLabel(financialFilter)}
            </span>
          ) : null}
          <span className="rounded-full border px-3 py-1">
            Filtros locais na página {pagination.page}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total na página</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Abertas</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalOpen}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Atribuídas</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {totalAssigned}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Em andamento</p>
          <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {totalInProgress}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Concluídas c/ cobrança</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {doneWithCharge}
          </p>
        </div>

        <div className="rounded-lg border border-red-200 bg-white p-4 dark:border-red-800 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Prontas sem cobrança</p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
            {doneWithoutCharge}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["", "OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"] as const).map(
          (status) => (
            <button
              key={status || "ALL"}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                statusFilter === status
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {status === "" ? "Todos" : STATUS_LABELS[status]}
            </button>
          )
        )}
      </div>

      {listQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-500">Carregando...</span>
        </div>
      )}

      {listQuery.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>Erro ao carregar ordens de serviço. Tente novamente.</span>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && filteredServiceOrders.length === 0 && (
        <div className="py-12 text-center">
          <ClipboardList className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            {serviceOrders.length === 0
              ? "Nenhuma ordem de serviço encontrada."
              : "Nenhuma ordem corresponde aos filtros locais."}
          </p>
          {serviceOrders.length === 0 ? (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Plus className="mr-1 h-4 w-4" />
              Criar primeira OS
            </Button>
          ) : null}
        </div>
      )}

      {filteredServiceOrders.length > 0 && (
        <div className="space-y-4">
          {filteredServiceOrders.map((os) => {
            const isProcessing = processingId === os.id;
            const financialSummary = os.financialSummary ?? null;
            const chargeBadge = getChargeBadge(financialSummary);
            const canGenerateCharge =
              os.status === "DONE" &&
              !!os.amountCents &&
              os.amountCents > 0 &&
              !financialSummary?.hasCharge;

            const operationalStage = getOperationalStage(os);
            const financialStage = getFinancialStage(os);

            const OperationalIcon = operationalStage.icon;
            const FinancialIcon = financialStage.icon;

            return (
              <div
                key={os.id}
                className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                          {os.title}
                        </h3>

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[os.status]
                          }`}
                        >
                          {STATUS_LABELS[os.status]}
                        </span>

                        <span
                          className={`text-xs font-medium ${getPriorityColor(os.priority)}`}
                        >
                          ● {getPriorityLabel(os.priority)}
                        </span>

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${chargeBadge.className}`}
                        >
                          {chargeBadge.label}
                        </span>
                      </div>

                      {os.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                          {os.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                          Sem descrição operacional.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={os.status}
                        onChange={(e) =>
                          handleStatusChange(os.id, e.target.value as ServiceOrderStatus)
                        }
                        disabled={updateMutation.isPending || isProcessing}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartExecution(os.id)}
                        disabled={
                          os.status === "IN_PROGRESS" ||
                          os.status === "DONE" ||
                          os.status === "CANCELED" ||
                          updateMutation.isPending ||
                          isProcessing
                        }
                      >
                        Iniciar execução
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFinishExecution(os.id)}
                        disabled={
                          os.status !== "IN_PROGRESS" ||
                          updateMutation.isPending ||
                          isProcessing
                        }
                      >
                        Finalizar execução
                      </Button>

                      <Button
                        size="sm"
                        variant={canGenerateCharge ? "default" : "outline"}
                        onClick={() => {
                          if (canGenerateCharge) {
                            void handleGenerateCharge(os);
                            return;
                          }

                          if (financialSummary?.hasCharge) {
                            handleOpenCharge(os.id);
                          }
                        }}
                        disabled={generateChargeMutation.isPending || isProcessing}
                        className="gap-2"
                      >
                        <Wallet className="h-4 w-4" />
                        {canGenerateCharge
                          ? "Gerar cobrança"
                          : financialSummary?.hasCharge
                            ? "Ver cobrança"
                            : "Cobrança indisponível"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div
                      className={`rounded-lg border p-3 ${operationalStage.className}`}
                    >
                      <div className="flex items-start gap-2">
                        <OperationalIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{operationalStage.label}</p>
                          <p className="mt-1 text-xs opacity-90">
                            {operationalStage.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-lg border p-3 ${financialStage.className}`}>
                      <div className="flex items-start gap-2">
                        <FinancialIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{financialStage.label}</p>
                          <p className="mt-1 text-xs opacity-90">
                            {financialStage.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoItem
                      label="Cliente"
                      value={os.customer?.name ?? "Cliente não identificado"}
                    />

                    <InfoItem
                      label="Responsável"
                      value={os.assignedTo?.name ?? "Ainda não atribuído"}
                    />

                    <InfoItem
                      label="Agendada para"
                      value={formatDateTime(os.scheduledFor)}
                    />

                    <InfoItem
                      label="Criada em"
                      value={formatDate(os.createdAt)}
                    />

                    <InfoItem
                      label="Início da execução"
                      value={formatDateTime(os.startedAt)}
                    />

                    <InfoItem
                      label="Conclusão"
                      value={formatDateTime(os.finishedAt)}
                    />

                    <InfoItem
                      label="Valor da O.S."
                      value={formatCurrency(os.amountCents)}
                    />

                    <InfoItem
                      label="Vencimento"
                      value={formatDate(os.dueDate)}
                    />
                  </div>

                  {os.appointment ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Agendamento vinculado:
                      </span>{" "}
                      {formatDateTime(os.appointment.startsAt)} •{" "}
                      {os.appointment.status || "Sem status"}
                    </div>
                  ) : null}

                  {financialSummary?.hasCharge ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900/40">
                      <p className="flex items-center gap-1 font-medium text-gray-900 dark:text-white">
                        <Receipt className="h-3.5 w-3.5" />
                        Cobrança vinculada
                      </p>

                      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                            {financialSummary.chargeStatus ?? "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Valor
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(financialSummary.chargeAmountCents)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Vencimento
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(financialSummary.chargeDueDate)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Pago em
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                            {formatDateTime(financialSummary.paidAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>

          <span className="text-sm text-gray-500">
            {page} / {pagination.pages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPage((current) => Math.min(pagination.pages, current + 1))
            }
            disabled={page >= pagination.pages}
          >
            Próxima
          </Button>
        </div>
      )}

      <CreateServiceOrderModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          void listQuery.refetch();
          toast.success("OS criada com sucesso!");
        }}
        customers={customers}
      />
    </div>
  );
}
