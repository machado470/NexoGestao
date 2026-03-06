import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({ description: "", category: "", amount: "", status: "PENDING" });
  const limit = 20;

  const listQuery = trpc.nexo.expenses.list.useQuery({ page, limit });
  const createMutation = trpc.nexo.expenses.create.useMutation({ onSuccess: () => { toast.success("Despesa criada"); listQuery.refetch(); setOpenCreate(false); } });
  const updateMutation = trpc.nexo.expenses.update.useMutation({ onSuccess: () => { toast.success("Despesa atualizada"); listQuery.refetch(); } });
  const deleteMutation = trpc.nexo.expenses.delete.useMutation({ onSuccess: () => { toast.success("Despesa removida"); listQuery.refetch(); } });

  const payload: any = listQuery.data?.data ?? listQuery.data ?? { data: [] };
  const expenses: any[] = payload.data ?? [];
  const pages = payload.pagination?.pages ?? 1;

  const onCreate = async () => {
    if (!draft.description.trim()) return toast.error("Descrição obrigatória");
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) return toast.error("Valor deve ser maior que zero");

    await createMutation.mutateAsync({
      description: draft.description.trim(),
      category: draft.category || undefined,
      amount,
      status: draft.status,
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Despesas</h1>
        <button className="rounded border px-3 py-2" onClick={() => setOpenCreate((v) => !v)}>Nova despesa</button>
      </div>

      {openCreate && (
        <div className="rounded border p-3 space-y-2">
          <input className="w-full rounded border p-2" placeholder="Descrição" value={draft.description} onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))} />
          <input className="w-full rounded border p-2" placeholder="Categoria" value={draft.category} onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))} />
          <input className="w-full rounded border p-2" placeholder="Valor" type="number" min="0.01" step="0.01" value={draft.amount} onChange={(e) => setDraft((s) => ({ ...s, amount: e.target.value }))} />
          <button className="rounded bg-black px-3 py-2 text-white" onClick={onCreate} disabled={createMutation.isPending}>Salvar</button>
        </div>
      )}

      <div className="rounded border p-4">
        {expenses.map((e: any) => (
          <div key={e.id} className="mb-2 flex items-center justify-between rounded border p-2">
            <div>
              <div className="font-medium">{e.description}</div>
              <div className="text-xs opacity-70">{e.category || "-"}</div>
            </div>
            <div className="flex items-center gap-2">
              <div>R$ {Number(e.amount ?? ((e.amountCents ?? 0) / 100)).toFixed(2)}</div>
              <select value={e.status || "PENDING"} onChange={(ev) => updateMutation.mutate({ id: String(e.id), data: { status: ev.target.value } })} className="rounded border p-1 text-xs">
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
                <option value="CANCELED">CANCELED</option>
              </select>
              <button className="rounded border px-2 py-1 text-xs text-red-600" onClick={() => deleteMutation.mutate({ id: String(e.id) })}>Excluir</button>
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
