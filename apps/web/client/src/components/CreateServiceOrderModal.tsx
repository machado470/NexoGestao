import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { serviceOrderSchema } from "@/lib/validations";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  customers: Array<{ id: string; name: string }>;
};

type FormState = {
  customerId: string;
  title: string;
  description: string;
  priority: string;
  scheduledFor: string;
  amount: string;
  dueDate: string;
};

const INITIAL_FORM: FormState = {
  customerId: "",
  title: "",
  description: "",
  priority: "2",
  scheduledFor: "",
  amount: "",
  dueDate: "",
};

function parseAmountToCents(raw: string): number | undefined {
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return undefined;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value * 100);
}

export default function CreateServiceOrderModal({
  open,
  onClose,
  onCreated,
  customers,
}: Props) {
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);

  const createMutation = trpc.nexo.serviceOrders.create.useMutation({
    onSuccess: () => {
      setFormData(INITIAL_FORM);
      onCreated?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar ordem de serviço");
    },
  });

  const canSubmit = useMemo(() => {
    return (
      formData.customerId.trim().length > 0 &&
      formData.title.trim().length > 0
    );
  }, [formData.customerId, formData.title]);

  const handleClose = () => {
    if (createMutation.isPending) return;
    setFormData(INITIAL_FORM);
    onClose();
  };

  const submit = async () => {
    const priority = Number(formData.priority);
    if (!Number.isFinite(priority)) {
      toast.error("Prioridade inválida.");
      return;
    }

    const amountCents = parseAmountToCents(formData.amount);

    if (formData.amount.trim() && amountCents === undefined) {
      toast.error("Valor inválido.");
      return;
    }

    const parsed = serviceOrderSchema.safeParse({
      customerId: formData.customerId.trim(),
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority,
      scheduledFor: formData.scheduledFor.trim() || "",
      amountCents,
      dueDate: formData.dueDate.trim() || "",
    });

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dados inválidos para criar a O.S.";
      toast.error(firstError);
      return;
    }

    await createMutation.mutateAsync({
      customerId: parsed.data.customerId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      priority: parsed.data.priority,
      scheduledFor: parsed.data.scheduledFor || undefined,
      amountCents: parsed.data.amountCents,
      dueDate: parsed.data.dueDate || undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova OS</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"
            type="button"
            disabled={createMutation.isPending}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-sm font-medium">Cliente *</label>
            <select
              className="w-full rounded-lg border p-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={formData.customerId}
              onChange={(e) =>
                setFormData((state) => ({ ...state, customerId: e.target.value }))
              }
              disabled={createMutation.isPending}
            >
              <option value="">Selecione um cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Título *</label>
            <input
              className="w-full rounded-lg border p-2 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Ex: Limpeza pós-obra apartamento 302"
              value={formData.title}
              onChange={(e) =>
                setFormData((state) => ({ ...state, title: e.target.value }))
              }
              disabled={createMutation.isPending}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Descrição</label>
            <textarea
              className="w-full rounded-lg border p-2 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Detalhes do serviço"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData((state) => ({ ...state, description: e.target.value }))
              }
              disabled={createMutation.isPending}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Prioridade</label>
              <select
                className="w-full rounded-lg border p-2 dark:border-zinc-700 dark:bg-zinc-950"
                value={formData.priority}
                onChange={(e) =>
                  setFormData((state) => ({ ...state, priority: e.target.value }))
                }
                disabled={createMutation.isPending}
              >
                <option value="1">Muito baixa</option>
                <option value="2">Baixa</option>
                <option value="3">Média</option>
                <option value="4">Alta</option>
                <option value="5">Urgente</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Agendada para</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border p-2 dark:border-zinc-700 dark:bg-zinc-950"
                value={formData.scheduledFor}
                onChange={(e) =>
                  setFormData((state) => ({ ...state, scheduledFor: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Valor (R$)</label>
              <input
                className="w-full rounded-lg border p-2 dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="Ex: 150,00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((state) => ({ ...state, amount: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Vencimento</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border p-2 dark:border-zinc-700 dark:bg-zinc-950"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData((state) => ({ ...state, dueDate: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            onClick={() => void submit()}
            disabled={createMutation.isPending || !canSubmit}
            className="flex-1 bg-black px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {createMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              "Criar"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
