import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import CreateLaunchModal from "@/components/CreateLaunchModal";

type UiType = "income" | "expense" | "transfer" | "";
type ApiType = "INCOME" | "EXPENSE" | "TRANSFER";

type LaunchItem = {
  id: string;
  description: string;
  amountCents: number;
  type: ApiType;
  category: string | null;
  account: string | null;
  notes: string | null;
  date: string;
};

type LaunchListResponse = {
  data: LaunchItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type LaunchSummaryResponse = {
  income: number;
  expense: number;
  transfer: number;
  balance: number;
};

function mapLaunchType(t: UiType): ApiType | undefined {
  if (!t) return undefined;
  if (t === "income") return "INCOME";
  if (t === "expense") return "EXPENSE";
  if (t === "transfer") return "TRANSFER";
  return undefined;
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function normalizeListPayload(payload: unknown): LaunchListResponse {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 1 },
    };
  }

  const candidate = raw as Partial<LaunchListResponse>;
  const rawItems = Array.isArray(candidate.data) ? candidate.data : [];

  const data: LaunchItem[] = rawItems.map((item) => {
    const launch = (item ?? {}) as Partial<LaunchItem>;

    return {
      id: typeof launch.id === "string" ? launch.id : "",
      description:
        typeof launch.description === "string" && launch.description.trim()
          ? launch.description
          : "Sem descrição",
      amountCents:
        typeof launch.amountCents === "number" && Number.isFinite(launch.amountCents)
          ? launch.amountCents
          : 0,
      type:
        launch.type === "INCOME" ||
        launch.type === "EXPENSE" ||
        launch.type === "TRANSFER"
          ? launch.type
          : "INCOME",
      category: typeof launch.category === "string" ? launch.category : null,
      account: typeof launch.account === "string" ? launch.account : null,
      notes: typeof launch.notes === "string" ? launch.notes : null,
      date: typeof launch.date === "string" ? launch.date : "",
    };
  });

  const pagination = candidate.pagination as
    | LaunchListResponse["pagination"]
    | undefined;

  return {
    data,
    pagination: {
      page:
        typeof pagination?.page === "number" && Number.isFinite(pagination.page)
          ? pagination.page
          : 1,
      limit:
        typeof pagination?.limit === "number" && Number.isFinite(pagination.limit)
          ? pagination.limit
          : 20,
      total:
        typeof pagination?.total === "number" && Number.isFinite(pagination.total)
          ? pagination.total
          : data.length,
      pages:
        typeof pagination?.pages === "number" && Number.isFinite(pagination.pages)
          ? Math.max(1, pagination.pages)
          : 1,
    },
  };
}

function normalizeSummaryPayload(payload: unknown): LaunchSummaryResponse {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return {
      income: 0,
      expense: 0,
      transfer: 0,
      balance: 0,
    };
  }

  const candidate = raw as Partial<LaunchSummaryResponse>;

  return {
    income:
      typeof candidate.income === "number" && Number.isFinite(candidate.income)
        ? candidate.income
        : 0,
    expense:
      typeof candidate.expense === "number" && Number.isFinite(candidate.expense)
        ? candidate.expense
        : 0,
    transfer:
      typeof candidate.transfer === "number" && Number.isFinite(candidate.transfer)
        ? candidate.transfer
        : 0,
    balance:
      typeof candidate.balance === "number" && Number.isFinite(candidate.balance)
        ? candidate.balance
        : 0,
  };
}

function getTypeLabel(type: ApiType) {
  switch (type) {
    case "INCOME":
      return "Entrada";
    case "EXPENSE":
      return "Saída";
    case "TRANSFER":
      return "Transferência";
    default:
      return type;
  }
}

