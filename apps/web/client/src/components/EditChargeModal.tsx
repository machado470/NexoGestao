import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  chargeId: string | null;
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
    { enabled: isOpen && !!chargeId }
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

    const charge = getCharge.data as any;

    setFormData({
      amount: charge.amountCents
        ? (Number(charge.amountCents) / 100).toString()
        : "",
      dueDate: charge.dueDate
        ? new Date(charge.dueDate).toISOString().split("T")[0]
        : "",
      status: charge.status || "PENDING",
      notes: charge.notes || "",
    });
  }, [getCharge.data]);

  const submitUpdate = async () => {
    if (!formData.amount) {
      toast.error("Valor é obrigatório");
      return;
    }

    if (!formData.dueDate) {
      toast.error("Data de vencimento é obrigatória");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor deve ser maior que 0");
      return;
    }

    if (!chargeId) return;

    if (formData.status === "PAID") {
      toast.error("Para marcar como paga, use o fluxo de pagamento.");
      return;
    }

    await updateCharge.mutateAsync({
      id: chargeId,
      amount,
      dueDate: new Date(`${formData.dueDate}T12:00:00`),
      status: formData.status as "PENDING" | "OVERDUE" | "CANCELED",
      notes: formData.notes.trim() || undefined,
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

  const charge = getCharge.data as any;

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
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="100.00"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="PENDING">Pendente</option>
              <option value="OVERDUE">Vencido</option>
              <option value="CANCELED">Cancelado</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Cobranças pagas devem ser registradas pelo fluxo de pagamento.
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Adicione notas sobre a cobrança"
              rows={3}
            />
          </div>
        </form>

        <div className="flex justify-end gap-3 border-t border-gray-200 p-6 dark:border-gray-700">
          <Button
            onClick={onClose}
            variant="outline"
            className="text-gray-700 dark:text-gray-300"
            type="button"
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
