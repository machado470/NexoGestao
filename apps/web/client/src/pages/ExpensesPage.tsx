import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const CATEGORY_OPTIONS = [
  "OPERATIONAL",
  "MARKETING",
  "INFRASTRUCTURE",
  "PAYROLL",
  "TAXES",
  "SUPPLIES",
  "TRAVEL",
  "OTHER",
] as const;

function formatCurrencyFromCents(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value ?? 0) / 100);
}

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({
    description: "",
    category: "OTHER",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const limit = 20;

  const listQuery = trpc.expenses.list.useQuery({ page, limit });
  const summaryQuery = trpc.expenses.summary.useQuery();

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Despesa criada");
      void listQuery.refetch();
      void summaryQuery.refetch();
      setOpenCreate(false);
      setDraft({
        description: "",
        category: "OTHER",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    },
    onError: (err) => toast.error(err.message || "Erro ao criar despesa"),
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Despesa removida");
      void listQuery.refetch();
      void summaryQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Erro ao remover despesa"),
  });

  const payload: any = listQuery.data ?? { data: [], pagination: { pages: 1 } };
  const expenses: any[] = Array.isArray(payload?.data) ? payload.data : [];
  const pages = Number(payload?.pagination?.pages ?? 1);

  const summary = (summaryQuery.data as any) ?? {};
  const totalExpensesCents = Number(summary?.totalExpenses ?? 0);
  const totalCount = Number(summary?.count ?? 0);

  const categorySummary = useMemo(() => {
    return Object.entries(summary?.byCategory ?? {}) as Array<[string, number]>;
  }, [summary]);

  const onCreate = async () => {
    if (!draft.description.trim()) {
      return toast.error("Descrição obrigatória");
    }

    const amount = Number(draft.amount);
    if (!amount || amount <= 0) {
      return toast.error("Valor deve ser maior que zero");
    }

    if (!draft.date) {
      return toast.error("Data obrigatória");
    }

    await createMutation.mutateAsync({
      description: draft.description.trim(),
      category: draft.category as any,
      amount,
      date: new Date(`${draft.date}T12:00:00`),
      notes: draft.notes.trim() || undefined,
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Despesas</h1>
        <button
          className="rounded border px-3 py-2"
          onClick={() => setOpenCreate((v) => !v)}
        >
          Nova despesa
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm opacity-70">Total de despesas</div>
          <div className="text-lg font-semibold">
            {formatCurrencyFromCents(totalExpensesCents)}
          </div>
        </div>

        <div className="rounded border p-4">
          <div className="text-sm opacity-70">Quantidade</div>
          <div className="text-lg font-semibold">{totalCount}</div>
        </div>

        <div className="rounded border p-4">
          <div className="text-sm opacity-70">Categorias</div>
          <div className="text-lg font-semibold">{categorySummary.length}</div>
        </div>
      </div>

      {categorySummary.length > 0 && (
        <div className="rounded border p-4">
          <div className="mb-2 font-medium">Resumo por categoria</div>
          <div className="space-y-2">
            {categorySummary.map(([category, value]) => (
              <div
                key={category}
                className="flex items-center justify-between text-sm"
              >
                <span>{category}</span>
                <span className="font-medium">
                  {formatCurrencyFromCents(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {openCreate && (
        <div className="rounded border p-3 space-y-2">
          <input
            className="w-full rounded border p-2"
            placeholder="Descrição"
            value={draft.description}
            onChange={(e) =>
              setDraft((s) => ({ ...s, description: e.target.value }))
            }
          />

          <select
            className="w-full rounded border p-2"
            value={draft.category}
            onChange={(e) =>
              setDraft((s) => ({ ...s, category: e.target.value }))
            }
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <input
            className="w-full rounded border p-2"
            placeholder="Valor"
            type="number"
            min="0.01"
            step="0.01"
            value={draft.amount}
            onChange={(e) =>
              setDraft((s) => ({ ...s, amount: e.target.value }))
            }
          />

          <input
            className="w-full rounded border p-2"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((s) => ({ ...s, date: e.target.value }))}
          />

          <textarea
            className="w-full rounded border p-2"
            placeholder="Observações"
            value={draft.notes}
            onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
          />

          <button
            className="rounded bg-black px-3 py-2 text-white"
            onClick={() => void onCreate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      <div className="rounded border p-4">
        {listQuery.isLoading ? (
          <div>Carregando...</div>
        ) : expenses.length === 0 ? (
          <div>Nenhuma despesa.</div>
        ) : (
          expenses.map((expense: any) => (
            <div
              key={expense.id}
              className="mb-2 flex items-center justify-between rounded border p-2"
            >
              <div>
                <div className="font-medium">{expense.description}</div>
                <div className="text-xs opacity-70">
                  {expense.category || "-"} •{" "}
                  {expense.date
                    ? new Date(expense.date).toLocaleDateString("pt-BR")
                    : "-"}
                </div>
                {expense.notes ? (
                  <div className="text-xs opacity-70 mt-1">{expense.notes}</div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <div>{formatCurrencyFromCents(expense.amountCents)}</div>
                <button
                  className="rounded border px-2 py-1 text-xs text-red-600"
                  onClick={() => deleteMutation.mutate({ id: String(expense.id) })}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          className="rounded border px-3 py-2"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>

        <span>
          {page} / {pages}
        </span>

        <button
          className="rounded border px-3 py-2"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
