import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
type EditableInvoiceStatus = "DRAFT" | "ISSUED" | "CANCELLED";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Rascunho",
  ISSUED: "Emitida",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(value || 0)) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("pt-BR");
}

function normalizeSummary(raw: any) {
  const payload = raw?.data ?? raw ?? {};

  return {
    total: Number(payload?.total ?? 0),
    totalIssued: Number(payload?.totalIssued ?? 0),
    totalPaid: Number(payload?.totalPaid ?? 0),
    pending: Number(payload?.pending ?? 0),
  };
}

export default function InvoicesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({
    number: "",
    amount: "",
    status: "DRAFT" as EditableInvoiceStatus,
    notes: "",
    description: "",
  });

  const utils = trpc.useUtils();

  const listQuery = trpc.invoices.list.useQuery(
    {
      page,
      limit: 20,
      q: query || undefined,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const summaryQuery = trpc.invoices.summary.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: async () => {
      toast.success("Fatura criada");
      await utils.invoices.list.invalidate();
      await utils.invoices.summary.invalidate();
      setOpenCreate(false);
      setDraft({
        number: "",
        amount: "",
        status: "DRAFT",
        notes: "",
        description: "",
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
    const raw: any =
      listQuery.data ?? { data: [], pagination: { page: 1, pages: 1 } };

    return {
      data: Array.isArray(raw?.data) ? raw.data : [],
      pagination: raw?.pagination ?? {
        page: 1,
        limit: 20,
        total: 0,
        pages: 1,
      },
    };
  }, [listQuery.data]);

  const invoices: any[] = payload.data;
  const pages = payload.pagination?.pages ?? 1;
  const summary = normalizeSummary(summaryQuery.data);

  const handleApplySearch = () => {
    setPage(1);
    setQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setPage(1);
    setSearchInput("");
    setQuery("");
  };

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
      number: draft.number.trim(),
      amount,
      status: draft.status,
      notes: draft.notes.trim() || undefined,
      description: draft.description.trim() || undefined,
    });
  };

  const onStatusChange = async (id: string, status: EditableInvoiceStatus) => {
    await updateMutation.mutateAsync({
      id,
      status,
    });
  };

  const onDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
  };

  if (isInitializing) {
    return (
      <div className="p-6 space-y-4">
        <div className="rounded border p-4 text-sm opacity-70">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 space-y-4">
        <div className="rounded border p-4 text-sm opacity-70">
          Faça login para visualizar faturas.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Faturas</h1>
          <p className="text-sm opacity-70">
            Módulo documental comercial. Pagamento real continua no financeiro.
          </p>
        </div>

        <button
          type="button"
          className="rounded border px-3 py-2"
          onClick={() => setOpenCreate((v) => !v)}
        >
          {openCreate ? "Fechar" : "Nova fatura"}
        </button>
      </div>

      <div className="rounded border p-3 text-sm opacity-80">
        Fatura não quita cobrança automaticamente. Para registrar pagamento, use
        o fluxo financeiro de cobranças/pagamentos.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border p-3">
          Total emitido: {formatCurrencyFromCents(summary.totalIssued)}
        </div>
        <div className="rounded border p-3">
          Total pago: {formatCurrencyFromCents(summary.totalPaid)}
        </div>
        <div className="rounded border p-3">
          Total geral: {formatCurrencyFromCents(summary.total)}
        </div>
        <div className="rounded border p-3">Pendentes: {summary.pending}</div>
      </div>

      <div className="rounded border p-3 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="w-full rounded border p-2"
            placeholder="Buscar por número ou descrição"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApplySearch();
            }}
          />

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
            onClick={handleClearSearch}
            disabled={!query && !searchInput}
          >
            Limpar
          </button>
        </div>

        {query ? (
          <div className="text-xs opacity-70">Busca ativa: {query}</div>
        ) : null}
      </div>

      {openCreate && (
        <div className="space-y-2 rounded border p-3">
          <input
            className="w-full rounded border p-2"
            placeholder="Número"
            value={draft.number}
            onChange={(e) =>
              setDraft((s) => ({ ...s, number: e.target.value }))
            }
          />

          <input
            className="w-full rounded border p-2"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Valor"
            value={draft.amount}
            onChange={(e) =>
              setDraft((s) => ({ ...s, amount: e.target.value }))
            }
          />

          <select
            className="w-full rounded border p-2"
            value={draft.status}
            onChange={(e) =>
              setDraft((s) => ({
                ...s,
                status: e.target.value as EditableInvoiceStatus,
              }))
            }
          >
            <option value="DRAFT">Rascunho</option>
            <option value="ISSUED">Emitida</option>
            <option value="CANCELLED">Cancelada</option>
          </select>

          <input
            className="w-full rounded border p-2"
            placeholder="Descrição (opcional)"
            value={draft.description}
            onChange={(e) =>
              setDraft((s) => ({ ...s, description: e.target.value }))
            }
          />

          <textarea
            className="w-full rounded border p-2"
            placeholder="Observações (opcional)"
            value={draft.notes}
            onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
            rows={3}
          />

          <div className="text-xs opacity-70">
            Cliente pode permanecer não vinculado nesta fase. O objetivo aqui é
            emissão documental, não liquidação financeira.
          </div>

          <button
            type="button"
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
            onClick={onCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      <div className="space-y-2 rounded border p-3">
        {listQuery.isLoading ? (
          <div>Carregando...</div>
        ) : invoices.length === 0 ? (
          <div>Nenhuma fatura encontrada.</div>
        ) : (
          invoices.map((inv: any) => {
            const isPaid = inv.status === "PAID";
            const editableStatus = (
              isPaid ? "ISSUED" : inv.status
            ) as EditableInvoiceStatus;

            return (
              <div
                key={inv.id}
                className="flex flex-col gap-3 rounded border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{inv.number}</div>

                  <div className="text-xs opacity-70">
                    {STATUS_LABEL[(inv.status as InvoiceStatus) ?? "DRAFT"] ??
                      inv.status}
                  </div>

                  <div className="mt-1 text-xs opacity-70">
                    Cliente: {inv.customer?.name || "Não vinculado"}
                  </div>

                  {inv.description ? (
                    <div className="mt-1 text-xs opacity-70">
                      Descrição: {inv.description}
                    </div>
                  ) : null}

                  <div className="mt-1 text-xs opacity-70">
                    Emissão: {formatDate(inv.issuedAt)} • Vencimento:{" "}
                    {formatDate(inv.dueDate)}
                  </div>

                  {inv.notes ? (
                    <div className="mt-1 text-xs opacity-70">{inv.notes}</div>
                  ) : null}

                  {isPaid ? (
                    <div className="mt-1 text-xs text-amber-700">
                      Pagamento registrado fora deste módulo.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[120px] text-sm font-medium">
                    {formatCurrencyFromCents(inv.amountCents ?? 0)}
                  </span>

                  <select
                    value={editableStatus}
                    onChange={(e) =>
                      void onStatusChange(
                        String(inv.id),
                        e.target.value as EditableInvoiceStatus
                      )
                    }
                    className="rounded border p-1 text-xs"
                    disabled={updateMutation.isPending || isPaid}
                  >
                    <option value="DRAFT">Rascunho</option>
                    <option value="ISSUED">Emitida</option>
                    <option value="CANCELLED">Cancelada</option>
                  </select>

                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs text-red-600 disabled:opacity-60"
                    onClick={() => void onDelete(String(inv.id))}
                    disabled={deleteMutation.isPending || inv.status === "PAID"}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
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
          type="button"
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
