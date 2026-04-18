import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/design-system";
import { Loader2 } from "lucide-react";
import { serviceOrderSchema } from "@/lib/validations";
import { registerActionFlowEvent } from "@/lib/actionFlow";
import { useLocation } from "wouter";
import { buildServiceOrdersDeepLink } from "@/lib/operations/operations.utils";
import { useCriticalActionGuard } from "@/hooks/useCriticalActionGuard";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { notify } from "@/stores/notificationStore";
import { FormModal } from "@/components/app-modal-system";
import {
  AppField,
  AppFieldGroup,
  AppForm,
  AppInlineHint,
  AppInput,
  AppSelect,
  AppTextarea,
} from "@/components/app-system";

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

function formatCurrencyFromInput(raw: string) {
  const cents = parseAmountToCents(raw);
  if (!cents) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
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
    <FormModal
      open={resolvedOpen}
      onOpenChange={(open) => (!open ? handleClose() : undefined)}
      title="Nova O.S."
      description="Registre a ordem de serviço no padrão operacional dos modais internos."
      closeBlocked={createMutation.isPending}
      size="lg"
      footer={
        <>
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
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={createMutation.isPending || !canSubmit}
              >
                {createMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </span>
                ) : (
                  "Criar O.S."
                )}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      {createdServiceOrder ? (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Ordem de serviço criada com sucesso
          </h3>
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            <strong>{createdServiceOrder.title}</strong> já está registrada no fluxo operacional.
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Você pode abrir a O.S., ir para o cliente ou criar uma nova sem sair da tela.
          </p>
        </section>
      ) : null}

      {!createdServiceOrder ? (
        <AppForm id="create-service-order-form">
          {customers.length === 0 ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              Você precisa ter ao menos um cliente para criar uma O.S. Cadastre um cliente e volte aqui.
            </section>
          ) : null}

          <AppField label="Cliente *">
            <AppSelect
              value={formData.customerId}
              onValueChange={(customerId) =>
                setFormData((state) => ({ ...state, customerId }))
              }
              placeholder="Selecione um cliente"
              options={customers.map((customer) => ({
                value: customer.id,
                label: customer.name,
              }))}
            />
          </AppField>

          <AppField label="Responsável pela execução">
            <div className="space-y-1.5">
              <AppSelect
                value={formData.assignedToPersonId || undefined}
                onValueChange={(assignedToPersonId) =>
                  setFormData((state) => ({ ...state, assignedToPersonId }))
                }
                placeholder="Selecione um colaborador"
                options={people.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
              />
              {formData.assignedToPersonId ? (
                <button
                  type="button"
                  className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  onClick={() =>
                    setFormData((state) => ({ ...state, assignedToPersonId: "" }))
                  }
                >
                  Limpar responsável
                </button>
              ) : null}
            </div>
          </AppField>

          <AppField label="Serviço que será feito *">
            <AppInput
              placeholder="Ex: Manutenção elétrica no quadro do condomínio"
              value={formData.title}
              onChange={(e) =>
                setFormData((state) => ({ ...state, title: e.target.value }))
              }
              disabled={createMutation.isPending}
            />
          </AppField>

          <AppField label="Detalhes para a equipe">
            <AppTextarea
              placeholder="Ex: Levar escada, trocar disjuntor e testar iluminação da área comum."
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData((state) => ({ ...state, description: e.target.value }))
              }
              disabled={createMutation.isPending}
            />
          </AppField>

          <AppFieldGroup>
            <AppField label="Prioridade">
              <AppSelect
                value={formData.priority}
                onValueChange={(priority) =>
                  setFormData((state) => ({ ...state, priority }))
                }
                options={[
                  { value: "1", label: "Bem baixa" },
                  { value: "2", label: "Baixa" },
                  { value: "3", label: "Normal" },
                  { value: "4", label: "Alta" },
                  { value: "5", label: "Urgente hoje" },
                ]}
              />
            </AppField>

            <AppField label="Agendada para">
              <AppInput
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) =>
                  setFormData((state) => ({ ...state, scheduledFor: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </AppField>
          </AppFieldGroup>

          <AppFieldGroup>
            <AppField label="Valor (R$)">
              <AppInput
                inputMode="decimal"
                placeholder="Ex: 890,00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((state) => ({ ...state, amount: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
              <AppInlineHint>
                Valor atual: {formatCurrencyFromInput(formData.amount)}
              </AppInlineHint>
            </AppField>

            <AppField label="Vencimento">
              <AppInput
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData((state) => ({ ...state, dueDate: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </AppField>
          </AppFieldGroup>

          {hasAmount ? (
            <p className="text-xs text-[var(--text-muted)]">
              Se o vencimento ficar vazio, o backend pode definir um padrão automático.
            </p>
          ) : null}
        </AppForm>
      ) : null}
    </FormModal>
  );
}
