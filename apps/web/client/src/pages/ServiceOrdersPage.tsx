import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { toast } from "sonner";

type ServiceOrderStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DONE"
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

type ServiceOrder = {
  id: string;
  customerId: string;
  customer?: CustomerRef | null;
  assignedToPersonId?: string | null;
  assignedTo?: AssignedPersonRef | null;
  appointmentId?: string | null;
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
  ASSIGNED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
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

export default function ServiceOrdersPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | "">("");
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

  const generateChargeMutation = trpc.finance.charges.create.useMutation({
    onSuccess: async () => {
      toast.success("Cobrança gerada com sucesso!");
      await Promise.all([
        listQuery.refetch(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao gerar cobrança");
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const serviceOrders = useMemo(() => {
    const payload = listQuery.data;
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows as ServiceOrder[];
  }, [listQuery.data]);

  const pagination = listQuery.data?.pagination;

  const customers = useMemo(() => {
    const payload = customersQuery.data;
    const rows = Array.isArray(payload?.data)
      ? payload.data
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
      await generateChargeMutation.mutateAsync({
        customerId: serviceOrder.customerId,
        serviceOrderId: serviceOrder.id,
        amountCents: serviceOrder.amountCents,
        dueDate: serviceOrder.dueDate ?? new Date().toISOString(),
        notes: `Cobrança gerada manualmente para OS: ${serviceOrder.title}`,
      });
    } catch {
      // toast já tratado
    }
  };

  const total = serviceOrders.length;
  const totalOpen = serviceOrders.filter((os) => os.status === "OPEN").length;
  const totalInProgress = serviceOrders.filter(
    (os) => os.status === "IN_PROGRESS"
  ).length;
  const totalDone = serviceOrders.filter((os) => os.status === "DONE").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <ClipboardList className="h-6 w-6 text-orange-500" />
            Ordens de Serviço
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gerencie as ordens de serviço operacionais da sua organização.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Abertas</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalOpen}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Em andamento</p>
          <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {totalInProgress}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Concluídas</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {totalDone}
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

      {!listQuery.isLoading && !listQuery.isError && serviceOrders.length === 0 && (
        <div className="py-12 text-center">
          <ClipboardList className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            Nenhuma ordem de serviço encontrada.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="mr-1 h-4 w-4" />
            Criar primeira OS
          </Button>
        </div>
      )}

      {serviceOrders.length > 0 && (
        <div className="space-y-3">
          {serviceOrders.map((os) => {
            const isProcessing = processingId === os.id;

            return (
              <div
                key={os.id}
                className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-gray-900 dark:text-white">
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
                    </div>

                    {os.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                        {os.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {os.customer?.name ?? "Cliente não identificado"}
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Criada em {formatDate(os.createdAt)}
                      </span>

                      <span>Agendada para {formatDateTime(os.scheduledFor)}</span>

                      <span>Valor {formatCurrency(os.amountCents)}</span>

                      <span>Vencimento {formatDate(os.dueDate)}</span>
                    </div>

                    {os.assignedTo?.name ? (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Responsável: {os.assignedTo.name}
                      </p>
                    ) : null}

                    {os.appointmentId ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Agendamento vinculado: {os.appointmentId}
                      </p>
                    ) : null}

                    {os.finishedAt ? (
                      <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                        Finalizada em {formatDateTime(os.finishedAt)}
                      </p>
                    ) : null}
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
                      variant="outline"
                      onClick={() => void handleGenerateCharge(os)}
                      disabled={
                        generateChargeMutation.isPending ||
                        isProcessing ||
                        os.status !== "DONE" ||
                        !os.amountCents ||
                        os.amountCents <= 0
                      }
                      className="gap-2"
                    >
                      <Wallet className="h-4 w-4" />
                      Gerar cobrança
                    </Button>
                  </div>
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
