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
    description: "",
    amount: "",
    dueDate: "",
    notes: "",
  });

  const createCharge = trpc.finance.charges.create.useMutation({
    onSuccess: () => {
      toast.success("Cobrança criada com sucesso!");
      setFormData({
        customerId: "",
        description: "",
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

  // Fetch customers
  const { data: customersResponse } = trpc.data.customers.list.useQuery({ page: 1, limit: 1000 });
  const customers = (customersResponse as any)?.data || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId || formData.customerId === "0") {
      toast.error("Cliente é obrigatório");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Descrição é obrigatória");
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

    createCharge.mutate({
      customerId: formData.customerId, // UUID string
      description: formData.description,
      amount,
      dueDate: new Date(formData.dueDate),
      notes: formData.notes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Nova Cobrança
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cliente *
            </label>
            <select
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Selecione um cliente</option>
              {(customers as any[]).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ex: Serviço de consultoria"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="100.00"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data de Vencimento *
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Adicione notas sobre a cobrança"
              rows={3}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 justify-end">
          <Button
            onClick={onClose}
            variant="outline"
            className="text-gray-700 dark:text-gray-300"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createCharge.isPending}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {createCharge.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
