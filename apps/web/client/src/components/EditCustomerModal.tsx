import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  customerId?: string | number | null;
  onClose: () => void;
  onSaved?: () => void;
};

export default function EditCustomerModal({ open, customerId, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const idStr = customerId != null ? String(customerId) : undefined;

  const customerQuery = trpc.nexo.customers.getById.useQuery(
    { id: idStr! },
    { enabled: open && !!idStr }
  );

  const updateMutation = trpc.nexo.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      onSaved?.();
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar cliente"),
  });

  useEffect(() => {
    if (!open) return;
    const c = (customerQuery.data as any)?.data ?? customerQuery.data;
    if (c) {
      setName(c.name ?? "");
      setPhone(c.phone ?? "");
      setEmail(c.email ?? "");
      setNotes(c.notes ?? "");
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
    }
  }, [open, customerId, customerQuery.data]);

  if (!open) return null;

  const submit = async () => {
    if (!idStr) return;
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateMutation.mutate({
      id: idStr,
      data: {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar Cliente</h2>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">
            Fechar
          </button>
        </div>

        {customerQuery.isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="ml-2 text-sm text-gray-500">Carregando...</span>
          </div>
        )}

        <div className="space-y-3">
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Nome *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Telefone (WhatsApp)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <textarea
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Observações"
            value={notes}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={submit}
            disabled={updateMutation.isPending}
            className="flex-1 rounded-lg bg-black px-4 py-2 text-white dark:bg-white dark:text-black flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 dark:border-zinc-700">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
