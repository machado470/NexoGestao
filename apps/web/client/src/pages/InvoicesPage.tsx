import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type UiStatus = "draft" | "issued" | "paid" | "canceled" | "";
type ApiStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";

function mapInvoiceStatus(s: UiStatus): ApiStatus | undefined {
  if (!s) return undefined;
  if (s === "draft") return "DRAFT";
  if (s === "issued") return "ISSUED";
  if (s === "paid") return "PAID";
  if (s === "canceled") return "CANCELLED";
  return undefined;
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const [filterStatus, setFilterStatus] = useState<UiStatus>("");
  const apiStatus = useMemo(() => mapInvoiceStatus(filterStatus), [filterStatus]);

  const listQuery = trpc.invoices.list.useQuery({ page, limit, status: apiStatus });
  const summaryQuery = trpc.invoices.summary.useQuery();

  const invoices = listQuery.data?.data ?? [];
  const pages = listQuery.data?.pagination.pages ?? 1;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Faturas</h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border p-2 dark:bg-zinc-950"
            value={filterStatus}
            onChange={(e) => {
              setPage(1);
              setFilterStatus(e.target.value as UiStatus);
            }}
          >
            <option value="">Todas</option>
            <option value="draft">Rascunho</option>
            <option value="issued">Emitida</option>
            <option value="paid">Paga</option>
            <option value="canceled">Cancelada</option>
          </select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Total Emitido</div>
          <div className="text-lg font-semibold">
            R$ {(((summaryQuery.data?.totalIssued ?? 0) as number) / 100).toFixed(2)}
          </div>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Total Pago</div>
          <div className="text-lg font-semibold">
            R$ {(((summaryQuery.data?.totalPaid ?? 0) as number) / 100).toFixed(2)}
          </div>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Pendentes</div>
          <div className="text-lg font-semibold">{(summaryQuery.data as any)?.pending ?? 0}</div>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Qtd</div>
          <div className="text-lg font-semibold">{(summaryQuery.data as any)?.count ?? 0}</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        {listQuery.isLoading ? (
          <div>Carregando...</div>
        ) : (
          <div className="space-y-2">
            {invoices.length === 0 ? <div>Nenhuma fatura.</div> : null}
            {invoices.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-xl border p-3 dark:border-zinc-800"
              >
                <div>
                  <div className="font-medium">{inv.number}</div>
                  <div className="text-sm opacity-70">{inv.status}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">R$ {((inv.amount ?? 0) / 100).toFixed(2)}</div>
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
