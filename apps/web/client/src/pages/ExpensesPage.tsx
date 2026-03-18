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

export default function ExpensesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const utils = trpc.useUtils();

  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    return Object.entries(summary.byCategory);
  }, [summary.byCategory]);

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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        </div>

        {categorySummary.length > 0 ? (
          <div className="rounded-xl border p-4 dark:border-zinc-800">
            <div className="mb-3 font-medium">Resumo por categoria</div>
            <div className="space-y-2">
              {categorySummary.map(([category, value]) => (
                <div
                  key={category}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{getCategoryLabel(normalizeExpenseCategory(category))}</span>
                  <span className="font-medium">
                    {formatCurrencyFromCents(value)}
                  </span>
                </div>
              ))}
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
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Receipt className="h-10 w-10 opacity-40" />
              <div>
                <div className="font-medium">Nenhuma despesa cadastrada</div>
                <p className="mt-1 text-sm opacity-70">
                  Cadastre a primeira despesa para começar o controle financeiro operacional.
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
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-center md:justify-between dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{expense.description}</div>

                    <div className="mt-1 text-xs opacity-70">
                      {getCategoryLabel(expense.category)} • {formatDate(expense.date)}
                    </div>

                    {expense.notes ? (
                      <div className="mt-1 text-xs opacity-70">{expense.notes}</div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="min-w-[120px] text-sm font-medium">
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
            {page} / {pages}
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
