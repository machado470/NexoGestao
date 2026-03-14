import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Rascunho",
  ISSUED: "Emitida",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

function formatCurrencyFromCents(value: number) {
  return (Number(value || 0) / 100).toFixed(2);
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({
    number: "",
    amount: "",
    customerId: "",
    status: "DRAFT" as InvoiceStatus,
    notes: "",
  });

  const utils = trpc.useUtils();

  const listQuery = trpc.invoices.list.useQuery({ page, limit: 20 });
  const summaryQuery = trpc.invoices.summary.useQuery();

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: async () => {
      toast.success("Fatura criada");
      await utils.invoices.list.invalidate();
      await utils.invoices.summary.invalidate();
      setOpenCreate(false);
      setDraft({
        number: "",
        amount: "",
        customerId: "",
        status: "DRAFT",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar fatura");
    },
  });

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: async () => {
      toast.success("Fatura atualizada");
      await utils.invoices.list.invalidate();
      await utils.invoices.summary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar fatura");
    },
  });

  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: async () => {
      toast.success("Fatura removida");
      await utils.invoices.list.invalidate();
      await utils.invoices.summary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover fatura");
    },
  });

  const payload = useMemo(() => {
    const raw: any = listQuery.data ?? { data: [], pagination: { page: 1, pages: 1 } };
    return {
      data: Array.isArray(raw?.data) ? raw.data : [],
      pagination: raw?.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 },
    };
  }, [listQuery.data]);

  const invoices: any[] = payload.data;
  const pages = payload.pagination?.pages ?? 1;

  const onCreate = async () => {
    if (!draft.number.trim()) {
      toast.error("Número obrigatório");
      return;
    }

    const amount = Number(draft.amount);
    if (!amount || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    await createMutation.mutateAsync({
      customerId: draft.customerId.trim() || undefined,
      number: draft.number.trim(),
      amount,
      status: draft.status,
      notes: draft.notes.trim() || undefined,
    });
  };

  const onStatusChange = async (id: string, status: InvoiceStatus) => {
    await updateMutation.mutateAsync({
      id,
      status,
    });
  };

  const onDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
  };

  const summary: any = summaryQuery.data ?? {};

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Faturas</h1>
        <button
          className="rounded border px-3 py-2"
          onClick={() => setOpenCreate((v) => !v)}
        >
          {openCreate ? "Fechar" : "Nova fatura"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border p-3">
          Total emitido: R$ {formatCurrencyFromCents(summary?.totalIssued ?? 0)}
        </div>
        <div className="rounded border p-3">
          Total pago: R$ {formatCurrencyFromCents(summary?.totalPaid ?? 0)}
        </div>
        <div className="rounded border p-3">
          Total geral: R$ {formatCurrencyFromCents(summary?.total ?? 0)}
        </div>
        <div className="rounded border p-3">
          Pendentes: {summary?.pending ?? 0}
        </div>
      </div>

      {openCreate && (
        <div className="rounded border p-3 space-y-2">
          <input
            className="w-full rounded border p-2"
            placeholder="Número"
            value={draft.number}
            onChange={(e) => setDraft((s) => ({ ...s, number: e.target.value }))}
          />

          <input
            className="w-full rounded border p-2"
            placeholder="Customer ID (opcional)"
            value={draft.customerId}
            onChange={(e) => setDraft((s) => ({ ...s, customerId: e.target.value }))}
          />

          <input
            className="w-full rounded border p-2"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Valor"
            value={draft.amount}
            onChange={(e) => setDraft((s) => ({ ...s, amount: e.target.value }))}
          />

          <select
            className="w-full rounded border p-2"
            value={draft.status}
            onChange={(e) =>
              setDraft((s) => ({ ...s, status: e.target.value as InvoiceStatus }))
            }
          >
            <option value="DRAFT">Rascunho</option>
            <option value="ISSUED">Emitida</option>
            <option value="PAID">Paga</option>
            <option value="CANCELLED">Cancelada</option>
          </select>

          <textarea
            className="w-full rounded border p-2"
            placeholder="Observações (opcional)"
            value={draft.notes}
            onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
            rows={3}
          />

          <button
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
            onClick={onCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      <div className="rounded border p-3 space-y-2">
        {listQuery.isLoading ? (
          <div>Carregando...</div>
        ) : invoices.length === 0 ? (
          <div>Nenhuma fatura encontrada.</div>
        ) : (
          invoices.map((inv: any) => (
            <div
              key={inv.id}
              className="flex flex-col gap-3 rounded border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-medium">{inv.number}</div>
                <div className="text-xs opacity-70">
                  {STATUS_LABEL[(inv.status as InvoiceStatus) ?? "DRAFT"] ?? inv.status}
                </div>
                {inv.customer?.name ? (
                  <div className="text-xs opacity-70">Cliente: {inv.customer.name}</div>
                ) : null}
                {inv.notes ? (
                  <div className="mt-1 text-xs opacity-70">{inv.notes}</div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-[90px]">
                  R$ {formatCurrencyFromCents(inv.amountCents ?? 0)}
                </span>

                <select
                  value={inv.status}
                  onChange={(e) =>
                    onStatusChange(String(inv.id), e.target.value as InvoiceStatus)
                  }
                  className="rounded border p-1 text-xs"
                  disabled={updateMutation.isPending}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="PAID">PAID</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <button
                  className="rounded border px-2 py-1 text-xs text-red-600 disabled:opacity-60"
                  onClick={() => onDelete(String(inv.id))}
                  disabled={deleteMutation.isPending || inv.status === "PAID"}
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
