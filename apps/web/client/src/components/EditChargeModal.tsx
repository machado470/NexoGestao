import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-lg dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Editar Cobrança
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {charge?.customer?.name || "Cliente não identificado"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            type="button"
            disabled={updateCharge.isPending}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitUpdate();
          }}
          className="space-y-4 p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Valor (R$) *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="100,00"
              disabled={disableEditing || updateCharge.isPending}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Data de Vencimento *
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData({ ...formData, dueDate: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              disabled={disableEditing || updateCharge.isPending}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              disabled={disableEditing || updateCharge.isPending}
            >
              <option value="PENDING">Manter ativa</option>
              <option value="CANCELED">Cancelar cobrança</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              O backend só permite cancelamento manual. Cobranças pagas devem usar o fluxo de pagamento.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Adicione notas sobre a cobrança"
              rows={3}
              disabled={updateCharge.isPending}
            />
          </div>

          {isPaid && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
              Esta cobrança já foi paga e não pode ter valor, vencimento ou status alterados.
            </p>
          )}

          {isCanceled && (
            <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-300">
              Esta cobrança já está cancelada. Só as notas podem ser ajustadas.
            </p>
          )}
        </form>

        <div className="flex justify-end gap-3 border-t border-gray-200 p-6 dark:border-gray-700">
          <Button
            onClick={onClose}
            variant="outline"
            className="text-gray-700 dark:text-gray-300"
            type="button"
            disabled={updateCharge.isPending}
          >
            Cancelar
          </Button>

          <Button
            onClick={() => void submitUpdate()}
            disabled={updateCharge.isPending}
            className="bg-orange-500 text-white hover:bg-orange-600"
            type="button"
          >
            {updateCharge.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              "Atualizar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
