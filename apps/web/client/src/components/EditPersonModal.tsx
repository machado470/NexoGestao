import { emptyPersonForm, initialPersonEditSession, personEditSessionReducer, type PersonEditValues } from "@/lib/person-edit-session";
import { parsePlannedCapacityInput } from "@/lib/planned-capacity-input";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { FormModal } from "@/components/app-modal-system";
import {
  AppCheckbox,
  AppErrorState,
  AppField,
  AppFieldGroup,
  AppForm,
  AppInput,
  AppLoadingState,
  AppTextarea,
} from "@/components/app-system";
import { Button } from "@/components/ui/button";
import {
  getConcurrencyErrorMessage,
  isConcurrentConflictError,
} from "@/lib/concurrency";
import { trpc } from "@/lib/trpc";

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
  updatedAt: string | null;
  dailyServiceOrderCapacity: number | null;
  dailyAppointmentCapacity: number | null;
  workloadNotes: string | null;
};

type FormData = PersonEditValues;
const DEFAULT_FORM = emptyPersonForm;

function normalizePersonPayload(payload: unknown): PersonDetails | null {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Partial<PersonDetails>;

  return {
    id: typeof candidate.id === "string" ? candidate.id : "",
    name: typeof candidate.name === "string" ? candidate.name : "",
    role: typeof candidate.role === "string" ? candidate.role : null,
    email: typeof candidate.email === "string" ? candidate.email : null,
    active: candidate.active === false ? false : true,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    dailyServiceOrderCapacity:
      typeof candidate.dailyServiceOrderCapacity === "number"
        ? candidate.dailyServiceOrderCapacity
        : null,
    dailyAppointmentCapacity:
      typeof candidate.dailyAppointmentCapacity === "number"
        ? candidate.dailyAppointmentCapacity
        : null,
    workloadNotes:
      typeof candidate.workloadNotes === "string"
        ? candidate.workloadNotes
        : null,
  };
}

function buildForm(person: PersonDetails | null): FormData {
  if (!person) return DEFAULT_FORM;

  return {
    name: person.name || "",
    role: person.role || "",
    email: person.email || "",
    active: person.active !== false,
    dailyServiceOrderCapacity:
      person.dailyServiceOrderCapacity?.toString() ?? "",
    dailyAppointmentCapacity:
      person.dailyAppointmentCapacity?.toString() ?? "",
    workloadNotes: person.workloadNotes ?? "",
  };
}

function formsAreEqual(a: FormData, b: FormData) {
  return (
    a.name.trim() === b.name.trim() &&
    a.role.trim() === b.role.trim() &&
    a.email.trim() === b.email.trim() &&
    a.active === b.active &&
    a.dailyServiceOrderCapacity === b.dailyServiceOrderCapacity &&
    a.dailyAppointmentCapacity === b.dailyAppointmentCapacity &&
    a.workloadNotes.trim() === b.workloadNotes.trim()
  );
}

