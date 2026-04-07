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
  CalendarDays,
  Briefcase,
  Wallet,
  History,
  Sparkles,
  Phone,
  Mail,
  ArrowRightLeft,
  Link2,
  MessageCircle,
} from "lucide-react";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import EditCustomerModal from "@/components/EditCustomerModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildFinanceChargeUrl,
  buildServiceOrdersDeepLink,
} from "@/lib/operations/operations.utils";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";

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
  amountCents?: number;
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
  }).format(value / 100);
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

function normalizeWorkspacePayload(payload: unknown): CustomerWorkspace | null {
  const raw = normalizeObjectPayload<any>(payload);

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const customer = raw.customer;

  if (!customer || typeof customer !== "object") {
    return null;
  }

  return {
    customer: customer as Customer,
    appointments: Array.isArray(raw.appointments) ? raw.appointments : [],
    serviceOrders: Array.isArray(raw.serviceOrders) ? raw.serviceOrders : [],
    charges: Array.isArray(raw.charges)
      ? raw.charges.map((item: unknown) => {
          const charge = (item ?? {}) as Record<string, unknown>;
          const amountCentsRaw =
            typeof charge.amountCents === "number"
              ? charge.amountCents
              : typeof charge.amount === "number"
                ? charge.amount
                : undefined;

          return {
            ...charge,
            amountCents: amountCentsRaw,
          } as Charge;
        })
      : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
  };
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
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
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

function SummaryCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: "default" | "success" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
      : tone === "muted"
        ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40"
        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
}

function getChargeStatusLabel(status?: string) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "PAID":
      return "Paga";
    case "OVERDUE":
      return "Vencida";
    case "CANCELED":
      return "Cancelada";
    default:
      return status || "—";
  }
}

