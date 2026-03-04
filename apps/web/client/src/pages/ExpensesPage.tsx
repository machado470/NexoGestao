import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import CreateExpenseModal from "@/components/CreateExpenseModal";

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  // A tua router expenses.list atual parece aceitar só {page,limit}. Então sem status por enquanto.
  const listQuery = trpc.expenses.list.useQuery({ page, limit });
  const summaryQuery = trpc.expenses.summary.useQuery();

  const expenses = (listQuery.data as any)?.data ?? listQuery.data ?? [];
  const pages = (listQuery.data as any)?.pagination?.pages ?? 1;

  const totalExpenses = (summaryQuery.data as any)?.totalExpenses ?? 0;
  const count = (summaryQuery.data as any)?.count ?? 0;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Despesas</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Total</div>
          <div className="text-lg font-semibold">R$ {(totalExpenses / 100).toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Qtd</div>
          <div className="text-lg font-semibold">{count}</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        {listQuery.isLoading ? (
          <div>Carregando...</div>
        ) : (
          <div className="space-y-2">
            {Array.isArray(expenses) && expenses.length === 0 ? <div>Nenhuma despesa.</div> : null}
            {Array.isArray(expenses)
              ? expenses.map((e: any) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-xl border p-3 dark:border-zinc-800"
                  >
                    <div>
                      <div className="font-medium">{e.description}</div>
                      <div className="text-sm opacity-70">{e.category}</div>
                    </div>
                    <div className="text-right font-semibold">
                      R$ {((e.amount ?? 0) / 100).toFixed(2)}
                    </div>
                  </div>
                ))
              : null}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            className="rounded-lg border px-3 py-2 disabled:opacity-50 dark:border-zinc-800"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <div className="text-sm opacity-70">
            Página {page} de {pages}
          </div>
          <button
            className="rounded-lg border px-3 py-2 disabled:opacity-50 dark:border-zinc-800"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>

      {/* placeholder */}
      <CreateExpenseModal open={false} onClose={() => {}} />
    </div>
  );
}
