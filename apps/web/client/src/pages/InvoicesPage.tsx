import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({ number: "", amount: "", customerId: "", status: "DRAFT" });

  const listQuery = trpc.nexo.invoices.list.useQuery({ page, limit: 20 });
  const summaryQuery = trpc.nexo.invoices.summary.useQuery();
  const createMutation = trpc.nexo.invoices.create.useMutation({ onSuccess: () => { toast.success("Fatura criada"); listQuery.refetch(); setOpenCreate(false); } });
  const updateMutation = trpc.nexo.invoices.update.useMutation({ onSuccess: () => { toast.success("Fatura atualizada"); listQuery.refetch(); } });
  const deleteMutation = trpc.nexo.invoices.delete.useMutation({ onSuccess: () => { toast.success("Fatura removida"); listQuery.refetch(); } });

  const payload: any = listQuery.data?.data ?? listQuery.data ?? { data: [] };
  const invoices: any[] = payload.data ?? [];
  const pages = payload.pagination?.pages ?? 1;

  const onCreate = async () => {
    if (!draft.number.trim()) return toast.error("Número obrigatório");
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) return toast.error("Valor inválido");

    await createMutation.mutateAsync({
      customerId: draft.customerId || undefined,
      number: draft.number,
      amountCents: Math.round(amount * 100),
      status: draft.status,
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Faturas</h1>
        <button className="rounded border px-3 py-2" onClick={() => setOpenCreate((v) => !v)}>Nova fatura</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border p-3">Total emitido: {(summaryQuery.data as any)?.totalIssued ?? 0}</div>
        <div className="rounded border p-3">Total pago: {(summaryQuery.data as any)?.totalPaid ?? 0}</div>
      </div>

      {openCreate && (
        <div className="rounded border p-3 space-y-2">
          <input className="w-full rounded border p-2" placeholder="Número" value={draft.number} onChange={(e) => setDraft((s) => ({ ...s, number: e.target.value }))} />
          <input className="w-full rounded border p-2" placeholder="Customer ID" value={draft.customerId} onChange={(e) => setDraft((s) => ({ ...s, customerId: e.target.value }))} />
          <input className="w-full rounded border p-2" type="number" min="0.01" step="0.01" placeholder="Valor" value={draft.amount} onChange={(e) => setDraft((s) => ({ ...s, amount: e.target.value }))} />
          <button className="rounded bg-black px-3 py-2 text-white" onClick={onCreate} disabled={createMutation.isPending}>Salvar</button>
        </div>
      )}

      <div className="rounded border p-3 space-y-2">
        {invoices.map((inv: any) => (
          <div key={inv.id} className="flex items-center justify-between rounded border p-2">
            <div>
              <div className="font-medium">{inv.number}</div>
              <div className="text-xs opacity-70">{inv.status}</div>
            </div>
            <div className="flex items-center gap-2">
              <span>R$ {Number((inv.amountCents ?? inv.amount ?? 0) / 100).toFixed(2)}</span>
              <select value={inv.status} onChange={(e) => updateMutation.mutate({ id: String(inv.id), data: { status: e.target.value } })} className="rounded border p-1 text-xs">
                <option value="DRAFT">DRAFT</option>
                <option value="ISSUED">ISSUED</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <button className="rounded border px-2 py-1 text-xs text-red-600" onClick={() => deleteMutation.mutate({ id: String(inv.id) })}>Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button className="rounded border px-3 py-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
        <span>{page} / {pages}</span>
        <button className="rounded border px-3 py-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</button>
      </div>
    </div>
  );
}
