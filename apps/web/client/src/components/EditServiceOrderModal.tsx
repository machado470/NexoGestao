import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  X,
  Loader2,
  ClipboardList,
  CalendarDays,
  Wallet,
  AlertCircle,
  Pencil,
  Flag,
  User,
} from "lucide-react";
import { serviceOrderEditSchema } from "@/lib/validations";

type ServiceOrderStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELED";

interface EditServiceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  serviceOrderId: string | null;
  people: Array<{ id: string; name: string }>;
}

function parseAmountToCents(raw: string): number | undefined {
  const normalized = raw.replace(",", ".").trim();

  if (!normalized) return undefined;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value * 100);
}

function formatCurrencyFromInput(raw: string) {
  const cents = parseAmountToCents(raw);
  if (!cents) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDateTimePreview(value: string) {
  if (!value) return "Não definido";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "OPEN":
      return "Aberta";
    case "ASSIGNED":
      return "Atribuída";
    case "IN_PROGRESS":
      return "Em andamento";
    case "DONE":
      return "Concluída";
    case "CANCELED":
      return "Cancelada";
    default:
      return status || "—";
  }
}

function getStatusBadgeClass(status?: string) {
  switch (status) {
    case "OPEN":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "ASSIGNED":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "IN_PROGRESS":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "DONE":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "CANCELED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
}

function getPriorityLabel(priority?: number | string | null) {
  switch (Number(priority ?? 2)) {
    case 1:
      return "Muito baixa";
    case 2:
      return "Baixa";
    case 3:
      return "Média";
    case 4:
      return "Alta";
    case 5:
      return "Urgente";
    default:
      return "Baixa";
  }
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="rounded-lg bg-orange-100 p-2 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

export default function EditServiceOrderModal({
  isOpen,
  onClose,
  onSuccess,
  serviceOrderId,
  people,
}: EditServiceOrderModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "2",
    scheduledFor: "",
    assignedToPersonId: "",
    amount: "",
    dueDate: "",
    status: "OPEN" as ServiceOrderStatus,
  });

  const getServiceOrder = trpc.nexo.serviceOrders.getById.useQuery(
    { id: serviceOrderId || "" },
    {
      enabled: isOpen && !!serviceOrderId,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: () => {
      toast.success("Ordem de serviço atualizada com sucesso!");
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar ordem de serviço");
    },
  });

  useEffect(() => {
    if (!getServiceOrder.data) return;

    const payload = getServiceOrder.data as any;
    const serviceOrder = payload?.data ?? payload ?? null;

    setFormData({
      title: serviceOrder?.title || "",
      description: serviceOrder?.description || "",
      priority: String(serviceOrder?.priority ?? 2),
      scheduledFor: serviceOrder?.scheduledFor
        ? new Date(serviceOrder.scheduledFor).toISOString().slice(0, 16)
        : "",
      assignedToPersonId: serviceOrder?.assignedToPersonId || "",
      amount:
        typeof serviceOrder?.amountCents === "number" &&
        Number.isFinite(serviceOrder.amountCents) &&
        serviceOrder.amountCents > 0
          ? (serviceOrder.amountCents / 100).toFixed(2)
          : "",
      dueDate: serviceOrder?.dueDate
        ? new Date(serviceOrder.dueDate).toISOString().slice(0, 16)
        : "",
      status:
        serviceOrder?.status === "OPEN" ||
        serviceOrder?.status === "ASSIGNED" ||
        serviceOrder?.status === "IN_PROGRESS" ||
        serviceOrder?.status === "DONE" ||
        serviceOrder?.status === "CANCELED"
          ? serviceOrder.status
          : "OPEN",
    });
  }, [getServiceOrder.data]);

  const selectedPersonName = useMemo(() => {
    if (!formData.assignedToPersonId) return "Ainda não atribuído";

    return (
      people.find((person) => person.id === formData.assignedToPersonId)?.name ??
      "Responsável não encontrado"
    );
  }, [people, formData.assignedToPersonId]);

  const canAssignOrStart = Boolean(formData.assignedToPersonId);
  const statusOptions = useMemo(() => {
    const base: Array<{ value: ServiceOrderStatus; label: string; disabled?: boolean }> = [
      { value: "OPEN", label: "Aberta" },
      { value: "ASSIGNED", label: "Atribuída", disabled: !canAssignOrStart },
      { value: "IN_PROGRESS", label: "Em andamento", disabled: !canAssignOrStart },
      { value: "DONE", label: "Concluída" },
      { value: "CANCELED", label: "Cancelada" },
    ];

    return base;
  }, [canAssignOrStart]);

  const isCanceled = formData.status === "CANCELED";

  const submitUpdate = async () => {
    if (!serviceOrderId) return;

    const priority = Number(formData.priority);
    if (!Number.isFinite(priority)) {
      toast.error("Prioridade inválida.");
      return;
    }

    if (!formData.assignedToPersonId.trim()) {
      if (formData.status === "ASSIGNED" || formData.status === "IN_PROGRESS") {
        toast.error("Defina um responsável antes de usar esse status.");
        return;
      }
    }

    const amountCents = parseAmountToCents(formData.amount);

    if (formData.amount.trim() && amountCents === undefined) {
      toast.error("Valor inválido.");
      return;
    }

    const parsed = serviceOrderEditSchema.safeParse({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority,
      scheduledFor: formData.scheduledFor.trim() || "",
      status: formData.status,
      assignedToPersonId: formData.assignedToPersonId.trim() || "",
      amountCents,
      dueDate: formData.dueDate.trim() || "",
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dados inválidos";
      toast.error(firstError);
      return;
    }

    await updateServiceOrder.mutateAsync({
      id: serviceOrderId,
      data: {
        title: parsed.data.title,
        description: parsed.data.description || undefined,
        priority: parsed.data.priority,
        scheduledFor: parsed.data.scheduledFor || undefined,
        status: parsed.data.status,
        assignedToPersonId: parsed.data.assignedToPersonId
          ? parsed.data.assignedToPersonId
          : null,
        amountCents: parsed.data.amountCents,
        dueDate: parsed.data.dueDate || undefined,
      },
    });
  };

  if (!isOpen) return null;

  if (getServiceOrder.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  const payload = getServiceOrder.data as any;
  const serviceOrder = payload?.data ?? payload ?? null;
  const persistedIsCanceled = serviceOrder?.status === "CANCELED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between border-b border-gray-200 p-6 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <Pencil className="h-5 w-5 text-orange-500" />
              Editar Ordem de Serviço
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Ajuste dados operacionais, responsável e a base financeira da O.S.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"
            type="button"
            disabled={updateServiceOrder.isPending}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={ClipboardList}
                title="Contexto atual"
                subtitle="Leitura rápida da ordem antes de editar."
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Cliente
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {serviceOrder?.customer?.name || "Cliente não identificado"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Status atual
                  </p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                        serviceOrder?.status
                      )}`}
                    >
                      {getStatusLabel(serviceOrder?.status)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Responsável atual
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {serviceOrder?.assignedTo?.name || "Ainda não atribuído"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Cobrança
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {serviceOrder?.financialSummary?.hasCharge
                      ? "Já vinculada"
                      : "Ainda sem cobrança"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={ClipboardList}
                title="Dados operacionais"
                subtitle="Atualize o que muda no serviço sem sair da tela principal."
              />

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Título *
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((state) => ({ ...state, title: e.target.value }))
                    }
                    disabled={updateServiceOrder.isPending}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Descrição
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((state) => ({
                        ...state,
                        description: e.target.value,
                      }))
                    }
                    disabled={updateServiceOrder.isPending}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Flag className="h-4 w-4 text-gray-500" />
                      Prioridade
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData((state) => ({
                          ...state,
                          priority: e.target.value,
                        }))
                      }
                      disabled={updateServiceOrder.isPending}
                    >
                      <option value="1">Muito baixa</option>
                      <option value="2">Baixa</option>
                      <option value="3">Média</option>
                      <option value="4">Alta</option>
                      <option value="5">Urgente</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Prioridade atual: {getPriorityLabel(formData.priority)}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <CalendarDays className="h-4 w-4 text-gray-500" />
                      Agendada para
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      value={formData.scheduledFor}
                      onChange={(e) =>
                        setFormData((state) => ({
                          ...state,
                          scheduledFor: e.target.value,
                        }))
                      }
                      disabled={updateServiceOrder.isPending}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    <User className="h-4 w-4 text-gray-500" />
                    Responsável
                  </label>
                  <select
                    value={formData.assignedToPersonId}
                    onChange={(e) => {
                      const nextAssignedToPersonId = e.target.value;
                      setFormData((state) => {
                        const nextState = {
                          ...state,
                          assignedToPersonId: nextAssignedToPersonId,
                        };

                        if (
                          !nextAssignedToPersonId &&
                          (state.status === "ASSIGNED" || state.status === "IN_PROGRESS")
                        ) {
                          nextState.status = "OPEN";
                        }

                        return nextState;
                      });
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    disabled={updateServiceOrder.isPending}
                  >
                    <option value="">Remover responsável</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Responsável final: {selectedPersonName}
                  </p>
                </div>

                {!canAssignOrStart ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    Defina um responsável antes de usar os status Atribuída ou Em andamento.
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((state) => ({
                        ...state,
                        status: e.target.value as ServiceOrderStatus,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    disabled={updateServiceOrder.isPending || persistedIsCanceled || isCanceled}
                  >
                    {statusOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={Boolean(option.disabled)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={Wallet}
                title="Base financeira"
                subtitle="Mantenha valor e vencimento alinhados para o fechamento com cobrança."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Valor (R$)
                  </label>
                  <input
                    inputMode="decimal"
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((state) => ({ ...state, amount: e.target.value }))
                    }
                    disabled={updateServiceOrder.isPending}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Valor atual: {formatCurrencyFromInput(formData.amount)}
                  </p>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    <CalendarDays className="h-4 w-4 text-gray-500" />
                    Vencimento
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData((state) => ({ ...state, dueDate: e.target.value }))
                    }
                    disabled={updateServiceOrder.isPending}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Resumo antes de salvar
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Status final
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {getStatusLabel(formData.status)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Responsável final
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {selectedPersonName}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Prioridade
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {getPriorityLabel(formData.priority)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Agendamento previsto
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formatDateTimePreview(formData.scheduledFor)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Base financeira
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formData.amount.trim()
                      ? formatCurrencyFromInput(formData.amount)
                      : "Ainda sem valor"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex gap-2 border-t border-gray-200 p-6 dark:border-zinc-800">
          <Button
            onClick={() => void submitUpdate()}
            disabled={updateServiceOrder.isPending}
            className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
            type="button"
          >
            {updateServiceOrder.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              "Salvar alterações"
            )}
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            type="button"
            disabled={updateServiceOrder.isPending}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
