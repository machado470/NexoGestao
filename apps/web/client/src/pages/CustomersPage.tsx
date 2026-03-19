import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users,
  Plus,
  RefreshCcw,
  Pencil,
  PanelRightOpen,
  X,
  CalendarDays,
  Briefcase,
  Wallet,
  History,
} from "lucide-react";
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

type Appointment = {
  id: string;
  startsAt?: string;
  endsAt?: string | null;
  status?: string;
  notes?: string | null;
};

type ServiceOrder = {
  id: string;
  title?: string;
  status?: string;
  createdAt?: string;
  scheduledFor?: string | null;
};

type Charge = {
  id: string;
  amount?: number;
  status?: string;
  dueDate?: string | null;
  createdAt?: string;
};

type TimelineEvent = {
  id: string;
  action?: string;
  description?: string | null;
  createdAt?: string;
};

type CustomerWorkspace = {
  customer: Customer;
  appointments: Appointment[];
  serviceOrders: ServiceOrder[];
  charges: Charge[];
  timeline: TimelineEvent[];
};

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

function truncateText(value?: string | null, max = 48) {
  const text = (value ?? "").trim();
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatCurrency(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getCustomerIdFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const customerId = params.get("customerId")?.trim() ?? "";

  return customerId || null;
}

function buildCustomersUrl(customerId?: string | null) {
  const params = new URLSearchParams();

  if (customerId) {
    params.set("customerId", customerId);
  }

  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

function SectionCard({
  title,
  icon: Icon,
  emptyText,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  emptyText: string;
  children: ReactNode;
}) {
  const hasContent = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>

      {hasContent ? (
        <div className="space-y-3">{children}</div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null
  );
  const [workspaceCustomerId, setWorkspaceCustomerId] = useState<string | null>(
    () => getCustomerIdFromUrl()
  );

  const listCustomers = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: workspaceCustomerId ?? "" },
    {
      enabled: Boolean(workspaceCustomerId),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customers: Customer[] = useMemo(() => {
    return (listCustomers.data?.data ?? []) as Customer[];
  }, [listCustomers.data]);

  const workspace = useMemo(() => {
    return (workspaceQuery.data?.data ??
      workspaceQuery.data ??
      null) as CustomerWorkspace | null;
  }, [workspaceQuery.data]);

  useEffect(() => {
    if (listCustomers.error) {
      toast.error("Erro ao carregar clientes: " + listCustomers.error.message);
    }
  }, [listCustomers.error]);

  useEffect(() => {
    if (workspaceQuery.error) {
      toast.error(
        "Erro ao carregar workspace do cliente: " + workspaceQuery.error.message
      );
    }
  }, [workspaceQuery.error]);

  useEffect(() => {
    const syncFromUrl = () => {
      const customerIdFromUrl = getCustomerIdFromUrl();
      setWorkspaceCustomerId((current) => {
        if (current === customerIdFromUrl) return current;
        return customerIdFromUrl;
      });
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  const total = customers.length;
  const totalActive = customers.filter((c) => c.active).length;
  const totalInactive = total - totalActive;

  const openWorkspace = (customerId: string) => {
    setWorkspaceCustomerId(customerId);
    navigate(buildCustomersUrl(customerId), { replace: false });
  };

  const closeWorkspace = () => {
    setWorkspaceCustomerId(null);
    navigate(buildCustomersUrl(null), { replace: false });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Users className="h-6 w-6 text-orange-500" />
            Clientes
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Base operacional de clientes vinda do NexoGestão via BFF com sessão
            em cookie httpOnly.
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total de Clientes
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {total}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Ativos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {totalActive}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Inativos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {totalInactive}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
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
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Nome
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Telefone
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Observações
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Criado em
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Ações
                  </th>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openWorkspace(customer.id)}
                          className="inline-flex items-center gap-2"
                        >
                          <PanelRightOpen className="h-4 w-4" />
                          Workspace
                        </Button>

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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {workspaceCustomerId ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeWorkspace} />

          <div className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-orange-500">
                    Workspace do cliente
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                    {workspace?.customer?.name ?? "Carregando..."}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Histórico operacional consolidado do cliente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeWorkspace}
                  className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {workspaceQuery.isLoading ? (
                <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  Carregando workspace...
                </div>
              ) : !workspace ? (
                <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  Não foi possível carregar o workspace deste cliente.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Telefone
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {workspace.customer.phone ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Email
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {workspace.customer.email ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Status
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {workspace.customer.active ? "Ativo" : "Inativo"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Criado em
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {formatDate(workspace.customer.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Observações
                    </p>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {workspace.customer.notes?.trim() || "Sem observações."}
                    </p>
                  </div>

                  <SectionCard
                    title="Agendamentos recentes"
                    icon={CalendarDays}
                    emptyText="Nenhum agendamento encontrado para este cliente."
                  >
                    {workspace.appointments.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDateTime(item.startsAt)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Status: {item.status ?? "—"}
                        </p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {truncateText(item.notes, 120)}
                        </p>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Ordens de serviço recentes"
                    icon={Briefcase}
                    emptyText="Nenhuma ordem de serviço encontrada para este cliente."
                  >
                    {workspace.serviceOrders.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.title ?? "Ordem de serviço"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Status: {item.status ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Criada em: {formatDate(item.createdAt)}
                        </p>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Cobranças recentes"
                    icon={Wallet}
                    emptyText="Nenhuma cobrança encontrada para este cliente."
                  >
                    {workspace.charges.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(item.amount)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Status: {item.status ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Vencimento: {formatDate(item.dueDate)}
                        </p>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Timeline recente"
                    icon={History}
                    emptyText="Nenhum evento recente encontrado para este cliente."
                  >
                    {workspace.timeline.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.action ?? "EVENT"}
                        </p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {item.description?.trim() || "Sem descrição."}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    ))}
                  </SectionCard>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
