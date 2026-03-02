import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateExpenseModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateExpenseModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    category: "",
    paymentMethod: "",
    notes: "",
  });

  const createExpense = trpc.finance.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Despesa criada com sucesso!");
      setFormData({
        description: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        category: "",
        paymentMethod: "",
        notes: "",
      });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar despesa");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    if (!formData.amount) {
      toast.error("Valor é obrigatório");
      return;
    }

    if (!formData.category) {
      toast.error("Categoria é obrigatória");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor deve ser maior que 0");
      return;
    }

    createExpense.mutate({
      description: formData.description,
      amount,
      date: new Date(formData.date),
      category: formData.category,
      paymentMethod: formData.paymentMethod || undefined,
      notes: formData.notes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nova Despesa</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ex: Aluguel, Internet, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Selecione uma categoria</option>
              <option value="Aluguel">Aluguel</option>
              <option value="Salários">Salários</option>
              <option value="Marketing">Marketing</option>
              <option value="Infraestrutura">Infraestrutura</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pagamento</label>
            <input
              type="text"
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ex: Cartão, PIX, Boleto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Notas adicionais..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4 justify-end">
            <Button onClick={onClose} variant="outline" type="button">Cancelar</Button>
            <Button type="submit" disabled={createExpense.isPending} className="bg-orange-500 hover:bg-orange-600 text-white">
              {createExpense.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Criar Despesa"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
