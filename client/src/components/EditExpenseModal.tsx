import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expenseId: number | null;
}

export function EditExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  expenseId,
}: EditExpenseModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "",
    paymentMethod: "",
    notes: "",
  });

  const { data: expense, isLoading } = trpc.expenses.getById.useQuery(
    { id: expenseId as number },
    { enabled: !!expenseId && isOpen }
  );

  useEffect(() => {
    if (expense) {
      setFormData({
        description: expense.description,
        amount: (Number(expense.amount) / 100).toString(),
        category: expense.category,
        paymentMethod: expense.paymentMethod || "",
        notes: expense.notes || "",
      });
    }
  }, [expense]);

  const updateExpense = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("Despesa atualizada com sucesso!");
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar despesa: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseId) return;

    updateExpense.mutate({
      id: expenseId,
      description: formData.description,
      amount: Number(formData.amount),
      category: formData.category,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Editar Despesa
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Categoria
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Método de Pagamento
            </label>
            <input
              type="text"
              value={formData.paymentMethod}
              onChange={(e) =>
                setFormData({ ...formData, paymentMethod: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateExpense.isPending || isLoading}
              className="gap-2"
            >
              {updateExpense.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Atualizar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
