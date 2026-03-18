import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
type EditableInvoiceStatus = "DRAFT" | "ISSUED" | "CANCELLED";

type InvoiceItem = {
  id: string;
  number: string;
  description: string | null;
  amountCents: number;
  amount?: number;
  status: InvoiceStatus;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  customer?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
};

type InvoiceListResponse = {
  data: InvoiceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type InvoiceSummary = {
  total: number;
  totalIssued: number;
  totalPaid: number;
  pending: number;
};

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

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getStatusBadgeClass(status: InvoiceStatus) {
  switch (status) {
    case "DRAFT":
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
    case "ISSUED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "PAID":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "CANCELLED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function normalizeSummary(raw: unknown): InvoiceSummary {
  const payload = (raw as { data?: unknown } | null | undefined)?.data ?? raw ?? {};

  if (!payload || typeof payload !== "object") {
    return {
      total: 0,
      totalIssued: 0,
      totalPaid: 0,
      pending: 0,
    };
  }

  const candidate = payload as Partial<InvoiceSummary>;

  return {
    total:
      typeof candidate.total === "number" && Number.isFinite(candidate.total)
        ? candidate.total
        : 0,
    totalIssued:
      typeof candidate.totalIssued === "number" && Number.isFinite(candidate.totalIssued)
        ? candidate.totalIssued
        : 0,
    totalPaid:
      typeof candidate.totalPaid === "number" && Number.isFinite(candidate.totalPaid)
        ? candidate.totalPaid
        : 0,
    pending:
      typeof candidate.pending === "number" && Number.isFinite(candidate.pending)
        ? candidate.pending
        : 0,
  };
}

function normalizeList(raw: unknown): InvoiceListResponse {
  const payload = (raw as { data?: unknown } | null | undefined)?.data ?? raw ?? {};

  if (!payload || typeof payload !== "object") {
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

  const candidate = payload as Partial<InvoiceListResponse>;
  const list = Array.isArray(candidate.data) ? candidate.data : [];
  const pagination = candidate.pagination;

  const data: InvoiceItem[] = list.map((item) => {
    const invoice = (item ?? {}) as Partial<InvoiceItem>;

    return {
      id: typeof invoice.id === "string" ? invoice.id : "",
      number:
        typeof invoice.number === "string" && invoice.number.trim()
          ? invoice.number
          : "Sem número",
      description: typeof invoice.description === "string" ? invoice.description : null,
      amountCents:
        typeof invoice.amountCents === "number" && Number.isFinite(invoice.amountCents)
          ? invoice.amountCents
          : typeof invoice.amount === "number" && Number.isFinite(invoice.amount)
            ? Math.round(invoice.amount * 100)
            : 0,
      amount:
        typeof invoice.amount === "number" && Number.isFinite(invoice.amount)
          ? invoice.amount
          : undefined,
      status:
        invoice.status === "DRAFT" ||
        invoice.status === "ISSUED" ||
        invoice.status === "PAID" ||
        invoice.status === "CANCELLED"
          ? invoice.status
          : "DRAFT",
      issuedAt: typeof invoice.issuedAt === "string" ? invoice.issuedAt : null,
      dueDate: typeof invoice.dueDate === "string" ? invoice.dueDate : null,
      paidAt: typeof invoice.paidAt === "string" ? invoice.paidAt : null,
      notes: typeof invoice.notes === "string" ? invoice.notes : null,
      customer:
        invoice.customer && typeof invoice.customer === "object"
          ? {
              id: typeof invoice.customer.id === "string" ? invoice.customer.id : "",
              name:
                typeof invoice.customer.name === "string"
                  ? invoice.customer.name
                  : "Não vinculado",
              email:
                typeof invoice.customer.email === "string"
                  ? invoice.customer.email
                  : null,
            }
          : null,
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

export default function InvoicesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      status: statusFilter || undefined,
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
      toast.success("Fatura criada.");
      await Promise.all([
        utils.invoices.list.invalidate(),
        utils.invoices.summary.invalidate(),
      ]);
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
      toast.error(error.message || "Erro ao criar fatura.");
    },
  });

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: async () => {
      toast.success("Fatura atualizada.");
      setUpdatingId(null);
      await Promise.all([
        utils.invoices.list.invalidate(),
        utils.invoices.summary.invalidate(),
      ]);
    },
    onError: (error) => {
      setUpdatingId(null);
      toast.error(error.message || "Erro ao atualizar fatura.");
    },
  });

  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: async () => {
      toast.success("Fatura removida.");
      setDeletingId(null);
      await Promise.all([
        utils.invoices.list.invalidate(),
        utils.invoices.summary.invalidate(),
      ]);
    },
    onError: (error) => {
      setDeletingId(null);
      toast.error(error.message || "Erro ao remover fatura.");
    },
  });

  const payload = useMemo(() => normalizeList(listQuery.data), [listQuery.data]);
  const invoices = payload.data;
  const pages = payload.pagination.pages;
  const summary = useMemo(() => normalizeSummary(summaryQuery.data), [summaryQuery.data]);

  const handleApplySearch = () => {
    setPage(1);
    setQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setPage(1);
    setSearchInput("");
    setQuery("");
    setStatusFilter("");
  };

  const handleRefresh = async () => {
    await Promise.all([listQuery.refetch(), summaryQuery.refetch()]);
  };

  const onCreate = async () => {
    if (!draft.number.trim()) {
      toast.error("Número obrigatório.");
      return;
    }

    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Valor inválido.");
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
    setUpdatingId(id);
    await updateMutation.mutateAsync({
      id,
      status,
    });
  };

  const onDelete = async (id: string) => {
    const confirmed = window.confirm("Excluir esta fatura?");
    if (!confirmed) return;

    setDeletingId(id);
    await deleteMutation.mutateAsync({ id });
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 space-y-4">
        <div className="rounded-xl border p-4 text-sm opacity-70 dark:border-zinc-800">
          Faça login para visualizar faturas.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faturas</h1>
          <p className="text-sm opacity-70">
            Módulo documental comercial. Pagamento real continua no financeiro.
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
            onClick={() => setOpenCreate((value) => !value)}
          >
            <Plus className="h-4 w-4" />
            {openCreate ? "Fechar" : "Nova fatura"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-3 text-sm opacity-80 dark:border-zinc-800">
        Fatura não quita cobrança automaticamente. Para registrar pagamento, use o
        fluxo financeiro de cobranças e pagamentos.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border p-3 dark:border-zinc-800">
          <div className="text-sm opacity-70">Total emitido</div>
          <div className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(summary.totalIssued)}
          </div>
        </div>
        <div className="rounded-xl border p-3 dark:border-zinc-800">
          <div className="text-sm opacity-70">Total pago</div>
          <div className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(summary.totalPaid)}
          </div>
        </div>
        <div className="rounded-xl border p-3 dark:border-zinc-800">
          <div className="text-sm opacity-70">Total geral</div>
          <div className="mt-1 text-lg font-semibold">
            {formatCurrencyFromCents(summary.total)}
          </div>
        </div>
        <div className="rounded-xl border p-3 dark:border-zinc-800">
          <div className="text-sm opacity-70">Pendentes</div>
          <div className="mt-1 text-lg font-semibold">{summary.pending}</div>
        </div>
      </div>

      <div className="rounded-xl border p-3 space-y-3 dark:border-zinc-800">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-50" />
            <input
              className="w-full rounded border p-2 pl-9 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Buscar por número ou descrição"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplySearch();
              }}
            />
          </div>

          <select
            className="rounded border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as InvoiceStatus | "");
            }}
          >
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="ISSUED">Emitida</option>
            <option value="PAID">Paga</option>
            <option value="CANCELLED">Cancelada</option>
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
            onClick={handleClearSearch}
            disabled={!query && !searchInput && !statusFilter}
          >
            Limpar
          </button>
        </div>

        {query || statusFilter ? (
          <div className="text-xs opacity-70">
            {query ? `Busca ativa: ${query}` : "Busca sem texto"}{" "}
            {statusFilter ? `• Status: ${STATUS_LABEL[statusFilter]}` : ""}
          </div>
        ) : null}
      </div>

      {openCreate ? (
        <div className="space-y-2 rounded-xl border p-3 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Nova fatura
          </div>

          <input
            className="w-full rounded border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Número"
            value={draft.number}
            onChange={(e) =>
              setDraft((state) => ({ ...state, number: e.target.value }))
            }
          />

          <input
            className="w-full rounded border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Valor"
            value={draft.amount}
            onChange={(e) =>
              setDraft((state) => ({ ...state, amount: e.target.value }))
            }
          />

          <select
            className="w-full rounded border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            value={draft.status}
            onChange={(e) =>
              setDraft((state) => ({
                ...state,
                status: e.target.value as EditableInvoiceStatus,
              }))
            }
          >
            <option value="DRAFT">Rascunho</option>
            <option value="ISSUED">Emitida</option>
            <option value="CANCELLED">Cancelada</option>
          </select>

          <input
            className="w-full rounded border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Descrição (opcional)"
            value={draft.description}
            onChange={(e) =>
              setDraft((state) => ({ ...state, description: e.target.value }))
            }
          />

          <textarea
            className="w-full rounded border p-2 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Observações (opcional)"
            value={draft.notes}
            onChange={(e) =>
              setDraft((state) => ({ ...state, notes: e.target.value }))
            }
            rows={3}
          />

          <div className="text-xs opacity-70">
            Cliente pode permanecer não vinculado nesta fase. O objetivo aqui é
            emissão documental, não liquidação financeira.
          </div>

          <button
            type="button"
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-black"
            onClick={() => void onCreate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border p-3 dark:border-zinc-800">
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : listQuery.isError ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Erro ao carregar faturas
            </div>
            <p className="mt-2">
              Não foi possível carregar as faturas agora.
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-10 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="font-medium">Nenhuma fatura encontrada</div>
            <div className="mt-1 text-sm opacity-70">
              Ajuste os filtros ou crie uma nova fatura.
            </div>
          </div>
        ) : (
          invoices.map((inv) => {
            const isPaid = inv.status === "PAID";
            const editableStatus = (isPaid ? "ISSUED" : inv.status) as EditableInvoiceStatus;

            return (
              <div
                key={inv.id}
                className="flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-center md:justify-between dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{inv.number}</div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                        inv.status
                      )}`}
                    >
                      {STATUS_LABEL[inv.status]}
                    </span>
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
                    Emissão: {formatDate(inv.issuedAt)} • Vencimento: {formatDate(inv.dueDate)}
                  </div>

                  {inv.notes ? (
                    <div className="mt-1 text-xs opacity-70">{inv.notes}</div>
                  ) : null}

                  {isPaid ? (
                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Pagamento registrado fora deste módulo.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[120px] text-sm font-medium">
                    {formatCurrencyFromCents(inv.amountCents)}
                  </span>

                  <select
                    value={editableStatus}
                    onChange={(e) =>
                      void onStatusChange(
                        inv.id,
                        e.target.value as EditableInvoiceStatus
                      )
                    }
                    className="rounded border p-1 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                    disabled={(updateMutation.isPending && updatingId === inv.id) || isPaid}
                  >
                    <option value="DRAFT">Rascunho</option>
                    <option value="ISSUED">Emitida</option>
                    <option value="CANCELLED">Cancelada</option>
                  </select>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-red-600 disabled:opacity-60 dark:border-zinc-800 dark:text-red-300"
                    onClick={() => void onDelete(inv.id)}
                    disabled={(deleteMutation.isPending && deletingId === inv.id) || inv.status === "PAID"}
                  >
                    {deleteMutation.isPending && deletingId === inv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
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
          className="rounded border px-3 py-2 dark:border-zinc-800"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </button>

        <span className="text-sm opacity-70">
          {page} / {pages}
        </span>

        <button
          type="button"
          className="rounded border px-3 py-2 dark:border-zinc-800"
          disabled={page >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
