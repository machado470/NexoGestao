import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateChargeModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateChargeModalProps) {
  const [formData, setFormData] = useState({
    customerId: "",
    amount: "",
    dueDate: "",
    notes: "",
  });

  const createCharge = trpc.finance.charges.create.useMutation({
    onSuccess: () => {
      toast.success("Cobrança criada com sucesso!");
      setFormData({
        customerId: "",
        amount: "",
        dueDate: "",
        notes: "",
      });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar cobrança");
    },
  });

  const { data: customersResponse } = trpc.nexo.customers.list.useQuery();
  const customers = Array.isArray((customersResponse as any)?.data)
    ? (customersResponse as any).data
    : Array.isArray(customersResponse)
      ? customersResponse
      : [];

  const submitCharge = async () => {
    if (!formData.customerId || formData.customerId === "0") {
      toast.error("Cliente é obrigatório");
      return;
    }

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

    await createCharge.mutateAsync({
      customerId: formData.customerId,
      amount,
      dueDate: new Date(`${formData.dueDate}T12:00:00`),
      notes: formData.notes.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-lg dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Nova Cobrança
          </h2>

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
            void submitCharge();
          }}
          className="space-y-4 p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Cliente *
            </label>
            <select
              value={formData.customerId}
              onChange={(e) =>
                setFormData({ ...formData, customerId: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Selecione um cliente</option>
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

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
            onClick={() => void submitCharge()}
            disabled={createCharge.isPending}
            className="bg-orange-500 text-white hover:bg-orange-600"
            type="button"
          >
            {createCharge.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
