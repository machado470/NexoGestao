import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, X, UserPlus } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FormData = {
  name: string;
  role: string;
  email: string;
};

const DEFAULT_FORM: FormData = {
  name: "",
  role: "",
  email: "",
};

export default function CreatePersonModal({ open, onClose, onSaved }: Props) {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);

  useEffect(() => {
    if (!open) {
      setFormData(DEFAULT_FORM);
    }
  }, [open]);

  const createPerson = trpc.people.create.useMutation({
    onSuccess: () => {
      toast.success("Pessoa criada com sucesso.");
      setFormData(DEFAULT_FORM);
      onSaved();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar pessoa.");
    },
  });

  if (!open) return null;

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const name = formData.name.trim();
    const role = formData.role.trim();
    const email = formData.email.trim();

    if (!name) {
      toast.error("Informe o nome da pessoa.");
      return;
    }

    if (!role) {
      toast.error("Informe o cargo ou papel da pessoa.");
      return;
    }

    createPerson.mutate({
      name,
      role,
      email: email || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Nova pessoa</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <input
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cargo / Papel</label>
            <input
              value={formData.role}
              onChange={(e) => handleChange("role", e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
              placeholder="Ex: Técnico, Supervisor, Administrativo"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
              placeholder="Ex: pessoa@empresa.com"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={createPerson.isPending}
              className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={createPerson.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {createPerson.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Criar pessoa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
