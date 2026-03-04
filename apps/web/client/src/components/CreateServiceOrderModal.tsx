import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateServiceOrderModal({ open, onClose, onCreated }: Props) {
  // rota real ainda não está exposta no trpc types -> usa any até fechar paridade
  const trpcAny = trpc as any;
  const createMutation =
    trpcAny?.data?.serviceOrders?.create?.useMutation?.() ??
    trpcAny?.serviceOrders?.create?.useMutation?.();

  const [formData, setFormData] = useState({
    customerId: "",
    title: "",
    description: "",
    priority: "MEDIUM",
    notes: ""
  });

  if (!open) return null;

  const submit = async () => {
    const customerId = parseInt(formData.customerId || "0", 10);
    if (!customerId || !formData.title) return;

    if (!createMutation) {
      // sem rota ainda: fecha modal e pronto (não explode build)
      onClose();
      return;
    }

    await createMutation.mutateAsync({
      customerId,
      title: formData.title,
      description: formData.description ? formData.description : undefined,
      priority: formData.priority,
      notes: formData.notes ? formData.notes : undefined
    });

    onCreated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova OS</h2>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Customer ID"
            value={formData.customerId}
            onChange={(e) => setFormData((s) => ({ ...s, customerId: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Título"
            value={formData.title}
            onChange={(e) => setFormData((s) => ({ ...s, title: e.target.value }))}
          />
          <textarea
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Descrição (opcional)"
            value={formData.description}
            onChange={(e) => setFormData((s) => ({ ...s, description: e.target.value }))}
          />
          <select
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            value={formData.priority}
            onChange={(e) => setFormData((s) => ({ ...s, priority: e.target.value }))}
          >
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
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
            disabled={createMutation?.isPending}
            className="flex-1 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {createMutation?.isPending ? "Salvando..." : "Criar"}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 dark:border-zinc-700">
            Cancelar
          </button>
        </div>

        {createMutation?.error ? <p className="mt-3 text-sm text-red-500">Erro ao criar OS.</p> : null}
      </div>
    </div>
  );
}
