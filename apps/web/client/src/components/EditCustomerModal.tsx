import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: number | null;
}

export function EditCustomerModal({
  isOpen,
  onClose,
  onSuccess,
  customerId,
}: EditCustomerModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    active: 1,
  });

  // Fetch customer data
  const { data: customer, isLoading: isFetching } = trpc.data.customers.get.useQuery(
    { id: customerId || 0 },
    { enabled: isOpen && customerId !== null }
  );

  // Update mutation
  const updateCustomer = trpc.data.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar cliente");
    },
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        notes: customer.notes || "",
        active: customer.active || 1,
      });
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.phone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }

    if (formData.email && !formData.email.includes("@")) {
      toast.error("Email inválido");
      return;
    }

    if (customerId) {
      updateCustomer.mutate({
        id: customerId,
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone,
        notes: formData.notes || undefined,
        active: formData.active,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Editar Cliente
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
          {isFetching ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Nome do cliente"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="email@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="(11) 99999-9999"
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
                  placeholder="Adicione notas sobre o cliente"
                  rows={3}
                />
              </div>

              {/* Active Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value={1}>Ativo</option>
                  <option value={0}>Inativo</option>
                </select>
              </div>
            </>
          )}
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
            disabled={updateCustomer.isPending || isFetching}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {updateCustomer.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
