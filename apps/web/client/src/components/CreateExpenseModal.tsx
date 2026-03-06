import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateExpenseModal({ open, onClose, onCreated }: Props) {
  const createMutation = trpc.expenses.create.useMutation();

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "",
    dueDate: "",
    notes: "",
  });

  if (!open) return null;

  const submit = async () => {
    const amount = parseFloat(formData.amount || "0");
    if (!formData.description || !formData.category || !formData.dueDate || !amount) return;

    await createMutation.mutateAsync({
      description: formData.description,
      amount,
      category: formData.category,
      dueDate: new Date(formData.dueDate),
      notes: formData.notes ? formData.notes : undefined,
    });

    onCreated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova Despesa</h2>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Descrição"
            value={formData.description}
            onChange={(e) => setFormData((s) => ({ ...s, description: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Categoria"
            value={formData.category}
            onChange={(e) => setFormData((s) => ({ ...s, category: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Valor (ex: 120.50)"
            value={formData.amount}
            onChange={(e) => setFormData((s) => ({ ...s, amount: e.target.value }))}
          />
          <input
            type="date"
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            value={formData.dueDate}
            onChange={(e) => setFormData((s) => ({ ...s, dueDate: e.target.value }))}
          />
          <textarea
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Notas (opcional)"
            value={formData.notes}
            onChange={(e) => setFormData((s) => ({ ...s, notes: e.target.value }))}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={submit}
            disabled={createMutation.isPending}
            className="flex-1 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {createMutation.isPending ? "Salvando..." : "Criar"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 dark:border-zinc-700"
          >
            Cancelar
          </button>
        </div>

        {createMutation.error ? (
          <p className="mt-3 text-sm text-red-500">
            Erro ao criar despesa.
          </p>
        ) : null}
      </div>
    </div>
  );
}
