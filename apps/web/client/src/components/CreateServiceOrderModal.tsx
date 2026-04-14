import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/design-system";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ClipboardList,
  CalendarDays,
  Wallet,
  AlertCircle,
  CircleHelp,
  User,
} from "lucide-react";
import { serviceOrderSchema } from "@/lib/validations";
import { registerActionFlowEvent } from "@/lib/actionFlow";
import { useLocation } from "wouter";
import { buildServiceOrdersDeepLink } from "@/lib/operations/operations.utils";
import { useCriticalActionGuard } from "@/hooks/useCriticalActionGuard";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { notify } from "@/stores/notificationStore";

type Props = {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onCreated?: (created?: { id: string; customerId: string }) => void;
  onSuccess?: () => void;
  customers: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
  initialCustomerId?: string | null;
  appointmentId?: string | null;
};

type FormState = {
  customerId: string;
  assignedToPersonId: string;
  title: string;
  description: string;
  priority: string;
  scheduledFor: string;
  amount: string;
  dueDate: string;
};

const INITIAL_FORM: FormState = {
  customerId: "",
  assignedToPersonId: "",
  title: "",
  description: "",
  priority: "2",
  scheduledFor: "",
  amount: "",
  dueDate: "",
};

function parseAmountToCents(raw: string): number | undefined {
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return undefined;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value * 100);
}

function getPriorityLabel(priority: string) {
  switch (priority) {
    case "1":
      return "Muito baixa";
    case "2":
      return "Baixa";
    case "3":
      return "Média";
    case "4":
      return "Alta";
    case "5":
      return "Urgente";
    default:
      return "Baixa";
  }
}

