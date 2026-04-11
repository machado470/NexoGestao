import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/design-system";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { registerActionFlowEvent } from "@/lib/actionFlow";
import { FormModal } from "@/components/app-modal-system";
import { AppField, AppForm, AppSelect } from "@/components/app-system";

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customers: Array<{ id: string | number; name: string }>;
  initialStartsAt?: string;
  initialEndsAt?: string;
}

type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "DONE"
  | "CANCELED"
  | "NO_SHOW";

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
  initialStartsAt,
  initialEndsAt,
}: CreateAppointmentModalProps) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      ...INITIAL_FORM,
      startsAt: initialStartsAt ?? "",
      endsAt: initialEndsAt ?? "",
    });
  }, [initialEndsAt, initialStartsAt, isOpen]);

  const createAppointment = trpc.nexo.appointments.create.useMutation();

  const handleClose = () => {
    if (createAppointment.isPending) return;
    setFormData(INITIAL_FORM);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createAppointment.isPending) return;

    if (!formData.customerId || !formData.startsAt) {
      toast.error("Cliente e data/hora de início são obrigatórios");
      return;
    }

    if (
      formData.endsAt &&
      new Date(formData.endsAt).getTime() <=
        new Date(formData.startsAt).getTime()
    ) {
      toast.error("Data/hora final deve ser maior que a inicial");
      return;
    }

    const payload = {
      customerId: formData.customerId,
      startsAt: formData.startsAt,
      endsAt: formData.endsAt || undefined,
      status: formData.status,
      notes: formData.notes.trim() || undefined,
    };

    const previousAppointments =
      utils.nexo.appointments.list.getData(undefined);
    const tempId = `temp-appointment-${Date.now()}`;
    const selectedCustomer = customers.find(
      item => String(item.id) === payload.customerId
    );

    utils.nexo.appointments.list.setData(undefined, (old: any) => {
      const raw = old as any[] | { data?: any[] } | undefined;
      const optimistic = {
        id: tempId,
        customerId: payload.customerId,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        status: payload.status,
        notes: payload.notes,
        customer: selectedCustomer
          ? { id: String(selectedCustomer.id), name: selectedCustomer.name }
          : undefined,
        createdAt: new Date().toISOString(),
      };
      if (Array.isArray(raw)) return [optimistic, ...raw];
      if (raw && Array.isArray(raw.data))
        return { ...raw, data: [optimistic, ...raw.data] };
      return [optimistic];
    });

    createAppointment.mutate(payload, {
      onSuccess: created => {
        utils.nexo.appointments.list.setData(undefined, (old: any) => {
          const raw = old as any[] | { data?: any[] } | undefined;
          const applyReplace = (items: any[]) =>
            items.map(item => (String(item?.id) === tempId ? created : item));
          if (Array.isArray(raw)) return applyReplace(raw);
          if (raw && Array.isArray(raw.data))
            return { ...raw, data: applyReplace(raw.data) };
          return [created];
        });
        registerActionFlowEvent("appointment_created", {
          pageContext: "appointments",
          ctaPath: "/appointments",
        });
        toast.success("Agendamento criado com sucesso!");
        setFormData(INITIAL_FORM);
        onSuccess();
        onClose();
      },
      onError: error => {
        utils.nexo.appointments.list.setData(
          undefined,
          previousAppointments as any
        );
        toast.error(error.message || "Erro ao criar agendamento");
      },
    });
  };

  return (
    <FormModal
      open={isOpen}
      onOpenChange={nextOpen => (!nextOpen ? handleClose() : undefined)}
      title="Novo Agendamento"
      description="Crie agendamentos com o mesmo padrão visual operacional do app interno."
      closeBlocked={createAppointment.isPending}
      footer={
        <>
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
            form="create-appointment-form"
            disabled={createAppointment.isPending}
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
        </>
      }
    >
      <AppForm id="create-appointment-form" onSubmit={handleSubmit}>
        <AppField label="Cliente *">
          <AppSelect
            value={formData.customerId}
            onValueChange={customerId =>
              setFormData({ ...formData, customerId })
            }
            placeholder="Selecione um cliente"
            options={customers.map(customer => ({
              value: String(customer.id),
              label: customer.name,
            }))}
          />
        </AppField>

        <AppField label="Data/Hora Início *">
          <Input
            type="datetime-local"
            value={formData.startsAt}
            onChange={e =>
              setFormData({ ...formData, startsAt: e.target.value })
            }
          />
        </AppField>

        <AppField label="Data/Hora Fim">
          <Input
            type="datetime-local"
            value={formData.endsAt}
            onChange={e => setFormData({ ...formData, endsAt: e.target.value })}
          />
        </AppField>

        <AppField label="Status">
          <AppSelect
            value={formData.status}
            onValueChange={status =>
              setFormData({ ...formData, status: status as AppointmentStatus })
            }
            options={[
              { value: "SCHEDULED", label: "Agendado" },
              { value: "CONFIRMED", label: "Confirmado" },
              { value: "DONE", label: "Concluído" },
              { value: "CANCELED", label: "Cancelado" },
              { value: "NO_SHOW", label: "Não compareceu" },
            ]}
          />
        </AppField>

        <AppField label="Observações">
          <Textarea
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Observações"
            rows={3}
          />
        </AppField>
      </AppForm>
    </FormModal>
  );
}
