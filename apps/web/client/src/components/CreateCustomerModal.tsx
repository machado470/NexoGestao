import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => Promise<void> | void;
};

export default function CreateCustomerModal({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const createCustomer = trpc.nexo.customers.create.useMutation();

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && phone.trim().length > 0;
  }, [name, phone]);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
  };

  const close = () => {
    onOpenChange(false);
  };

  const submit = async () => {
    if (!canSubmit) {
      toast.error("Nome e telefone são obrigatórios.");
      return;
    }

    try {
      await createCustomer.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().length ? email.trim() : undefined,
      });

      toast.success("Cliente criado com sucesso!");
      reset();
      close();
      await onCreated?.();
    } catch (err: any) {
      toast.error("Falha ao criar cliente: " + (err?.message ?? "erro"));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Novo Cliente
          </h2>
          <button
            type="button"
            onClick={close}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Ex: Cliente Demo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Telefone *
            </label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Ex: +5547999999999"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Dica: pode mandar com +55 ou só números. O backend normaliza.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email (opcional)
            </label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="cliente@demo.com"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={createCustomer.isPending || !canSubmit}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {createCustomer.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              "Criar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
