import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useChargeActions } from "@/hooks/useChargeActions";
import { getErrorMessage } from "@/lib/query-helpers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertCircle,
  Plus,
  Pencil,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  X,
  CreditCard,
  Wallet,
  Receipt,
  CalendarDays,
  ArrowRightLeft,
  BadgeDollarSign,
} from "lucide-react";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { EditChargeModal } from "@/components/EditChargeModal";

type ChargeStatusFilter = "ALL" | "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
type ChargeStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELED";

type Charge = {
  id: string;
  serviceOrderId?: string | null;
  customerId: string;
  amountCents: number;
  status: ChargeStatus;
  dueDate: string;
  paidAt?: string | null;
  createdAt?: string;
  notes?: string | null;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  serviceOrder?: {
    id: string;
    title: string;
    status?: string;
  } | null;
};

type ChargesMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  orderBy?: string;
  direction?: string;
};

type ChargeStats = {
  totalCharges: number;
  totalPaid: number;
  totalPaidAmount: number;
  totalPending: number;
  totalPendingAmount: number;
  totalOverdue: number;
  totalOverdueAmount: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatCurrencyFromCents(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
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

function normalizeChargesPayload(payload: any): Charge[] {
  if (Array.isArray(payload?.data?.items)) return payload.data.items as Charge[];
  if (Array.isArray(payload?.data)) return payload.data as Charge[];
  if (Array.isArray(payload?.items)) return payload.items as Charge[];
  if (Array.isArray(payload)) return payload as Charge[];
  return [];
}

function getStatusColor(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "OVERDUE":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "CANCELED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "PAID":
      return "Pago";
    case "PENDING":
      return "Pendente";
    case "OVERDUE":
      return "Vencido";
    case "CANCELED":
      return "Cancelado";
    default:
      return status;
  }
}

function getStatusFilterLabel(status: ChargeStatusFilter) {
  switch (status) {
    case "ALL":
      return "Todos";
    case "PAID":
      return "Pago";
    case "PENDING":
      return "Pendente";
    case "OVERDUE":
      return "Vencido";
    case "CANCELED":
      return "Cancelado";
    default:
      return status;
  }
}

function getChargeStage(charge: Charge) {
  switch (charge.status) {
    case "PAID":
      return {
        label: "Fluxo encerrado",
        description: "Pagamento confirmado e ciclo financeiro concluído.",
        className:
          "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
        icon: BadgeDollarSign,
      };
    case "OVERDUE":
      return {
        label: "Cobrança em atraso",
        description: "Existe cobrança emitida, mas o vencimento já passou.",
        className:
          "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
        icon: AlertCircle,
      };
    case "PENDING":
      return {
        label: "Aguardando pagamento",
        description: "Cobrança ativa aguardando liquidação.",
        className:
          "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
        icon: Wallet,
      };
    case "CANCELED":
    default:
      return {
        label: "Cobrança cancelada",
        description: "Cobrança encerrada sem seguir para pagamento.",
        className:
          "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
        icon: Receipt,
      };
  }
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </CardContent>
    </Card>
  );
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

export default function FinancesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadFinance = isAuthenticated && !isInitializing;

  const utils = trpc.useUtils();
  const [location, navigate] = useLocation();

  const searchParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString);
  }, [location]);

  const serviceOrderIdFromUrl = searchParams.get("serviceOrderId")?.trim() || "";
  const isServiceOrderScoped = Boolean(serviceOrderIdFromUrl);

  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editChargeId, setEditChargeId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChargeStatusFilter>("ALL");

  const limit = 20;

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page,
      limit,
      q: query || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      serviceOrderId: serviceOrderIdFromUrl || undefined,
    },
    {
      enabled: canLoadFinance,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const statsQuery = trpc.finance.charges.stats.useQuery(
    {},
    {
      enabled: canLoadFinance && !isServiceOrderScoped,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, serviceOrderIdFromUrl]);

  const refreshQueriesOnly = async () => {
    await Promise.all([
      chargesQuery.refetch(),
      ...(isServiceOrderScoped ? [] : [statsQuery.refetch()]),
    ]);
  };

  const refreshAll = async () => {
    if (!canLoadFinance) return;

    await Promise.all([
      chargesQuery.refetch(),
      utils.finance.charges.list.invalidate(),
      utils.finance.charges.stats.invalidate(),
      ...(isServiceOrderScoped ? [] : [statsQuery.refetch()]),
    ]);
  };

  const {
    registerPayment,
    generateCheckout,
    isSubmitting: isChargeActionSubmitting,
  } = useChargeActions({
    location,
    navigate,
    returnPath: "/finances",
    refreshActions: [refreshQueriesOnly],
  });

  const deleteCharge = trpc.finance.charges.delete.useMutation({
    onSuccess: async () => {
      toast.success("Cobrança excluída com sucesso");
      await Promise.all([
        chargesQuery.refetch(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
        ...(isServiceOrderScoped ? [] : [statsQuery.refetch()]),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir cobrança");
    },
  });

  const handleApplyFilters = () => {
    setPage(1);
    setQuery(searchInput.trim());
  };

  const handleClearFilters = () => {
    setPage(1);
    setSearchInput("");
    setQuery("");
    setStatusFilter("ALL");
  };

  const handleClearServiceOrderFilter = () => {
    navigate("/finances");
  };

  const handleBackToServiceOrders = () => {
    navigate("/service-orders");
  };

  const handleChangeStatusFilter = (value: ChargeStatusFilter) => {
    setPage(1);
    setStatusFilter(value);
  };

  const handleDeleteCharge = async (charge: Charge) => {
    const confirmed = window.confirm(
      `Excluir a cobrança de ${charge?.customer?.name || "cliente"}?`
    );

    if (!confirmed) return;

    await deleteCharge.mutateAsync({
      id: String(charge.id),
    });
  };

  const isSubmitting = deleteCharge.isPending || isChargeActionSubmitting;

  const statsPayload = statsQuery.data as any;
  const stats = (statsPayload?.data ?? statsPayload ?? null) as ChargeStats | null;

  const chargesPayload = chargesQuery.data as any;
  const charges = normalizeChargesPayload(chargesPayload);

  const pagination = (
    chargesPayload?.pagination ??
    chargesPayload?.meta ?? {
      page: 1,
      limit: 20,
      total: 0,
      pages: 1,
    }
  ) as ChargesMeta;

  const paidCount = charges.filter((charge) => charge.status === "PAID").length;

  const pendingCount = charges.filter((charge) => charge.status === "PENDING").length;
  const overdueCount = charges.filter((charge) => charge.status === "OVERDUE").length;
  const pendingAmountOnPage = charges
    .filter((charge) => charge.status === "PENDING" || charge.status === "OVERDUE")
    .reduce((acc, charge) => acc + Number(charge.amountCents || 0), 0);

  const hasActiveFilters =
    Boolean(query) ||
    statusFilter !== "ALL" ||
    Boolean(serviceOrderIdFromUrl);

  const hasError =
    chargesQuery.isError || (!isServiceOrderScoped && statsQuery.isError);

  const errorMessage =
    getErrorMessage(chargesQuery.error, "") ||
    (!isServiceOrderScoped ? getErrorMessage(statsQuery.error, "") : "") ||
    "Não foi possível carregar o financeiro agora.";

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="pt-6 text-sm text-gray-500">
            Faça login para visualizar o financeiro.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (chargesQuery.isLoading || (!isServiceOrderScoped && statsQuery.isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40">
          <CardContent className="pt-6 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <CreateChargeModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          void refreshAll();
        }}
      />

      <EditChargeModal
        isOpen={!!editChargeId}
        chargeId={editChargeId}
        onClose={() => setEditChargeId(null)}
        onSuccess={() => {
          void refreshAll();
        }}
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Wallet className="h-7 w-7 text-orange-500" />
              {isServiceOrderScoped ? "Cobrança da O.S." : "Financeiro"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isServiceOrderScoped
                ? "Leitura financeira vinculada a uma ordem de serviço específica."
                : "Gestão de cobranças, atrasos, recebimentos e fechamento financeiro."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isServiceOrderScoped ? (
              <Button variant="outline" onClick={handleBackToServiceOrders}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Voltar para ordens de serviço
              </Button>
            ) : null}

            <Button
              variant="outline"
              onClick={() => {
                void refreshAll();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>

            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova cobrança
            </Button>
          </div>
        </div>

        {serviceOrderIdFromUrl ? (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-orange-900 dark:text-orange-300">
                  Exibindo cobranças da O.S. {serviceOrderIdFromUrl.slice(0, 8)}
                </p>
                <p className="text-xs text-orange-800 dark:text-orange-400">
                  A lista foi filtrada a partir da ordem de serviço.
                </p>
              </div>

              <Button variant="outline" onClick={handleClearServiceOrderFilter}>
                <X className="mr-2 h-4 w-4" />
                Limpar filtro da O.S.
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!isServiceOrderScoped && stats && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total de cobranças"
              value={stats.totalCharges}
              subtitle="Base financeira registrada"
              icon={Receipt}
            />

            <MetricCard
              title="Recebido"
              value={formatMoney(Number(stats.totalPaidAmount || 0))}
              subtitle={`${stats.totalPaid} cobranças pagas`}
              icon={BadgeDollarSign}
            />

            <MetricCard
              title="Em aberto"
              value={formatMoney(Number(stats.totalPendingAmount || 0))}
              subtitle={`${stats.totalPending} cobranças pendentes`}
              icon={Wallet}
            />

            <MetricCard
              title="Em atraso"
              value={formatMoney(Number(stats.totalOverdueAmount || 0))}
              subtitle={`${stats.totalOverdue} cobranças vencidas`}
              icon={AlertCircle}
            />
          </div>
        )}

        {!isServiceOrderScoped && stats && stats.totalOverdue > 0 && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-red-900 dark:text-red-400">
                  {stats.totalOverdue} cobranças vencidas exigem ação
                </CardTitle>
              </div>
              <CardDescription className="text-red-800 dark:text-red-300">
                Total em atraso: {formatMoney(Number(stats.totalOverdueAmount || 0))}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-orange-500" />
                  Cobranças
                </CardTitle>
                <CardDescription>
                  Página {pagination.page} de {pagination.pages}
                </CardDescription>
              </div>

              <div className="text-sm text-gray-500">
                Exibidas: {charges.length} • Pagas: {paidCount} • Pendentes: {pendingCount} • Vencidas: {overdueCount}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplyFilters();
                    }
                  }}
                  placeholder="Buscar por cliente, telefone ou O.S."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  handleChangeStatusFilter(e.target.value as ChargeStatusFilter)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="ALL">Todos os status</option>
                <option value="PENDING">Pendentes</option>
                <option value="PAID">Pagas</option>
                <option value="OVERDUE">Vencidas</option>
                <option value="CANCELED">Canceladas</option>
              </select>

              <Button onClick={handleApplyFilters}>Buscar</Button>

              <Button
                variant="outline"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters && !searchInput}
              >
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                {serviceOrderIdFromUrl && (
                  <span className="rounded-full border px-3 py-1">
                    O.S.: {serviceOrderIdFromUrl.slice(0, 8)}
                  </span>
                )}
                {query && (
                  <span className="rounded-full border px-3 py-1">
                    Busca: {query}
                  </span>
                )}
                {statusFilter !== "ALL" && (
                  <span className="rounded-full border px-3 py-1">
                    Status: {getStatusFilterLabel(statusFilter)}
                  </span>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Valor pendente na página
                </p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrencyFromCents(pendingAmountOnPage)}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Recebimentos nesta página
                </p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {paidCount}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Estado predominante
                </p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {overdueCount > 0
                    ? "Atrasos visíveis"
                    : pendingCount > 0
                      ? "Em cobrança"
                      : paidCount > 0
                        ? "Recebimentos fechando"
                        : "Sem leitura relevante"}
                </p>
              </div>
            </div>

            {charges.length > 0 ? (
              <div className="space-y-4">
                {charges.map((charge) => {
                  const stage = getChargeStage(charge);
                  const StageIcon = stage.icon;

                  return (
                    <div
                      key={charge.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                                {charge.notes?.trim() ||
                                  charge.serviceOrder?.title ||
                                  `Cobrança #${charge.id.slice(0, 8)}`}
                              </h3>

                              <Badge className={getStatusColor(charge.status)}>
                                {getStatusLabel(charge.status)}
                              </Badge>
                            </div>

                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              Cliente: {charge.customer?.name || "N/A"}
                            </p>

                            {charge.serviceOrder?.title ? (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                O.S. vinculada: {charge.serviceOrder.title}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Cobrança manual sem O.S. vinculada
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(charge.status === "PENDING" || charge.status === "OVERDUE") && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => void generateCheckout(charge)}
                                  disabled={isSubmitting}
                                  variant="outline"
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  Gerar checkout
                                </Button>

                                <Button
                                  size="sm"
                                  onClick={() => void registerPayment(charge, "PIX")}
                                  disabled={isSubmitting}
                                  className="bg-green-600 text-white hover:bg-green-700"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Registrar pagamento
                                </Button>
                              </>
                            )}

                            {charge.status !== "PAID" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditChargeId(String(charge.id))}
                                disabled={isSubmitting}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </Button>
                            )}

                            {charge.status !== "PAID" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleDeleteCharge(charge)}
                                disabled={isSubmitting}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className={`rounded-lg border p-3 ${stage.className}`}>
                          <div className="flex items-start gap-2">
                            <StageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">{stage.label}</p>
                              <p className="mt-1 text-xs opacity-90">
                                {stage.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <InfoItem
                            label="Valor"
                            value={formatCurrencyFromCents(charge.amountCents)}
                          />
                          <InfoItem
                            label="Vencimento"
                            value={formatDate(charge.dueDate)}
                          />
                          <InfoItem
                            label="Criada em"
                            value={formatDate(charge.createdAt)}
                          />
                          <InfoItem
                            label="Pagamento"
                            value={formatDate(charge.paidAt)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <Button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    variant="outline"
                  >
                    Anterior
                  </Button>

                  <span className="text-sm text-gray-600">
                    Página {pagination.page} de {pagination.pages}
                  </span>

                  <Button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.pages}
                    variant="outline"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                Nenhuma cobrança encontrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
