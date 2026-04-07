import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  const handleClose = () => {
    if (updateMutation.isPending) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : undefined)}>
      <DialogContent className="max-w-2xl border-zinc-800/80 bg-zinc-950/95 p-0 text-zinc-100 shadow-2xl backdrop-blur">
        <DialogHeader className="border-b border-zinc-800/90 px-6 py-5">
          <DialogTitle className="text-xl font-semibold">Editar Cliente</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Atualize os dados mantendo consistência com o padrão visual moderno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {customerQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-orange-500" />
              Carregando...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-customer-name">Nome *</Label>
                <Input
                  id="edit-customer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-zinc-700 bg-zinc-900/80"
                  placeholder="Ex: Cliente Demo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-customer-phone">Telefone / WhatsApp *</Label>
                <Input
                  id="edit-customer-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border-zinc-700 bg-zinc-900/80"
                  placeholder="Ex: +5547999999999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-customer-email">Email</Label>
                <Input
                  id="edit-customer-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-zinc-700 bg-zinc-900/80"
                  placeholder="cliente@demo.com"
                  type="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-customer-notes">Observações</Label>
                <Textarea
                  id="edit-customer-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border-zinc-700 bg-zinc-900/80"
                  placeholder="Informações úteis sobre o cliente"
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Cliente ativo</p>
                  <p className="text-xs text-zinc-400">Desative para tirar o cliente do fluxo sem apagar histórico.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setActive((prev) => !prev)}
                  className={`inline-flex min-w-[88px] items-center justify-center rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                    active ? "bg-green-900/40 text-green-300" : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {active ? "Ativo" : "Inativo"}
                </button>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-zinc-800/90 px-6 py-4">
          <Button type="button" variant="outline" onClick={handleClose}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