function getTypeBadgeClass(type: ApiType) {
  switch (type) {
    case "INCOME":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "EXPENSE":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "TRANSFER":
      return "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function getBalanceClass(balance: number) {
  if (balance > 0) {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (balance < 0) {
    return "text-red-600 dark:text-red-400";
  }

  return "text-zinc-900 dark:text-white";
}

export default function LaunchesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const utils = trpc.useUtils();

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const limit = 20;

  const [filterType, setFilterType] = useState<UiType>("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const apiType = useMemo(() => mapLaunchType(filterType), [filterType]);

  const listQuery = trpc.launches.list.useQuery(
    {
      page,
      limit,
      type: apiType,
      from: from || undefined,
      to: to || undefined,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const summaryQuery = trpc.launches.summary.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const listData = useMemo(() => normalizeListPayload(listQuery.data), [listQuery.data]);
  const summaryData = useMemo(
    () => normalizeSummaryPayload(summaryQuery.data),
    [summaryQuery.data]
  );

  const items = listData.data;
  const pages = listData.pagination.pages;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return items.filter((launch) => {
      if (!q) return true;

      return (
        launch.description.toLowerCase().includes(q) ||
        String(launch.category ?? "").toLowerCase().includes(q) ||
        String(launch.account ?? "").toLowerCase().includes(q) ||
        String(launch.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  const hasFilters = Boolean(filterType) || Boolean(searchQuery) || Boolean(from) || Boolean(to);

  const handleRefresh = async () => {
    await Promise.all([listQuery.refetch(), summaryQuery.refetch()]);
  };

  const handleSaved = async () => {
    setCreateOpen(false);
    setPage(1);
    await Promise.all([
      utils.launches.list.invalidate(),
      utils.launches.summary.invalidate(),
    ]);
  };

  const handleApplySearch = () => {
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleClearFilters = () => {
    setPage(1);
    setFilterType("");
    setSearchInput("");
    setSearchQuery("");
    setFrom("");
    setTo("");
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
        <div className="rounded-2xl border p-4 text-sm opacity-70 dark:border-zinc-800">
          Faça login para visualizar lançamentos.
        </div>
      </div>
    );
  }

  return (
    <>
      <CreateLaunchModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void handleSaved()}
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Lançamentos</h1>
            <p className="mt-1 text-sm opacity-70">
              Controle manual de entradas, saídas e transferências da operação.
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
              Novo lançamento
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <ArrowUpCircle className="h-4 w-4" />
              Entradas
            </div>
            <div className="mt-2 text-xl font-semibold">
              {formatCurrencyFromCents(summaryData.income)}
            </div>
          </div>

          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <ArrowDownCircle className="h-4 w-4" />
              Saídas
            </div>
            <div className="mt-2 text-xl font-semibold">
              {formatCurrencyFromCents(summaryData.expense)}
            </div>
          </div>

          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <RefreshCw className="h-4 w-4" />
              Transferências
            </div>
            <div className="mt-2 text-xl font-semibold">
              {formatCurrencyFromCents(summaryData.transfer)}
            </div>
          </div>

          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <Wallet className="h-4 w-4" />
              Saldo
            </div>
            <div className={`mt-2 text-xl font-semibold ${getBalanceClass(summaryData.balance)}`}>
              {formatCurrencyFromCents(summaryData.balance)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_220px_180px_180px]">
            <div className="relative xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplySearch();
                }}
                className="w-full rounded-lg border p-2 pl-9 dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Buscar por descrição, categoria, conta ou observações"
              />
            </div>

            <select
              className="w-full rounded-lg border p-2 dark:border-zinc-800 dark:bg-zinc-950"
              value={filterType}
              onChange={(e) => {
                setPage(1);
                setFilterType(e.target.value as UiType);
              }}
            >
              <option value="">Todos os tipos</option>
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
              <option value="transfer">Transferência</option>
            </select>

            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="w-full rounded-lg border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            />

            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="w-full rounded-lg border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleApplySearch}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Buscar
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              disabled={!hasFilters && !searchInput}
            >
              Limpar
            </button>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-70">
              {searchQuery ? (
                <span className="rounded-full border px-3 py-1">
                  Busca: {searchQuery}
                </span>
              ) : null}
              {filterType ? (
                <span className="rounded-full border px-3 py-1">
                  Tipo: {filterType === "income" ? "Entrada" : filterType === "expense" ? "Saída" : "Transferência"}
                </span>
              ) : null}
              {from ? (
                <span className="rounded-full border px-3 py-1">
                  De: {formatDate(from)}
                </span>
              ) : null}
              {to ? (
                <span className="rounded-full border px-3 py-1">
                  Até: {formatDate(to)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : listQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Erro ao carregar lançamentos
              </div>
              <p className="mt-2 text-sm">
                Não foi possível carregar os lançamentos agora.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Calendar className="h-10 w-10 opacity-40" />
              <div>
                <div className="font-medium">
                  {items.length === 0
                    ? "Nenhum lançamento cadastrado"
                    : "Nenhum lançamento encontrado"}
                </div>
                <p className="mt-1 text-sm opacity-70">
                  {items.length === 0
                    ? "Cadastre o primeiro lançamento manual para começar o controle."
                    : "Ajuste os filtros para encontrar os lançamentos desejados."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
              >
                <Plus className="h-4 w-4" />
                Novo lançamento
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((launch) => (
                <div
                  key={launch.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{launch.description}</div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeBadgeClass(
                          launch.type
                        )}`}
                      >
                        {getTypeLabel(launch.type)}
                      </span>
                    </div>

                    <div className="grid gap-1 text-sm opacity-80">
                      <div>Categoria: {launch.category || "Não informada"}</div>
                      <div>Conta: {launch.account || "Não informada"}</div>
                      <div>Data: {formatDate(launch.date)}</div>
                      {launch.notes ? <div>Observações: {launch.notes}</div> : null}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-lg font-semibold ${
                        launch.type === "INCOME"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : launch.type === "EXPENSE"
                            ? "text-red-600 dark:text-red-400"
                            : "text-orange-600 dark:text-orange-300"
                      }`}
                    >
                      {launch.type === "EXPENSE" ? "-" : ""}
                      {formatCurrencyFromCents(launch.amountCents)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg border px-3 py-2 disabled:opacity-50 dark:border-zinc-800"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>

            <div className="text-sm opacity-70">
              Página {page} de {pages}
            </div>

            <button
              type="button"
              className="rounded-lg border px-3 py-2 disabled:opacity-50 dark:border-zinc-800"
              disabled={page >= pages}
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
