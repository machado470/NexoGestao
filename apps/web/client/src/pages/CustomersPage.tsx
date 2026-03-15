import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, Plus, RefreshCcw, Pencil } from "lucide-react";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import EditCustomerModal from "@/components/EditCustomerModal";
import { Button } from "@/components/ui/button";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateText(value?: string | null, max = 48) {
  const text = (value ?? "").trim();
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export default function CustomersPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  const listCustomers = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const customers: Customer[] = useMemo(() => {
    return (listCustomers.data?.data ?? []) as Customer[];
  }, [listCustomers.data]);

  useEffect(() => {
    if (listCustomers.error) {
      toast.error("Erro ao carregar clientes: " + listCustomers.error.message);
    }
  }, [listCustomers.error]);

  const total = customers.length;
  const totalActive = customers.filter((c) => c.active).length;
  const totalInactive = total - totalActive;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Users className="h-6 w-6 text-orange-500" />
            Clientes
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Base operacional de clientes vinda do NexoGestão via BFF com sessão em cookie httpOnly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void listCustomers.refetch()}
            className="flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>

          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total de Clientes</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Ativos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalActive}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Inativos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalInactive}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Lista</p>
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
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Observações</th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Criado em</th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {customer.name}
                    </td>

                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {customer.phone ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {customer.email ?? "—"}
                    </td>

                    <td
                      className="max-w-[260px] px-4 py-3 text-gray-700 dark:text-gray-300"
                      title={customer.notes ?? ""}
                    >
                      {truncateText(customer.notes)}
                    </td>

                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {formatDate(customer.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          customer.active
                            ? "inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        }
                      >
                        {customer.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCustomerId(customer.id)}
                        className="inline-flex items-center gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateCustomerModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={async () => {
          await listCustomers.refetch();
        }}
      />

      <EditCustomerModal
        open={Boolean(editingCustomerId)}
        customerId={editingCustomerId}
        onClose={() => setEditingCustomerId(null)}
        onSaved={() => void listCustomers.refetch()}
      />
    </div>
  );
}
