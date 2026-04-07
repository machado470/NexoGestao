import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { customerSchema } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
    if (createCustomer.isPending) return;
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

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(nextOpen) : close())}>
      <DialogContent className="max-w-2xl border-zinc-800/80 bg-zinc-950/95 p-0 text-zinc-100 shadow-2xl backdrop-blur">
        <DialogHeader className="border-b border-zinc-800/90 px-6 py-5">
          <DialogTitle className="text-xl font-semibold">Novo Cliente</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Cadastre um cliente mantendo os dados alinhados ao padrão do shell executivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nome *</Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-zinc-700 bg-zinc-900/80"
              placeholder="Ex: Cliente Demo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Telefone / WhatsApp *</Label>
            <Input
              id="customer-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border-zinc-700 bg-zinc-900/80"
              placeholder="Ex: +5547999999999"
            />
            <p className="text-xs text-zinc-500">Pode mandar com +55 ou só números. O backend normaliza.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-zinc-700 bg-zinc-900/80"
              placeholder="cliente@demo.com"
              type="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-notes">Observações</Label>
            <Textarea
              id="customer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border-zinc-700 bg-zinc-900/80"
              placeholder="Informações úteis sobre o cliente"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-zinc-800/90 px-6 py-4">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
