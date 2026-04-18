import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/design-system";
import { Loader2 } from "lucide-react";
import { customerSchema } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { registerActionFlowEvent } from "@/lib/actionFlow";
import ModalFlowShell from "@/components/ModalFlowShell";
import { useCriticalActionGuard } from "@/hooks/useCriticalActionGuard";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { notify } from "@/stores/notificationStore";
import { useLocation } from "wouter";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (createdCustomer?: {
    id?: string | null;
    name?: string;
  }) => Promise<void> | void;
};

export default function CreateCustomerModal({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [nextStep, setNextStep] = useState<
    "schedule" | "message" | "billing" | "only_register"
  >("schedule");
  const [createdCustomer, setCreatedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { track } = useProductAnalytics();
  const createCustomer = trpc.nexo.customers.create.useMutation();

  useCriticalActionGuard({
    isPending: createCustomer.isPending,
    reason: "Salvando cliente e sincronizando contexto operacional.",
  });

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && phone.trim().length >= 10;
  }, [name, phone]);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setNextStep("schedule");
  };

  const hasDraft =
    name.trim().length > 0 ||
    phone.trim().length > 0 ||
    email.trim().length > 0 ||
    notes.trim().length > 0;

  const close = () => {
    if (createCustomer.isPending) return;
    if (
      !createdCustomer &&
      hasDraft &&
      !window.confirm(
        "Existem dados não salvos. Deseja descartar este cadastro?"
      )
    ) {
      return;
    }
    setCreatedCustomer(null);
    reset();
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

    const previousCustomers = utils.nexo.customers.list.getData(undefined);

    try {
      const tempId = `temp-customer-${Date.now()}`;
      const optimisticCustomer = {
        id: tempId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
        active: true,
        createdAt: new Date().toISOString(),
      };

      utils.nexo.customers.list.setData(undefined, (old: any) => {
        const raw = old as { data?: any[] } | any[] | undefined;
        if (Array.isArray(raw)) return [optimisticCustomer, ...raw];
        if (raw && Array.isArray(raw.data))
          return { ...raw, data: [optimisticCustomer, ...raw.data] };
        return [optimisticCustomer];
      });

      const created = await createCustomer.mutateAsync({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || undefined,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : undefined,
      });

      utils.nexo.customers.list.setData(undefined, (old: any) => {
        const raw = old as { data?: any[] } | any[] | undefined;
        const applyReplace = (items: any[]) =>
          items.map(item => (String(item?.id) === tempId ? created : item));

        if (Array.isArray(raw)) return applyReplace(raw);
        if (raw && Array.isArray(raw.data))
          return { ...raw, data: applyReplace(raw.data) };
        return [created];
      });

      const createdId = String((created as any)?.id ?? "").trim();
      const createdName = String((created as any)?.name ?? parsed.data.name);

      toast.success(`Cliente criado: ${createdName}`, {
        action: {
          label:
            nextStep === "schedule"
              ? "Criar agendamento"
              : nextStep === "message"
                ? "Enviar mensagem"
                : nextStep === "billing"
                  ? "Criar cobrança"
                  : "Ver cliente",
          onClick: async () => {
            if (nextStep === "schedule")
              return navigate(
                `/appointments?customerId=${createdId}&source=customer_created`
              );
            if (nextStep === "message")
              return navigate(
                `/whatsapp?customerId=${createdId}&source=customer_created`
              );
            if (nextStep === "billing")
              return navigate(
                `/finances?customerId=${createdId}&source=customer_created`
              );
            await onCreated?.({ id: createdId, name: createdName });
            close();
          },
        },
      });
      notify.successPersistent(
        "Cliente criado e sincronizado",
        nextStep === "schedule"
          ? "Próximo passo escolhido: criar agendamento para manter continuidade."
          : nextStep === "message"
            ? "Próximo passo escolhido: iniciar contato contextual por WhatsApp."
            : nextStep === "billing"
              ? "Próximo passo escolhido: criar cobrança para ativar o fluxo financeiro."
              : "Cadastro concluído. Abra o workspace para seguir com operação.",
        {
          label:
            nextStep === "schedule"
              ? "Abrir agenda"
              : nextStep === "message"
                ? "Abrir WhatsApp"
                : nextStep === "billing"
                  ? "Abrir financeiro"
                  : "Criar O.S.",
          onClick: () => {
            if (nextStep === "schedule")
              return navigate(`/appointments?customerId=${createdId}`);
            if (nextStep === "message")
              return navigate(`/whatsapp?customerId=${createdId}`);
            if (nextStep === "billing")
              return navigate(`/finances?customerId=${createdId}`);
            navigate(`/service-orders?customerId=${createdId}`);
          },
        }
      );

      registerActionFlowEvent("customer_created");
      track("create_customer", {
        screen: "customers",
        customerId: createdId,
        nextStep,
      });
      setCreatedCustomer({ id: createdId, name: createdName });
      reset();
      await invalidateOperationalGraph(utils, createdId);
    } catch (err: any) {
      utils.nexo.customers.list.setData(undefined, previousCustomers as any);
      toast.error("Falha ao criar cliente: " + (err?.message ?? "erro"));
      notify.error(
        "Não foi possível criar o cliente",
        "Confira os dados e tente novamente.",
        {
          label: "Tentar novamente",
          onClick: () => {
            void submit();
          },
        }
      );
    }
  };

  return (
    <ModalFlowShell
      open={open}
      onOpenChange={nextOpen => (nextOpen ? onOpenChange(nextOpen) : close())}
      title="Novo Cliente"
      description="Cadastre um cliente e defina o próximo passo operacional sem sair do fluxo."
      isSubmitting={createCustomer.isPending}
      closeBlocked={createCustomer.isPending}
      hasDirtyState={hasDraft}
      footer={
        createdCustomer ? (
          <>
            <Button type="button" variant="outline" onClick={close}>
              Fechar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreatedCustomer(null)}
            >
              Criar outro
            </Button>
            <Button
              type="button"
              onClick={async () => {
                track("cta_click", {
                  screen: "customers",
                  ctaId: "customer_created_view_customer",
                  target: "customer_workspace",
                });
                await onCreated?.({
                  id: createdCustomer.id,
                  name: createdCustomer.name,
                });
                close();
              }}
            >
              Ver cliente
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                track("cta_click", {
                  screen: "customers",
                  ctaId: "customer_created_go_service_order",
                  target: "service-orders",
                });
                await onCreated?.({
                  id: createdCustomer.id,
                  name: createdCustomer.name,
                });
                navigate(
                  `/service-orders?customerId=${createdCustomer.id}&source=customer_created`
                );
              }}
            >
              Criar O.S.
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={createCustomer.isPending}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={submit}
              disabled={createCustomer.isPending || !canSubmit}
            >
              {createCustomer.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : (
                "Criar cliente e continuar"
              )}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 pb-1">
        {createdCustomer ? (
          <section className="space-y-3 rounded-xl border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface-base))] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Cliente criado com sucesso
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <strong>{createdCustomer.name}</strong> já está pronto para seguir
              no fluxo operacional.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Próximo passo recomendado: abrir o workspace ou iniciar uma O.S.
            </p>
          </section>
        ) : null}

        {!createdCustomer ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nome *</Label>
              <Input
                id="customer-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Cliente Demo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-phone">Telefone / WhatsApp *</Label>
              <Input
                id="customer-phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ex: +5547999999999"
              />
              <p className="text-xs text-[var(--text-muted)]">
                Pode mandar com +55 ou só números. O backend normaliza.
              </p>
              {phone.trim().length >= 10 ? (
                <p className="text-xs text-[var(--accent-primary)]">
                  Número válido para iniciar fluxo de WhatsApp após o cadastro.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="cliente@demo.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-notes">Observações</Label>
              <Textarea
                id="customer-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Informações úteis sobre o cliente"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Próximo passo
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    id: "schedule" as const,
                    label: "Criar agendamento",
                    hint: "Mantém a continuidade da operação na agenda.",
                  },
                  {
                    id: "message" as const,
                    label: "Enviar mensagem inicial",
                    hint: "Inicia contato contextual no WhatsApp.",
                  },
                  {
                    id: "billing" as const,
                    label: "Criar cobrança",
                    hint: "Ativa camada financeira do fluxo.",
                  },
                  {
                    id: "only_register" as const,
                    label: "Apenas cadastrar",
                    hint: "Finaliza cadastro sem próxima ação automática.",
                  },
                ].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setNextStep(option.id)}
                    className={`min-h-[88px] rounded-lg border p-3 text-left transition-colors ${
                      nextStep === option.id
                        ? "border-[var(--accent-primary)] bg-[var(--accent-soft)]/55"
                        : "border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/35"
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {option.label}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {option.hint}
                    </p>
                  </button>
                ))}
              </div>
              {nextStep === "schedule" ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Após criar, vamos preparar o fluxo para abrir agenda.
                </p>
              ) : null}
              {nextStep === "message" ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Após criar, o contato pode seguir direto para o WhatsApp
                  contextual.
                </p>
              ) : null}
              {nextStep === "billing" ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Após criar, já será possível iniciar a cobrança deste cliente.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </ModalFlowShell>
  );
}