function getChargeStatusTone(status?: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "OVERDUE":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "CANCELED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300";
  }
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

  const customers = useMemo(() => {
    return normalizeArrayPayload<Customer>(listCustomers.data);
  }, [listCustomers.data]);

  const workspace = useMemo(() => {
    return normalizeWorkspacePayload(workspaceQuery.data);
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
      setWorkspaceCustomerId(current => {
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
  const totalActive = customers.filter(c => c.active).length;
  const totalInactive = total - totalActive;

  const openWorkspace = (customerId: string) => {
    setWorkspaceCustomerId(customerId);
    navigate(buildCustomersUrl(customerId), { replace: false });
  };

  const closeWorkspace = () => {
    setWorkspaceCustomerId(null);
    navigate(buildCustomersUrl(null), { replace: false });
  };

  const workspaceAppointmentsCount = workspace?.appointments?.length ?? 0;
  const workspaceServiceOrdersCount = workspace?.serviceOrders?.length ?? 0;
  const workspaceChargesCount = workspace?.charges?.length ?? 0;
  const workspacePendingCharges = (workspace?.charges ?? []).filter(
    item => item.status === "PENDING" || item.status === "OVERDUE"
  ).length;

  const nextActionLabel = !workspace
    ? "Selecione um cliente para abrir o workspace."
    : workspacePendingCharges > 0
      ? "Cobrar cliente imediatamente"
      : workspaceServiceOrdersCount > 0
        ? "Acompanhar execução das ordens"
        : workspaceAppointmentsCount > 0
          ? "Preparar atendimento agendado"
          : "Iniciar relacionamento com este cliente";

  return (
    <PageShell>
      <PageHero
        eyebrow="Clientes"
        title={
          <span className="inline-flex items-center gap-2">
            <Users className="h-6 w-6 text-orange-500" />
            Clientes
          </span>
        }
        description="Ponto de partida do fluxo oficial: cada cliente conecta agenda, execução, cobrança, comunicação e rastreabilidade."
        actions={
          <>
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
          </>
        }
      />

      <SurfaceSection className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
          <Sparkles className="h-3.5 w-3.5" />
          Entidade central do relacionamento operacional
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            title="Total de clientes"
            value={total}
            subtitle="Base cadastrada e visível"
          />
          <SummaryCard
            title="Clientes ativos"
            value={totalActive}
            subtitle="Prontos para operar no fluxo"
            tone="success"
          />
          <SummaryCard
            title="Clientes inativos"
            value={totalInactive}
            subtitle="Base sem operação ativa no momento"
            tone="muted"
          />
        </div>

        <SurfaceSection className="overflow-hidden rounded-xl border border-gray-200 bg-white p-0 dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Lista de clientes
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Abra o workspace para enxergar contexto consolidado e próxima
                  ação.
                </p>
              </div>
            </div>
          </div>

          {listCustomers.isLoading ? (
            <SurfaceSection className="m-4 flex min-h-[140px] items-center justify-center text-sm text-gray-600 dark:text-gray-400">
              Carregando clientes...
            </SurfaceSection>
          ) : customers.length === 0 ? (
            <SurfaceSection className="m-4 space-y-3">
              <EmptyState
                icon={<Users className="h-7 w-7" />}
                title="Sua base de clientes ainda está vazia"
                description="Cadastre o primeiro cliente para destravar o fluxo Clientes → Agendamentos → O.S. → Financeiro → WhatsApp → Timeline."
                action={{
                  label: "Cadastrar primeiro cliente",
                  onClick: () => setIsCreateOpen(true),
                }}
                secondaryAction={{
                  label: "Recarregar clientes",
                  onClick: () => void listCustomers.refetch(),
                }}
              />
              <DemoEnvironmentCta />
            </SurfaceSection>
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
                  {customers.map(customer => {
                    const isOpen = workspaceCustomerId === customer.id;

                    return (
                      <tr
                        key={customer.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-900/30 ${
                          isOpen ? "bg-orange-50/60 dark:bg-orange-950/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{customer.name}</span>
                            {isOpen ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                Em foco
                              </span>
                            ) : null}
                          </div>
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
                              variant={isOpen ? "default" : "outline"}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceSection>
      </SurfaceSection>

      <Dialog
        open={Boolean(workspaceCustomerId)}
        onOpenChange={(open) => (!open ? closeWorkspace() : undefined)}
      >
        <DialogContent
          className="left-auto right-0 top-0 h-screen w-full max-h-screen max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none border-l border-gray-200 bg-gray-50 p-0 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        >
          <DialogHeader className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-orange-500">
                Workspace do cliente
              </p>
              <DialogTitle className="mt-1 text-left text-xl font-semibold text-gray-900 dark:text-white">
                {workspace?.customer?.name ?? "Carregando..."}
              </DialogTitle>
              <DialogDescription className="mt-1 text-left text-sm text-gray-600 dark:text-gray-400">
                Hub lateral de contexto, histórico e próxima ação.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4 p-5">
              {workspaceQuery.isLoading ? (
                <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  Carregando workspace...
                </div>
              ) : !workspace ? (
                <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  Não foi possível carregar o workspace deste cliente.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-orange-300 bg-orange-100 p-4 dark:border-orange-900 dark:bg-orange-950/20">
                    <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                      Próxima ação recomendada
                    </p>

                    <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                      {nextActionLabel}
                    </p>
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/appointments?customerId=${workspace.customer.id}`
                            )
                          }
                          className="gap-2"
                        >
                          <CalendarDays className="h-4 w-4" />
                          Abrir agenda do cliente
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/service-orders?customerId=${workspace.customer.id}`
                            )
                          }
                          className="gap-2"
                        >
                          <Briefcase className="h-4 w-4" />
                          Ver execuções
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(`/finances?customerId=${workspace.customer.id}`)
                          }
                          className="gap-2"
                        >
                          <Wallet className="h-4 w-4" />
                          Ver cobranças
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/whatsapp?customerId=${workspace.customer.id}`
                            )
                          }
                          className="gap-2"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Falar com cliente
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(buildCustomersUrl(workspace.customer.id))
                          }
                          className="gap-2"
                        >
                          <Link2 className="h-4 w-4" />
                          Deep-link
                        </Button>
                      </div>

                      <p className="text-xs text-orange-800 dark:text-orange-300">
                        Use este cliente como ponto de partida para navegar pelo
                        resto do fluxo.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Phone className="h-4 w-4" />
                        Telefone
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {workspace.customer.phone ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Mail className="h-4 w-4" />
                        Email
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {workspace.customer.email ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Status
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {workspace.customer.active ? "Ativo" : "Inativo"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Criado em
                      </p>
                      <p className="mt-1 font-medium text-gray-900 dark:text-white">
                        {formatDate(workspace.customer.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                      title="Agendamentos"
                      value={workspaceAppointmentsCount}
                      subtitle="Histórico no workspace"
                    />
                    <SummaryCard
                      title="Ordens de serviço"
                      value={workspaceServiceOrdersCount}
                      subtitle="Execuções vinculadas"
                    />
                    <SummaryCard
                      title="Cobranças"
                      value={workspaceChargesCount}
                      subtitle="Eventos financeiros do cliente"
                    />
                    <SummaryCard
                      title="Pendências"
                      value={workspacePendingCharges}
                      subtitle="Cobranças que ainda pedem ação"
                      tone={workspacePendingCharges > 0 ? "default" : "muted"}
                    />
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
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
                    emptyText="Sem agendamentos recentes. Programe um novo horário para manter a operação em movimento."
                  >
                    {workspace.appointments.slice(0, 5).map(item => (
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
                    emptyText="Nenhuma O.S. vinculada ainda. Crie uma ordem para iniciar execução e rastreabilidade."
                  >
                    {workspace.serviceOrders.slice(0, 5).map(item => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
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

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(buildServiceOrdersDeepLink(item.id))
                            }
                          >
                            <ArrowRightLeft className="mr-1 h-4 w-4" />
                            Abrir ordem
                          </Button>
                        </div>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Cobranças recentes"
                    icon={Wallet}
                    emptyText="Sem cobranças registradas. Gere uma cobrança para acompanhar pendências e recebimentos."
                  >
                    {workspace.charges.slice(0, 5).map(item => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(item.amountCents)}
                            </p>
                            <p className="mt-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getChargeStatusTone(item.status)}`}
                              >
                                {getChargeStatusLabel(item.status)}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Vencimento: {formatDate(item.dueDate)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(buildFinanceChargeUrl(item.id))
                            }
                          >
                            <ArrowRightLeft className="mr-1 h-4 w-4" />
                            Abrir cobrança
                          </Button>
                        </div>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Timeline recente"
                    icon={History}
                    emptyText="Sem eventos recentes no histórico. Novas interações aparecerão aqui automaticamente."
                  >
                    {workspace.timeline.slice(0, 8).map(item => (
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
        </DialogContent>
      </Dialog>

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
    </PageShell>
  );
}
