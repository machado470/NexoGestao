import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, Plus, RefreshCcw } from "lucide-react";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import { Button } from "@/components/ui/button";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function CustomersPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // ✅ Agora vem do Nest via BFF proxy
  const listCustomers = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const customers: Customer[] = useMemo(() => {
    // resposta do proxy: { ok, data: Customer[] }
    return (listCustomers.data?.data ?? []) as Customer[];
  }, [listCustomers.data]);

  useEffect(() => {
    if (listCustomers.error) {
      toast.error("Erro ao carregar clientes: " + listCustomers.error.message);
    }
  }, [listCustomers.error]);

  const total = customers.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />
            Clientes
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Lista vinda do NexoGestão (Nest) via BFF (cookie httpOnly).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void listCustomers.refetch()}
            className="flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Atualizar
          </Button>

          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total de Clientes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Ativos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {customers.filter(c => c.active).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Inativos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {customers.filter(c => !c.active).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Lista
          </p>
        </div>

        {listCustomers.isLoading ? (
          <div className="p-6 text-sm text-gray-600 dark:text-gray-400">
            Carregando...
          </div>
        ) : customers.length === 0 ? (
          <div className="p-6 text-sm text-gray-600 dark:text-gray-400">
            Nenhum cliente ainda. Crie o primeiro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Nome</th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Telefone</th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          c.active
                            ? "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        }
                      >
                        {c.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <CreateCustomerModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={async () => {
          await listCustomers.refetch();
        }}
      />
    </div>
  );
}
