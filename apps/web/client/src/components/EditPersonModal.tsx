import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  personId?: string | number | null;
  onClose: () => void;
  onSaved?: () => void;
};

export default function EditPersonModal({ open, personId, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (!open) return;
    // placeholder: quando existir people.getById + people.update, liga aqui
    setName("");
    setRole("");
  }, [open, personId]);

  if (!open) return null;

  const submit = async () => {
    // placeholder: quando existir update, chama aqui
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar Pessoa</h2>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Função (opcional)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={submit} className="flex-1 rounded-lg bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
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
