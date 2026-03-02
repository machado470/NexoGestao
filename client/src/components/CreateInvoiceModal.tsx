import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateInvoiceModalProps) {
  const [formData, setFormData] = useState({
    chargeId: "",
    invoiceNumber: "",
    issueDate: new Date().toISOString().split('T')[0],
    amount: "",
    status: "issued" as "issued" | "cancelled" | "pending",
    pdfUrl: "",
  });

  const createInvoice = trpc.finance.invoices.create.useMutation({
    onSuccess: () => {
      toast.success("Nota fiscal criada com sucesso!");
      setFormData({
        chargeId: "",
        invoiceNumber: "",
        issueDate: new Date().toISOString().split('T')[0],
        amount: "",
        status: "issued",
        pdfUrl: "",
      });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar nota fiscal");
    },
  });

  // Fetch charges to link invoice
  const { data: charges } = trpc.finance.charges.list.useQuery(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.invoiceNumber.trim()) {
      toast.error("Número da nota é obrigatório");
      return;
    }

    if (!formData.amount) {
      toast.error("Valor é obrigatório");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor deve ser maior que 0");
      return;
    }

    createInvoice.mutate({
      chargeId: formData.chargeId ? parseInt(formData.chargeId) : undefined,
      invoiceNumber: formData.invoiceNumber,
      issueDate: new Date(formData.issueDate),
      amount,
      status: formData.status,
      pdfUrl: formData.pdfUrl || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nova Nota Fiscal</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vincular a Cobrança (Opcional)</label>
            <select
              value={formData.chargeId}
              onChange={(e) => {
                const chargeId = e.target.value;
                const charge = charges?.find(c => c.id === parseInt(chargeId));
                setFormData({ 
                  ...formData, 
                  chargeId,
                  amount: charge ? (charge.amount / 100).toString() : formData.amount
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Selecione uma cobrança</option>
              {charges?.map((charge) => (
                <option key={charge.id} value={charge.id}>
                  {charge.description} - {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(charge.amount / 100)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número da Nota *</label>
            <input
              type="text"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ex: 2024001"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Emissão *</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="issued">Emitida</option>
              <option value="pending">Pendente</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL do PDF (Opcional)</label>
            <input
              type="text"
              value={formData.pdfUrl}
              onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-3 pt-4 justify-end">
            <Button onClick={onClose} variant="outline" type="button">Cancelar</Button>
            <Button type="submit" disabled={createInvoice.isPending} className="bg-orange-500 hover:bg-orange-600 text-white">
              {createInvoice.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Criar Nota Fiscal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
