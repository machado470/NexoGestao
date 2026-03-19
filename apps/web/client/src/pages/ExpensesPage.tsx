import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import CreateExpenseModal from "@/components/CreateExpenseModal";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react";

type ExpenseCategory =
  | "OPERATIONAL"
  | "MARKETING"
  | "INFRASTRUCTURE"
  | "PAYROLL"
  | "TAXES"
  | "SUPPLIES"
  | "TRAVEL"
  | "OTHER";

type ExpenseItem = {
  id: string;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  date: string | null;
  notes: string | null;
};

type ExpenseListResponse = {
  data: ExpenseItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type ExpenseSummary = {
  totalExpenses: number;
  count: number;
  byCategory: Record<string, number>;
};

const CATEGORY_OPTIONS: Array<{ value: ExpenseCategory; label: string }> = [
  { value: "OPERATIONAL", label: "Operacional" },
  { value: "MARKETING", label: "Marketing" },
  { value: "INFRASTRUCTURE", label: "Infraestrutura" },
  { value: "PAYROLL", label: "Folha" },
  { value: "TAXES", label: "Impostos" },
  { value: "SUPPLIES", label: "Suprimentos" },
  { value: "TRAVEL", label: "Viagem" },
  { value: "OTHER", label: "Outros" },
];

function formatCurrencyFromCents(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value ?? 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function normalizeExpenseCategory(value: unknown): ExpenseCategory {
  switch (value) {
    case "OPERATIONAL":
    case "MARKETING":
    case "INFRASTRUCTURE":
    case "PAYROLL":
    case "TAXES":
    case "SUPPLIES":
    case "TRAVEL":
    case "OTHER":
      return value;
    default:
      return "OTHER";
  }
}

function normalizeListPayload(payload: unknown): ExpenseListResponse {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 1,
      },
    };
  }

  const candidate = raw as Partial<ExpenseListResponse>;
  const rawItems = Array.isArray(candidate.data) ? candidate.data : [];
  const pagination = candidate.pagination;

  const data: ExpenseItem[] = rawItems.map((item) => {
    const expense = (item ?? {}) as Partial<ExpenseItem> & {
      amount?: number;
    };

    return {
      id: typeof expense.id === "string" ? expense.id : "",
      description:
        typeof expense.description === "string" && expense.description.trim()
          ? expense.description
          : "Sem descrição",
      category: normalizeExpenseCategory(expense.category),
      amountCents:
        typeof expense.amountCents === "number" && Number.isFinite(expense.amountCents)
          ? expense.amountCents
          : typeof expense.amount === "number" && Number.isFinite(expense.amount)
            ? Math.round(expense.amount * 100)
            : 0,
      date: typeof expense.date === "string" ? expense.date : null,
      notes: typeof expense.notes === "string" ? expense.notes : null,
    };
  });

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

function normalizeSummaryPayload(payload: unknown): ExpenseSummary {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return {
      totalExpenses: 0,
      count: 0,
      byCategory: {},
    };
  }

  const candidate = raw as Partial<ExpenseSummary>;
  const rawByCategory =
    candidate.byCategory && typeof candidate.byCategory === "object"
      ? candidate.byCategory
      : {};

  const byCategory = Object.fromEntries(
    Object.entries(rawByCategory).map(([key, value]) => [
      key,
      typeof value === "number" && Number.isFinite(value) ? value : 0,
    ])
  );

  return {
    totalExpenses:
      typeof candidate.totalExpenses === "number" &&
      Number.isFinite(candidate.totalExpenses)
        ? candidate.totalExpenses
        : 0,
    count:
      typeof candidate.count === "number" && Number.isFinite(candidate.count)
        ? candidate.count
        : 0,
    byCategory,
  };
}

function getCategoryLabel(category: ExpenseCategory) {
  switch (category) {
    case "OPERATIONAL":
      return "Operacional";
    case "MARKETING":
      return "Marketing";
    case "INFRASTRUCTURE":
      return "Infraestrutura";
    case "PAYROLL":
      return "Folha";
    case "TAXES":
      return "Impostos";
    case "SUPPLIES":
      return "Suprimentos";
    case "TRAVEL":
      return "Viagem";
    case "OTHER":
      return "Outros";
    default:
      return category;
  }
}

