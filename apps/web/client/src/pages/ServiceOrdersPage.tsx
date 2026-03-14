import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, ClipboardList, User, Calendar, AlertCircle } from "lucide-react";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  ASSIGNED: "Atribuída",
  IN_PROGRESS: "Em Andamento",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ASSIGNED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CANCELED: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-blue-500",
  HIGH: "text-orange-500",
  URGENT: "text-red-500",
};

export default function ServiceOrdersPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const listQuery = trpc.nexo.serviceOrders.list.useQuery({ page, limit });
  const updateMutation = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: () => {
      toast.success("OS atualizada com sucesso!");
      void listQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar OS"),
  });

  const deleteMutation = trpc.nexo.serviceOrders.delete.useMutation({
    onSuccess: () => {
      toast.success("OS removida!");
      void listQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Erro ao remover OS"),
  });

  const serviceOrders = (listQuery.data?.data ?? []) as any[];
  const pagination = listQuery.data?.pagination;

  const filtered = statusFilter
    ? serviceOrders.filter((os) => os.status === statusFilter)
    : serviceOrders;

  const handleStatusChange = (id: number | string, newStatus: string) => {
    updateMutation.mutate({ id: String(id), data: { status: newStatus as any } });
  };

  const handleStartExecution = (id: number | string) => {
    updateMutation.mutate(
      { id: String(id), data: { status: "IN_PROGRESS" as any } },
      {
        onSuccess: () => {
          toast.success("Execução iniciada.");
          void listQuery.refetch();
        },
      }
    );
  };

  const handleFinishExecution = (id: number | string) => {
    updateMutation.mutate(
      { id: String(id), data: { status: "DONE" as any } },
      {
        onSuccess: () => {
          toast.success("Execução finalizada.");
          void listQuery.refetch();
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-500" />
            Ordens de Serviço
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie todas as ordens de serviço da sua organização
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova OS
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-orange-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {s === "" ? "Todos" : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {listQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-500">Carregando...</span>
        </div>
      )}

      {listQuery.isError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Erro ao carregar ordens de serviço. Tente novamente.</span>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && filtered.length === 0 && (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma ordem de serviço encontrada.</p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Criar primeira OS
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((os: any) => (
            <div
              key={os.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {os.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[os.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[os.status] ?? os.status}
                    </span>
                    {os.priority && (
                      <span
                        className={`text-xs font-medium ${
                          PRIORITY_COLORS[os.priority] ?? "text-gray-500"
                        }`}
                      >
                        ● {PRIORITY_LABELS[os.priority] ?? os.priority}
                      </span>
                    )}
                  </div>
                  {os.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {os.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                    {os.customer && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {os.customer.name}
                      </span>
                    )}
                    {os.createdAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(os.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-shrink-0 flex-wrap">
                  <select
                    value={os.status}
                    onChange={(e) => handleStatusChange(os.id, e.target.value)}
                    disabled={updateMutation.isPending}
                    className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartExecution(os.id)}
                    disabled={os.status === "IN_PROGRESS" || os.status === "DONE" || updateMutation.isPending}
                  >
                    Iniciar execução
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFinishExecution(os.id)}
                    disabled={os.status !== "IN_PROGRESS" || updateMutation.isPending}
                  >
                    Finalizar execução
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Remover esta OS?")) {
                        deleteMutation.mutate({ id: String(os.id) });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs px-2 py-1"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Anterior
          </Button>
          <span className="text-sm text-gray-500">{page} / {pagination.pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}>
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
      />
    </div>
  );
}
