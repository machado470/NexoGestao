import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { customerSchema } from "@/lib/validations";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => Promise<void> | void;
};

export default function CreateCustomerModal({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const createCustomer = trpc.nexo.customers.create.useMutation();

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && phone.trim().length >= 10;
  }, [name, phone]);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
  };

  const close = () => {
    onOpenChange(false);
  };

  const submit = async () => {
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

    try {
      await createCustomer.mutateAsync({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || undefined,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : undefined,
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

      <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Novo Cliente
          </h2>

          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="space-y-4 p-5">
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
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Pode mandar com +55 ou só números. O backend normaliza.
            </p>
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
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={submit}
            disabled={createCustomer.isPending || !canSubmit}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {createCustomer.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
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