function getCategoryBadgeClass(category: ExpenseCategory) {
  switch (category) {
    case "MARKETING":
      return "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300";
    case "OPERATIONAL":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "INFRASTRUCTURE":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
    case "PAYROLL":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300";
    case "TAXES":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "SUPPLIES":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "TRAVEL":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "OTHER":
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export default function ExpensesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const utils = trpc.useUtils();

  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "">("");

  const limit = 20;

  const listQuery = trpc.expenses.list.useQuery(
    { page, limit },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const summaryQuery = trpc.expenses.summary.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: async () => {
      toast.success("Despesa removida com sucesso.");
      setDeletingId(null);
      await Promise.all([
        utils.expenses.list.invalidate(),
        utils.expenses.summary.invalidate(),
      ]);
    },
    onError: (err) => {
      setDeletingId(null);
      toast.error(err.message || "Erro ao remover despesa.");
    },
  });

  const listData = useMemo(() => normalizeListPayload(listQuery.data), [listQuery.data]);
  const summary = useMemo(
    () => normalizeSummaryPayload(summaryQuery.data),
    [summaryQuery.data]
  );

  const expenses = listData.data;
  const pages = listData.pagination.pages;

  const categorySummary = useMemo(() => {
    return Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
  }, [summary.byCategory]);

  const topCategory = useMemo(() => {
    if (!categorySummary.length) return null;
    const [category, value] = categorySummary[0];
    return {
      label: getCategoryLabel(normalizeExpenseCategory(category)),
      value,
    };
  }, [categorySummary]);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesText =
        !q ||
        expense.description.toLowerCase().includes(q) ||
        String(expense.notes ?? "").toLowerCase().includes(q);

      const matchesCategory =
        !categoryFilter || expense.category === categoryFilter;

      return matchesText && matchesCategory;
    });
  }, [expenses, searchQuery, categoryFilter]);

  const handleRefresh = async () => {
    await Promise.all([listQuery.refetch(), summaryQuery.refetch()]);
  };

  const handleCreated = async () => {
    setOpenCreate(false);
    setPage(1);
    await Promise.all([
      utils.expenses.list.invalidate(),
      utils.expenses.summary.invalidate(),
    ]);
  };

  const handleDelete = async (expense: ExpenseItem) => {
    const confirmed = window.confirm(`Excluir a despesa "${expense.description}"?`);
    if (!confirmed) return;

    setDeletingId(expense.id);
    await deleteMutation.mutateAsync({ id: expense.id });
  };

  const handleApplySearch = () => {
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleClearFilters = () => {
    setPage(1);
    setSearchInput("");
    setSearchQuery("");
    setCategoryFilter("");
  };

  const hasLocalFilters = Boolean(searchQuery) || Boolean(categoryFilter);

  if (isInitializing) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-center rounded-xl border p-6 dark:border-zinc-800">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-xl border p-4 text-sm opacity-70 dark:border-zinc-800">
          Faça login para visualizar despesas.
        </div>
      </div>
    );
  }

  return (
    <>
      <CreateExpenseModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => void handleCreated()}
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Despesas</h1>
            <p className="mt-1 text-sm opacity-70">
              Controle das saídas operacionais com visão consolidada e histórico.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              onClick={() => void handleRefresh()}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
              onClick={() => setOpenCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Nova despesa
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4 dark:border-zinc-800">
            <div className="text-sm opacity-70">Total de despesas</div>
            <div className="mt-2 text-lg font-semibold">
              {formatCurrencyFromCents(summary.totalExpenses)}
            </div>
          </div>

          <div className="rounded-xl border p-4 dark:border-zinc-800">
            <div className="text-sm opacity-70">Quantidade</div>
            <div className="mt-2 text-lg font-semibold">{summary.count}</div>
          </div>

          <div className="rounded-xl border p-4 dark:border-zinc-800">
            <div className="text-sm opacity-70">Categorias</div>
            <div className="mt-2 text-lg font-semibold">{categorySummary.length}</div>
          </div>

          <div className="rounded-xl border p-4 dark:border-zinc-800">
            <div className="text-sm opacity-70">Maior categoria</div>
            <div className="mt-2 text-lg font-semibold">
              {topCategory ? topCategory.label : "—"}
            </div>
            <div className="mt-1 text-xs opacity-70">
              {topCategory ? formatCurrencyFromCents(topCategory.value) : "Sem dados"}
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-3 space-y-3 dark:border-zinc-800">
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-50" />
              <input
                className="w-full rounded border p-2 pl-9 dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Buscar por descrição ou observações"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplySearch();
                }}
              />
            </div>

            <select
              className="rounded border p-2 dark:border-zinc-800 dark:bg-zinc-950"
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value as ExpenseCategory | "");
              }}
            >
              <option value="">Todas as categorias</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={handleApplySearch}
            >
              Buscar
            </button>

            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={handleClearFilters}
              disabled={!hasLocalFilters && !searchInput}
            >
              Limpar
            </button>
          </div>

          {hasLocalFilters ? (
            <div className="flex flex-wrap gap-2 text-xs opacity-70">
              {searchQuery ? (
                <span className="rounded-full border px-3 py-1">
                  Busca: {searchQuery}
                </span>
              ) : null}
              {categoryFilter ? (
                <span className="rounded-full border px-3 py-1">
                  Categoria: {getCategoryLabel(categoryFilter)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {categorySummary.length > 0 ? (
          <div className="rounded-xl border p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center gap-2 font-medium">
              <Tag className="h-4 w-4 text-orange-500" />
              Resumo por categoria
            </div>

            <div className="space-y-2">
              {categorySummary.map(([category, value]) => {
                const normalized = normalizeExpenseCategory(category);

                return (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-lg border border-transparent bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryBadgeClass(
                          normalized
                        )}`}
                      >
                        {getCategoryLabel(normalized)}
                      </span>
                    </div>

                    <span className="font-medium">
                      {formatCurrencyFromCents(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border p-4 dark:border-zinc-800">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : listQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Erro ao carregar despesas
              </div>
              <p className="mt-2">
                Não foi possível carregar a lista de despesas agora.
              </p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Receipt className="h-10 w-10 opacity-40" />
              <div>
                <div className="font-medium">
                  {expenses.length === 0
                    ? "Nenhuma despesa cadastrada"
                    : "Nenhuma despesa encontrada"}
                </div>
                <p className="mt-1 text-sm opacity-70">
                  {expenses.length === 0
                    ? "Cadastre a primeira despesa para começar o controle financeiro operacional."
                    : "Ajuste os filtros para encontrar as despesas desejadas."}
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                onClick={() => setOpenCreate(true)}
              >
                <Plus className="h-4 w-4" />
                Nova despesa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{expense.description}</div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryBadgeClass(
                          expense.category
                        )}`}
                      >
                        {getCategoryLabel(expense.category)}
                      </span>
                    </div>

                    <div className="mt-1 text-xs opacity-70">
                      Data: {formatDate(expense.date)}
                    </div>

                    {expense.notes ? (
                      <div className="mt-1 text-xs opacity-70">{expense.notes}</div>
                    ) : (
                      <div className="mt-1 text-xs opacity-50">
                        Sem observações adicionais.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="min-w-[120px] text-sm font-semibold">
                      {formatCurrencyFromCents(expense.amountCents)}
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-zinc-800 dark:text-red-300 dark:hover:bg-red-950/30"
                      onClick={() => void handleDelete(expense)}
                      disabled={
                        deleteMutation.isPending && deletingId === expense.id
                      }
                    >
                      {deleteMutation.isPending && deletingId === expense.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg border px-3 py-2 disabled:opacity-50 dark:border-zinc-800"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>

          <span className="text-sm opacity-70">
            Página {page} de {pages}
          </span>

          <button
            type="button"
            className="rounded-lg border px-3 py-2 disabled:opacity-50 dark:border-zinc-800"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </>
  );
}
