import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type UiType = "income" | "expense" | "transfer" | "";
type ApiType = "INCOME" | "EXPENSE" | "TRANSFER";

function mapLaunchType(t: UiType): ApiType | undefined {
  if (!t) return undefined;
  if (t === "income") return "INCOME";
  if (t === "expense") return "EXPENSE";
  if (t === "transfer") return "TRANSFER";
  return undefined;
}

export default function LaunchesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const [filterType, setFilterType] = useState<UiType>("");
  const apiType = useMemo(() => mapLaunchType(filterType), [filterType]);

  const listQuery = trpc.launches.list.useQuery({ page, limit, type: apiType });
  const summaryQuery = trpc.launches.summary.useQuery();

  const items = listQuery.data?.data ?? [];
  const pages = listQuery.data?.pagination.pages ?? 1;

  const income = (summaryQuery.data as any)?.income ?? 0;
  const expense = (summaryQuery.data as any)?.expense ?? 0;
  const balance = (summaryQuery.data as any)?.balance ?? 0;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lançamentos</h1>

        <select
          className="rounded-lg border p-2 dark:bg-zinc-950"
          value={filterType}
          onChange={(e) => {
            setPage(1);
            setFilterType(e.target.value as UiType);
          }}
        >
          <option value="">Todos</option>
          <option value="income">Entrada</option>
          <option value="expense">Saída</option>
          <option value="transfer">Transferência</option>
        </select>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Entradas</div>
          <div className="text-lg font-semibold">R$ {(income / 100).toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Saídas</div>
          <div className="text-lg font-semibold">R$ {(expense / 100).toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Saldo</div>
          <div className="text-lg font-semibold">R$ {(balance / 100).toFixed(2)}</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        {listQuery.isLoading ? (
          <div>Carregando...</div>
        ) : (
          <div className="space-y-2">
            {items.length === 0 ? <div>Nenhum lançamento.</div> : null}
            {items.map((l: any) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl border p-3 dark:border-zinc-800"
              >
                <div>
                  <div className="font-medium">{l.description}</div>
                  <div className="text-sm opacity-70">{l.type}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">R$ {((l.amount ?? 0) / 100).toFixed(2)}</div>
                </div>
              </div>
            ))}
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
    </div>
  );
}
