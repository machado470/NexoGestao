import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customers: Array<{ id: string | number; name: string }>;
}

type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "DONE" | "CANCELED" | "NO_SHOW";

const INITIAL_FORM = {
  customerId: "",
  startsAt: "",
  endsAt: "",
  status: "SCHEDULED" as AppointmentStatus,
  notes: "",
};

export function CreateAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  customers,
}: CreateAppointmentModalProps) {
  const [formData, setFormData] = useState(INITIAL_FORM);

  const createAppointment = trpc.nexo.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      setFormData(INITIAL_FORM);
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar agendamento");
    },
  });

  const handleClose = () => {
    if (createAppointment.isPending) return;
    setFormData(INITIAL_FORM);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId || !formData.startsAt) {
      toast.error("Cliente e data/hora de início são obrigatórios");
      return;
    }

    if (
      formData.endsAt &&
      new Date(formData.endsAt).getTime() <= new Date(formData.startsAt).getTime()
    ) {
      toast.error("Data/hora final deve ser maior que a inicial");
      return;
    }

    createAppointment.mutate({
      customerId: formData.customerId,
      startsAt: formData.startsAt,
      endsAt: formData.endsAt || undefined,
      status: formData.status,
      notes: formData.notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : undefined)}>
      <DialogContent className="max-w-xl border-zinc-800/80 bg-zinc-950/95 p-0 text-zinc-100 shadow-2xl backdrop-blur">
        <DialogHeader className="border-b border-zinc-800/90 px-6 py-5">
          <DialogTitle className="text-xl font-semibold">Novo Agendamento</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Agende compromissos no mesmo padrão visual das páginas modernas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <select
              value={formData.customerId}
              onChange={(e) =>
                setFormData({ ...formData, customerId: e.target.value })
              }
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-offset-zinc-950 focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500/50"
            >
              <option value="">Selecione um cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Data/Hora Início *</Label>
            <Input
              type="datetime-local"
              value={formData.startsAt}
              onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
              className="border-zinc-700 bg-zinc-900/80"
            />
          </div>

          <div className="space-y-2">
            <Label>Data/Hora Fim</Label>
            <Input
              type="datetime-local"
              value={formData.endsAt}
              onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
              className="border-zinc-700 bg-zinc-900/80"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as AppointmentStatus,
                })
              }
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-offset-zinc-950 focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500/50"
            >
              <option value="SCHEDULED">Agendado</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="DONE">Concluído</option>
              <option value="CANCELED">Cancelado</option>
              <option value="NO_SHOW">Não compareceu</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="border-zinc-700 bg-zinc-900/80"
              placeholder="Observações"
              rows={3}
            />
          </div>

          <DialogFooter className="border-t border-zinc-800/90 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createAppointment.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createAppointment.isPending}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {createAppointment.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Agendamento"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
