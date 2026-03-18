import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Pencil, Save, X } from "lucide-react";

type Props = {
  open: boolean;
  personId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

type PersonDetails = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  active: boolean;
};

type FormData = {
  name: string;
  role: string;
  email: string;
  active: boolean;
};

const DEFAULT_FORM: FormData = {
  name: "",
  role: "",
  email: "",
  active: true,
};

function normalizePersonPayload(payload: unknown): PersonDetails | null {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<PersonDetails>;

  return {
    id: typeof candidate.id === "string" ? candidate.id : "",
    name: typeof candidate.name === "string" ? candidate.name : "",
    role: typeof candidate.role === "string" ? candidate.role : null,
    email: typeof candidate.email === "string" ? candidate.email : null,
    active: candidate.active === false ? false : true,
  };
}

function buildForm(person: PersonDetails | null): FormData {
  if (!person) {
    return DEFAULT_FORM;
  }

  return {
    name: person.name || "",
    role: person.role || "",
    email: person.email || "",
    active: person.active !== false,
  };
}

function formsAreEqual(a: FormData, b: FormData) {
  return (
    a.name.trim() === b.name.trim() &&
    a.role.trim() === b.role.trim() &&
    a.email.trim() === b.email.trim() &&
    a.active === b.active
  );
}

export default function EditPersonModal({
  open,
  personId,
  onClose,
  onSaved,
}: Props) {
  const canLoad = open && Boolean(personId);

  const personQuery = trpc.people.getById.useQuery(
    { id: String(personId) },
    {
      enabled: canLoad,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const personData = useMemo(() => {
    return normalizePersonPayload(personQuery.data);
  }, [personQuery.data]);

  const initialForm = useMemo(() => {
    return buildForm(personData);
  }, [personData]);

  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);

  useEffect(() => {
    if (open) {
      setFormData(initialForm);
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [open, initialForm]);

  const hasChanges = useMemo(() => {
    return !formsAreEqual(formData, initialForm);
  }, [formData, initialForm]);

  const updatePerson = trpc.people.update.useMutation({
    onSuccess: () => {
      toast.success("Pessoa atualizada com sucesso.");
      onSaved();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar pessoa.");
    },
  });

  if (!open) return null;

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!personId) {
      toast.error("Pessoa inválida.");
      return;
    }

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

    if (!hasChanges) {
      toast.message("Nenhuma alteração para salvar.");
      return;
    }

    updatePerson.mutate({
      id: String(personId),
      name,
      role,
      email: email || undefined,
      active: formData.active,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Editar pessoa</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {personQuery.isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : personQuery.isError || !personData ? (
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              Não foi possível carregar os dados da pessoa.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <input
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                placeholder="Nome da pessoa"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cargo / Papel</label>
              <input
                value={formData.role}
                onChange={(e) => handleChange("role", e.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                placeholder="Cargo ou papel"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                placeholder="Email"
              />
            </div>

            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm dark:border-zinc-800">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => handleChange("active", e.target.checked)}
              />
              Pessoa ativa
            </label>

            <div className="flex items-center justify-between border-t pt-4 dark:border-zinc-800">
              <span className="text-xs text-muted-foreground">
                {hasChanges ? "Alterações pendentes" : "Nada para salvar"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(initialForm)}
                  disabled={!hasChanges || updatePerson.isPending}
                  className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  Descartar
                </button>

                <button
                  type="submit"
                  disabled={updatePerson.isPending || !hasChanges}
                  className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {updatePerson.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
