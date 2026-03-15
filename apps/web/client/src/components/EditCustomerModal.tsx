import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerSchema } from "@/lib/validations";

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
  const [active, setActive] = useState(true);

  const idStr = customerId != null ? String(customerId) : undefined;

  const customerQuery = trpc.nexo.customers.getById.useQuery(
    { id: idStr! },
    {
      enabled: open && !!idStr,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const updateMutation = trpc.nexo.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      onSaved?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar cliente");
    },
  });

  const customer = useMemo(() => {
    return (customerQuery.data as any)?.data ?? customerQuery.data ?? null;
  }, [customerQuery.data]);

  useEffect(() => {
    if (!open) return;

    if (customer) {
      setName(customer.name ?? "");
      setPhone(customer.phone ?? "");
      setEmail(customer.email ?? "");
      setNotes(customer.notes ?? "");
      setActive(Boolean(customer.active));
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setActive(true);
  }, [open, customer]);

  const submit = async () => {
    if (!idStr) return;

    const parsed = customerSchema.safeParse({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      toast.error(firstError);
      return;
    }

    updateMutation.mutate({
      id: idStr,
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || undefined,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : undefined,
        active,
      },
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Editar Cliente
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {customerQuery.isLoading ? (
            <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-orange-500" />
              Carregando...
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nome *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Cliente Demo"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Telefone / WhatsApp *
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: +5547999999999"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="cliente@demo.com"
                  type="email"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Observações
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Informações úteis sobre o cliente"
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Cliente ativo
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Desative para tirar o cliente do fluxo sem apagar histórico.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActive((prev) => !prev)}
                  className={`inline-flex min-w-[88px] items-center justify-center rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                  }`}
                >
                  {active ? "Ativo" : "Inativo"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={submit}
            disabled={updateMutation.isPending || customerQuery.isLoading}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {updateMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