function formatCurrencyFromInput(raw: string) {
  const cents = parseAmountToCents(raw);
  if (!cents) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
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

export default function CreateServiceOrderModal({
  open,
  isOpen,
  onClose,
  onCreated,
  onSuccess,
  customers,
  people,
  initialCustomerId,
  appointmentId,
}: Props) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { track } = useProductAnalytics();
  const resolvedOpen = open ?? isOpen ?? false;
  const [createdServiceOrder, setCreatedServiceOrder] = useState<{
    id: string;
    title: string;
    customerId: string;
  } | null>(null);
  const [formData, setFormData] = useState<FormState>({
    ...INITIAL_FORM,
    customerId: initialCustomerId ? String(initialCustomerId) : "",
  });

  const createMutation = trpc.nexo.serviceOrders.create.useMutation();
  useCriticalActionGuard({
    isPending: createMutation.isPending,
    reason: "Criando O.S. e atualizando cliente, cobrança e timeline.",
  });

  const canSubmit = useMemo(() => {
    return (
      customers.length > 0 &&
      formData.customerId.trim().length > 0 &&
      formData.title.trim().length > 0
    );
  }, [customers.length, formData.customerId, formData.title]);
  const isDirty = useMemo(() => {
    return Object.entries(formData).some(([, value]) => value.trim().length > 0);
  }, [formData]);

  const hasAmount = formData.amount.trim().length > 0;
  const hasDueDate = formData.dueDate.trim().length > 0;

  const selectedCustomerName = useMemo(() => {
    return (
      customers.find((customer) => customer.id === formData.customerId)?.name ??
      "Nenhum cliente selecionado"
    );
  }, [customers, formData.customerId]);

  const selectedPersonName = useMemo(() => {
    if (!formData.assignedToPersonId) return "Ainda não atribuído";

    return (
      people.find((person) => person.id === formData.assignedToPersonId)?.name ??
      "Responsável não encontrado"
    );
  }, [people, formData.assignedToPersonId]);

  const handleClose = () => {
    if (createMutation.isPending) return;
    if (!createdServiceOrder && isDirty && !window.confirm("Existem dados não salvos. Deseja fechar e descartar?")) {
      return;
    }
    setCreatedServiceOrder(null);
    setFormData({
      ...INITIAL_FORM,
      customerId: initialCustomerId ? String(initialCustomerId) : "",
    });
    onClose();
  };

  useEffect(() => {
    if (!resolvedOpen) return;
    setFormData((current) => ({
      ...current,
      customerId: current.customerId || (initialCustomerId ? String(initialCustomerId) : ""),
    }));
  }, [initialCustomerId, resolvedOpen]);

  const submit = async () => {
    const priority = Number(formData.priority);
    if (!Number.isFinite(priority)) {
      toast.error("Prioridade inválida.");
      return;
    }

    const amountCents = parseAmountToCents(formData.amount);

    if (formData.amount.trim() && amountCents === undefined) {
      toast.error("Valor inválido.");
      return;
    }

    const parsed = serviceOrderSchema.safeParse({
      customerId: formData.customerId.trim(),
      assignedToPersonId: formData.assignedToPersonId.trim() || "",
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority,
      scheduledFor: formData.scheduledFor.trim() || "",
      amountCents,
      dueDate: formData.dueDate.trim() || "",
    });

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Dados inválidos para criar a O.S.";
      toast.error(firstError);
      return;
    }

    const payload = {
      customerId: parsed.data.customerId,
      appointmentId: appointmentId ? String(appointmentId) : undefined,
      assignedToPersonId: parsed.data.assignedToPersonId || undefined,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      priority: parsed.data.priority,
      scheduledFor: parsed.data.scheduledFor || undefined,
      amountCents: parsed.data.amountCents,
      dueDate: parsed.data.dueDate || undefined,
    };

    const previousServiceOrders = utils.nexo.serviceOrders.list.getData({ page: 1, limit: 100 });
    const tempId = `temp-os-${Date.now()}`;
    utils.nexo.serviceOrders.list.setData({ page: 1, limit: 100 }, (old: any) => {
      const raw = old as any[] | { data?: any[] } | undefined;
      const optimistic = { id: tempId, ...payload, createdAt: new Date().toISOString() };
      if (Array.isArray(raw)) return [optimistic, ...raw];
      if (raw && Array.isArray(raw.data)) return { ...raw, data: [optimistic, ...raw.data] };
      return [optimistic];
    });

    createMutation.mutate(payload, {
      onSuccess: async (created) => {
        utils.nexo.serviceOrders.list.setData({ page: 1, limit: 100 }, (old: any) => {
          const raw = old as any[] | { data?: any[] } | undefined;
          const applyReplace = (items: any[]) =>
            items.map((item) => (String(item?.id) === tempId ? created : item));
          if (Array.isArray(raw)) return applyReplace(raw);
          if (raw && Array.isArray(raw.data)) return { ...raw, data: applyReplace(raw.data) };
          return [created];
        });
        await invalidateOperationalGraph(
          utils,
          payload.customerId,
          String((created as any)?.id ?? "")
        );
        await utils.dashboard.alerts.invalidate();

        setCreatedServiceOrder({
          id: String((created as any)?.id ?? ""),
          title: String((created as any)?.title ?? payload.title),
          customerId: payload.customerId,
        });
        onCreated?.({
          id: String((created as any)?.id ?? ""),
          customerId: payload.customerId,
        });
        registerActionFlowEvent("service_order_created");
        track("create_service_order", {
          screen: "service-orders",
          serviceOrderId: String((created as any)?.id ?? ""),
          customerId: payload.customerId,
          hasAmount: Boolean(payload.amountCents),
        });
        toast.success(`O.S. criada: ${String((created as any)?.title ?? payload.title)}`, {
          action: {
            label: "Ver O.S.",
            onClick: () =>
              navigate(buildServiceOrdersDeepLink(String((created as any)?.id ?? ""))),
          },
        });
        notify.successPersistent(
          "O.S. criada com sucesso",
          "Próximo passo: gerar a cobrança para transformar execução em receita.",
          {
            label: "Ir para Financeiro",
            onClick: () => navigate(`/finances?serviceOrderId=${String((created as any)?.id ?? "")}`),
          }
        );
      },
      onError: (error) => {
        utils.nexo.serviceOrders.list.setData(
          { page: 1, limit: 100 },
          previousServiceOrders as any
        );
        toast.error(error.message || "Erro ao criar ordem de serviço");
        notify.error(
          "Falha ao criar O.S.",
          "Você pode revisar os dados e tentar novamente sem recarregar a tela.",
          {
            label: "Tentar novamente",
            onClick: () => {
              void submit();
            },
          }
        );
      },
    });
  };

  return (
    <Dialog open={resolvedOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (createMutation.isPending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (createMutation.isPending) event.preventDefault();
        }}
        className="nexo-modal-content max-h-[90vh] max-w-4xl overflow-hidden p-0"
      >
        <DialogHeader className="nexo-modal-header border-b border-[var(--border-subtle)] px-6 py-6">
          <DialogTitle className="flex items-center gap-2 text-xl text-[var(--text-primary)]">
            <ClipboardList className="h-5 w-5 text-orange-500" />
            Nova Ordem de Serviço
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-[var(--text-muted)]">
            Cadastre a execução operacional e, se quiser, já deixe a base financeira preparada.
          </DialogDescription>
        </DialogHeader>

        <div className="nexo-modal-body min-h-0 flex-1 p-6 pb-32">
          {createdServiceOrder ? (
            <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
                Ordem de serviço criada e pronta para o próximo passo
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                <strong>{createdServiceOrder.title}</strong> já está registrada no fluxo operacional.
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Agora você pode abrir a O.S. criada, navegar para o cliente ou criar outro item sem recarregar a página.
              </p>
            </section>
          ) : null}

          {!createdServiceOrder ? (
          <div className="space-y-6">
            {customers.length === 0 ? (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                Você precisa ter ao menos um cliente para criar uma O.S. Cadastre um cliente e volte aqui.
              </section>
            ) : null}
            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={ClipboardList}
                title="Dados operacionais"
                subtitle="Quem é o cliente, qual serviço será feito, quem executa e qual a prioridade."
              />

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Cliente *
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                    value={formData.customerId}
                    onChange={(e) =>
                      setFormData((state) => ({
                        ...state,
                        customerId: e.target.value,
                      }))
                    }
                    disabled={createMutation.isPending}
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    <User className="h-4 w-4 text-gray-500" />
                    Responsável
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                    value={formData.assignedToPersonId}
                    onChange={(e) =>
                      setFormData((state) => ({
                        ...state,
                        assignedToPersonId: e.target.value,
                      }))
                    }
                    disabled={createMutation.isPending}
                  >
                    <option value="">Não atribuir agora</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Se definir agora, a O.S. já nasce atribuída.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Título *
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                    placeholder="Ex: Limpeza pós-obra apartamento 302"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((state) => ({ ...state, title: e.target.value }))
                    }
                    disabled={createMutation.isPending}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Descrição
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                    placeholder="Detalhes do serviço, escopo, observações iniciais ou orientação para a equipe"
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((state) => ({
                        ...state,
                        description: e.target.value,
                      }))
                    }
                    disabled={createMutation.isPending}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Prioridade
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData((state) => ({
                          ...state,
                          priority: e.target.value,
                        }))
                      }
                      disabled={createMutation.isPending}
                    >
                      <option value="1">Muito baixa</option>
                      <option value="2">Baixa</option>
                      <option value="3">Média</option>
                      <option value="4">Alta</option>
                      <option value="5">Urgente</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <CalendarDays className="h-4 w-4 text-gray-500" />
                      Agendada para
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                      value={formData.scheduledFor}
                      onChange={(e) =>
                        setFormData((state) => ({
                          ...state,
                          scheduledFor: e.target.value,
                        }))
                      }
                      disabled={createMutation.isPending}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={Wallet}
                title="Preparação financeira"
                subtitle="Opcional. Você pode já definir valor e vencimento para acelerar a cobrança depois."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Valor (R$)
                  </label>
                  <input
                    inputMode="decimal"
                    className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                    placeholder="Ex: 150,00"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((state) => ({ ...state, amount: e.target.value }))
                    }
                    disabled={createMutation.isPending}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Valor atual: {formatCurrencyFromInput(formData.amount)}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Vencimento
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-gray-300 bg-[var(--surface-elevated)] p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-[var(--border-subtle)] dark:bg-zinc-950 dark:text-white"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData((state) => ({ ...state, dueDate: e.target.value }))
                    }
                    disabled={createMutation.isPending}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">Como isso funciona no fluxo</p>
                    <p>
                      Se você definir um valor agora, a O.S. já fica pronta para caminhar melhor
                      até cobrança e pagamento.
                    </p>
                    {!hasDueDate && hasAmount ? (
                      <p>
                        Como o vencimento está vazio, o backend tende a aplicar um vencimento
                        padrão automaticamente.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-[var(--surface-base)]">
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Resumo antes de criar
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Cliente
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {selectedCustomerName}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Responsável
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
                    {formData.scheduledFor || "Não definido"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Base financeira
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {hasAmount ? formatCurrencyFromInput(formData.amount) : "Ainda sem valor"}
                  </p>
                </div>
              </div>
            </section>
          </div>
          ) : null}
        </div>

        <DialogFooter className="nexo-modal-footer flex gap-2 border-t border-[var(--border-subtle)] p-6 sm:justify-start">
          {createdServiceOrder ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Fechar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreatedServiceOrder(null);
                  setFormData({
                    ...INITIAL_FORM,
                    customerId: initialCustomerId ? String(initialCustomerId) : "",
                  });
                }}
              >
                Criar outra O.S.
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onSuccess?.();
                  navigate(buildServiceOrdersDeepLink(createdServiceOrder.id));
                  handleClose();
                }}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                Ver O.S.
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigate(`/customers?customerId=${createdServiceOrder.customerId}`);
                  handleClose();
                }}
              >
                Ver cliente
              </Button>
            </>
          ) : null}
          {!createdServiceOrder ? (
            <>
          <Button
            onClick={() => void submit()}
            disabled={createMutation.isPending || !canSubmit}
            className="flex-1 bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              "Criar ordem de serviço"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            Cancelar
          </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