export default function EditPersonModal({
  open,
  personId,
  onClose,
  onSaved,
}: Props) {
  const utils = trpc.useUtils();
  const canLoad = open && Boolean(personId);

  const personQuery = trpc.people.getById.useQuery(
    { id: String(personId) },
    {
      enabled: canLoad,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const personData = useMemo(
    () => normalizePersonPayload(personQuery.data),
    [personQuery.data]
  );

  const [session, dispatch] = useReducer(personEditSessionReducer, initialPersonEditSession);
  const formData = session.values;
  const initialForm = session.initial;
  const current = useRef({ open, personId });
  if (current.current.open !== open || current.current.personId !== personId) current.current = { open, personId };
  useEffect(() => {
    if (!open || !personId) dispatch({ type: "closed" });
    else if (personData) dispatch({ type: "received", id: personId, version: personData.updatedAt ?? undefined, values: buildForm(personData) });
  }, [open, personId, personData]);

  const hasChanges = useMemo(
    () => !formsAreEqual(formData, initialForm),
    [formData, initialForm]
  );

  const updatePerson = trpc.people.update.useMutation({
    onSuccess: saved => {
      utils.people.getById.setData({ id: String(personId) }, saved);
      toast.success("Pessoa atualizada com sucesso.");
      onSaved();
      onClose();
    },
    onError: error => {
      if (isConcurrentConflictError(error)) {
        toast.error(getConcurrencyErrorMessage("cadastro da pessoa"), {
          action: {
            label: "Recarregar",
            onClick: () => void reloadPerson(),
          },
        });
        return;
      }

      toast.error(error.message || "Erro ao atualizar pessoa.");
    },
  });

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    dispatch({ type: "edit", values: { [field]: value } });
  };

  const reloadPerson = async () => {
    if (updatePerson.isPending || personQuery.isFetching) return;
    if (hasChanges && !window.confirm("Recarregar descartará suas alterações não salvas. Deseja continuar?")) return;
    const requestSession = current.current;
    const result = await personQuery.refetch();
    if (current.current !== requestSession || !current.current.open || current.current.personId !== personId) return;
    const latest = normalizePersonPayload(result.data);
    if (result.isError || !latest) { toast.error("Não foi possível recarregar. Suas alterações foram preservadas."); return; }
    dispatch({ type: "reload", id: String(personId), version: latest.updatedAt ?? undefined, values: buildForm(latest) });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!personId) {
      toast.error("Pessoa inválida.");
      return;
    }

    const name = formData.name.trim();
    const role = formData.role.trim();
    const email = formData.email.trim();
    const serviceCapacity = parsePlannedCapacityInput(formData.dailyServiceOrderCapacity, initialForm.dailyServiceOrderCapacity ? Number(initialForm.dailyServiceOrderCapacity) : null);
    const appointmentCapacity = parsePlannedCapacityInput(formData.dailyAppointmentCapacity, initialForm.dailyAppointmentCapacity ? Number(initialForm.dailyAppointmentCapacity) : null);
    if (!serviceCapacity.ok || !appointmentCapacity.ok) {
      toast.error("Informe capacidades inteiras de 1 a 100. Capacidades já definidas não podem ficar vazias.");
      return;
    }
    const dailyServiceOrderCapacity = serviceCapacity.value;
    const dailyAppointmentCapacity = appointmentCapacity.value;

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
      dailyServiceOrderCapacity,
      dailyAppointmentCapacity,
      workloadNotes: formData.workloadNotes.trim() || null,
      expectedUpdatedAt: session.version,
    });
  };

  const unavailable = session.id !== personId || !personData;

  return (
    <FormModal
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
      size="md"
      closeBlocked={updatePerson.isPending}
      title={
        <span className="flex items-center gap-2">
          <Pencil className="h-5 w-5 text-[var(--accent-primary)]" />
          Editar pessoa
        </span>
      }
      description="Atualize cadastro e capacidade planejada da pessoa."
      footer={
        personQuery.isLoading || unavailable ? (
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <span className="mr-auto text-xs text-[var(--text-muted)]">
              {hasChanges ? "Alterações pendentes" : "Nada para salvar"}
            </span>

            <Button type="button" variant="outline" disabled={updatePerson.isPending || personQuery.isFetching} onClick={() => void reloadPerson()}>Recarregar dados</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => dispatch({ type: "discard" })}
              disabled={!hasChanges || updatePerson.isPending}
            >
              Descartar
            </Button>

            <Button
              type="submit"
              form="edit-person-form"
              disabled={updatePerson.isPending || !hasChanges}
              className="inline-flex items-center gap-2"
            >
              {updatePerson.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </>
        )
      }
    >
      {personQuery.isLoading ? (
        <AppLoadingState label="Carregando dados da pessoa..." />
      ) : unavailable ? (
        <AppErrorState message="Não foi possível carregar os dados da pessoa." />
      ) : (
        <AppForm id="edit-person-form" onSubmit={handleSubmit}>
          {personQuery.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível atualizar os dados. Suas alterações foram preservadas.</p> : null}
          <AppField label="Nome" htmlFor="edit-person-name">
            <AppInput
              id="edit-person-name"
              value={formData.name}
              onChange={event => handleChange("name", event.target.value)}
              placeholder="Nome da pessoa"
            />
          </AppField>

          <AppField label="Cargo / Papel" htmlFor="edit-person-role">
            <AppInput
              id="edit-person-role"
              value={formData.role}
              onChange={event => handleChange("role", event.target.value)}
              placeholder="Cargo ou papel"
            />
          </AppField>

          <AppField label="Email" htmlFor="edit-person-email">
            <AppInput
              id="edit-person-email"
              type="email"
              value={formData.email}
              onChange={event => handleChange("email", event.target.value)}
              placeholder="Email"
            />
          </AppField>

          <AppFieldGroup>
            <AppField
              label="Capacidade diária de O.S."
              htmlFor="edit-person-service-order-capacity"
              hint="Informe um inteiro de 1 a 100. Uma capacidade definida não pode ficar vazia."
            >
              <AppInput
                id="edit-person-service-order-capacity"
                type="number"
                step="1"
                min="1"
                max="100"
                value={formData.dailyServiceOrderCapacity}
                onChange={event =>
                  handleChange("dailyServiceOrderCapacity", event.target.value)
                }
                placeholder="Não configurada"
              />
            </AppField>

            <AppField
              label="Capacidade diária de agendamentos"
              htmlFor="edit-person-appointment-capacity"
              hint="Informe um inteiro de 1 a 100. Uma capacidade definida não pode ficar vazia."
            >
              <AppInput
                id="edit-person-appointment-capacity"
                type="number"
                step="1"
                min="1"
                max="100"
                value={formData.dailyAppointmentCapacity}
                onChange={event =>
                  handleChange("dailyAppointmentCapacity", event.target.value)
                }
                placeholder="Não configurada"
              />
            </AppField>
          </AppFieldGroup>

          <AppField
            label="Nota operacional"
            htmlFor="edit-person-workload-notes"
          >
            <AppTextarea
              id="edit-person-workload-notes"
              maxLength={500}
              value={formData.workloadNotes}
              onChange={event =>
                handleChange("workloadNotes", event.target.value)
              }
              placeholder="Contexto opcional sobre a capacidade planejada"
            />
          </AppField>

          <AppField label="Situação cadastral">
            <label className="flex items-center gap-2 rounded-lg border border-[var(--modal-section-border)] bg-[var(--modal-section-bg)] p-3 text-sm">
              <AppCheckbox
                checked={formData.active}
                onCheckedChange={checked =>
                  handleChange("active", checked === true)
                }
              />
              Pessoa ativa
            </label>
          </AppField>
        </AppForm>
      )}
    </FormModal>
  );
}
