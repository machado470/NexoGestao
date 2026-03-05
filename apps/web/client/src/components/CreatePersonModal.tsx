import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreatePersonModal({ open, onClose, onCreated }: Props) {
  const createPerson = trpc.people.create.useMutation();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  if (!open) return null;

  const submit = async () => {
    if (!name.trim()) return;

    try {
      await createPerson.mutateAsync({ name: name.trim(), role: role.trim() || 'Colaborador' });
      onCreated?.();
      onClose();
    } catch (error: unknown) {
      // mantém strict happy
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova Pessoa</h2>
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
          <button
            onClick={submit}
            disabled={createPerson.isPending}
            className="flex-1 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {createPerson.isPending ? "Salvando..." : "Criar"}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 dark:border-zinc-700">
            Cancelar
          </button>
        </div>

        {createPerson.error ? <p className="mt-3 text-sm text-red-500">Erro ao criar pessoa.</p> : null}
      </div>
    </div>
  );
}
