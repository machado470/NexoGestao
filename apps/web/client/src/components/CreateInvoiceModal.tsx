import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateInvoiceModal({ open, onClose, onCreated }: Props) {
  const createMutation = trpc.invoices.create.useMutation();

  const [formData, setFormData] = useState({
    customerId: "",
    invoiceNumber: "",
    amount: "",
    issueDate: "",
    dueDate: "",
    notes: "",
  });

  if (!open) return null;

  const submit = async () => {
    const customerId = parseInt(formData.customerId || "0", 10);
    const amount = parseFloat(formData.amount || "0");
    if (!customerId || !formData.invoiceNumber || !amount || !formData.issueDate || !formData.dueDate) return;

    await createMutation.mutateAsync({
      customerId,
      number: formData.invoiceNumber, // ✅ backend espera "number"
      amount,
      issueDate: new Date(formData.issueDate),
      dueDate: new Date(formData.dueDate),
      notes: formData.notes ? formData.notes : undefined,
      status: "DRAFT",
    });

    onCreated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova Fatura</h2>
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
            placeholder="Número"
            value={formData.invoiceNumber}
            onChange={(e) => setFormData((s) => ({ ...s, invoiceNumber: e.target.value }))}
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
            value={formData.issueDate}
            onChange={(e) => setFormData((s) => ({ ...s, issueDate: e.target.value }))}
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
          <p className="mt-3 text-sm text-red-500">Erro ao criar fatura.</p>
        ) : null}
      </div>
    </div>
  );
}
