import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  X,
  Loader2,
  Wallet,
  CalendarDays,
  Receipt,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { chargeEditSchema } from "@/lib/validations";

interface EditChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  chargeId: string | null;
}

function parseAmountToCents(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function formatCurrencyFromInput(raw: string) {
  const cents = parseAmountToCents(raw);
  if (!cents) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDueDatePreview(value: string) {
  if (!value) return "Não definido";

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "PAID":
      return "Paga";
    case "PENDING":
      return "Pendente";
    case "OVERDUE":
      return "Vencida";
    case "CANCELED":
      return "Cancelada";
    default:
      return status || "—";
  }
}

function getStatusBadgeClass(status?: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "OVERDUE":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "CANCELED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="rounded-lg bg-orange-100 p-2 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

export function EditChargeModal({
  isOpen,
  onClose,
  onSuccess,
  chargeId,
}: EditChargeModalProps) {
  const [formData, setFormData] = useState({
    amount: "",
    dueDate: "",
    status: "PENDING",
    notes: "",
  });

  const getCharge = trpc.finance.charges.getById.useQuery(
    { id: chargeId || "" },
    {
      enabled: isOpen && !!chargeId,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const updateCharge = trpc.finance.charges.update.useMutation({
    onSuccess: () => {
      toast.success("Cobrança atualizada com sucesso!");
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar cobrança");
    },
  });

  useEffect(() => {
    if (!getCharge.data) return;

    const payload = getCharge.data as any;
    const charge = payload?.data ?? payload ?? null;

    setFormData({
      amount: charge?.amountCents
        ? (Number(charge.amountCents) / 100).toFixed(2)
        : "",
      dueDate: charge?.dueDate
        ? new Date(charge.dueDate).toISOString().split("T")[0]
        : "",
      status: charge?.status === "CANCELED" ? "CANCELED" : "PENDING",
      notes: charge?.notes || "",
    });
  }, [getCharge.data]);

  const submitUpdate = async () => {
    if (!chargeId) return;

    const amountCents = parseAmountToCents(formData.amount);

    const parsed = chargeEditSchema.safeParse({
      amountCents: amountCents ?? 0,
      dueDate: formData.dueDate,
      status: formData.status === "CANCELED" ? "CANCELED" : "PENDING",
      notes: formData.notes.trim() || undefined,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dados inválidos";
      toast.error(firstError);
      return;
    }

    await updateCharge.mutateAsync({
      id: chargeId,
      amountCents: parsed.data.amountCents,
      dueDate: new Date(`${parsed.data.dueDate}T12:00:00`).toISOString(),
      status: parsed.data.status === "CANCELED" ? "CANCELED" : undefined,
      notes: parsed.data.notes || undefined,
    });
  };

  if (!isOpen) return null;

  if (getCharge.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  const payload = getCharge.data as any;
  const charge = payload?.data ?? payload ?? null;
  const isCanceled = charge?.status === "CANCELED";
  const isPaid = charge?.status === "PAID";
  const disableEditing = isCanceled || isPaid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between border-b border-gray-200 p-6 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <Pencil className="h-5 w-5 text-orange-500" />
              Editar Cobrança
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Ajuste valor, vencimento, cancelamento manual e observações da cobrança.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"
            type="button"
            disabled={updateCharge.isPending}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={Receipt}
                title="Contexto da cobrança"
                subtitle="Veja rapidamente quem será impactado e em que estado a cobrança está."
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Cliente
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {charge?.customer?.name || "Cliente não identificado"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Status atual
                  </p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                        charge?.status
                      )}`}
                    >
                      {getStatusLabel(charge?.status)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    O.S. vinculada
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {charge?.serviceOrder?.title || "Cobrança manual"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Pago em
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {charge?.paidAt
                      ? new Date(charge.paidAt).toLocaleDateString("pt-BR")
                      : "Ainda não pago"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={Wallet}
                title="Dados editáveis"
                subtitle="Ajuste o que ainda pode ser alterado dentro das regras do backend."
              />

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Valor (R$) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder="100,00"
                      disabled={disableEditing || updateCharge.isPending}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Valor atual: {formatCurrencyFromInput(formData.amount)}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <CalendarDays className="h-4 w-4 text-gray-500" />
                      Data de vencimento *
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      disabled={disableEditing || updateCharge.isPending}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    disabled={disableEditing || updateCharge.isPending}
                  >
                    <option value="PENDING">Manter ativa</option>
                    <option value="CANCELED">Cancelar cobrança</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    O backend só permite cancelamento manual. Cobranças pagas seguem o fluxo de pagamento.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Notas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    placeholder="Adicione notas sobre a cobrança"
                    rows={4}
                    disabled={updateCharge.isPending}
                  />
                </div>
              </div>
            </section>

            {isPaid && (
              <section className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Cobrança já paga</p>
                    <p className="mt-1">
                      Esta cobrança já foi quitada e não pode ter valor, vencimento ou status alterados.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {isCanceled && (
              <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Cobrança já cancelada</p>
                    <p className="mt-1">
                      Esta cobrança já está cancelada. Só as notas continuam ajustáveis.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Resumo antes de salvar
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Valor
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrencyFromInput(formData.amount)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Vencimento
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formatDueDatePreview(formData.dueDate)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Ação de status
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formData.status === "CANCELED" ? "Cancelar cobrança" : "Manter ativa"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Observações
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formData.notes.trim() || "Sem observações"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex gap-2 border-t border-gray-200 p-6 dark:border-zinc-800">
          <Button
            onClick={() => void submitUpdate()}
            disabled={updateCharge.isPending}
            className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
            type="button"
          >
            {updateCharge.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </span>
            ) : (
              "Salvar alterações"
            )}
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            type="button"
            disabled={updateCharge.isPending}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
