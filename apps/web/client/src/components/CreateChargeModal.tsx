import { createChargeCreationAttempt } from "@/lib/charge-creation-attempt";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { parseLocalDateTimeInput } from "@/lib/local-date-time";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { parseMoneyInputToCents as parseAmountToCents } from "@/lib/money-input";
import { Button } from "@/components/ui/button";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { chargeSchema } from "@/lib/validations";
import { registerActionFlowEvent } from "@/lib/actionFlow";
import { useCriticalActionGuard } from "@/hooks/useCriticalActionGuard";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { notify } from "@/stores/notificationStore";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { resolveOperationFeedback } from "@/lib/operations/operation-feedback";
import { FormModal } from "@/components/app-modal-system";

interface CreateChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  returnFocusFallback?: string;
  onSuccess: () => void;
  initialCustomerId?: string | null;
}

type ChargeMode = "MANUAL" | "RECURRING" | "SERVICE";
type PostCreateAction =
  | "CREATE_ONLY"
  | "CREATE_AND_CHARGE"
  | "CREATE_AND_TRACK";

type FormState = {
  mode: ChargeMode;
  customerId: string;
  amount: string;
  dueDate: string;
  notes: string;
  serviceReference: string;
  postAction: PostCreateAction;
};

const INITIAL_FORM: FormState = {
  mode: "MANUAL",
  customerId: "",
  amount: "",
  dueDate: "",
  notes: "",
  serviceReference: "",
  postAction: "CREATE_ONLY",
};

function initialChargeForm(customerId?: string | null): FormState {
  return { ...INITIAL_FORM, customerId: customerId ?? "" };
}

const chargeModeLabels: Record<ChargeMode, string> = {
  MANUAL: "Cobrança manual",
  RECURRING: "Recorrência (indisponível)",
  SERVICE: "Ligada a serviço",
};

const postActionLabels: Record<PostCreateAction, string> = {
  CREATE_ONLY: "Apenas criar",
  CREATE_AND_CHARGE: "Criar e cobrar agora",
  CREATE_AND_TRACK: "Criar e acompanhar depois",
};

function formatCurrencyFromInput(raw: string) {
  const cents = parseAmountToCents(raw);
  if (!cents) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDueDatePreview(value: string) {
  if (!value) return "Não definido";

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CreateChargeModal({
  isOpen,
  onClose,
  returnFocusRef,
  returnFocusFallback,
  onSuccess,
  initialCustomerId,
}: CreateChargeModalProps) {
  const { timezone, ready: localeReady } = useOrganizationLocale();
  const fieldId = useId();
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState<FormState>(() => initialChargeForm(initialCustomerId));
  const baseline = useRef<FormState>(initialChargeForm(initialCustomerId));
  const wasOpen = useRef(false);
  const [attempt] = useState(() => createChargeCreationAttempt(() => buildIdempotencyKey("finance.create_charge")));
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      baseline.current = initialChargeForm(initialCustomerId);
      setFormData(baseline.current);
    }
    wasOpen.current = isOpen;
  }, [isOpen, initialCustomerId]);
  const customerSelectRef = useRef<HTMLButtonElement | null>(null);
  const utils = trpc.useUtils();
  const { track } = useProductAnalytics();
  const createCharge = trpc.finance.charges.create.useMutation();

  useCriticalActionGuard({
    isPending: createCharge.isPending,
    reason: "Criando cobrança e sincronizando financeiro + cliente.",
  });

  const { data: customersResponse } = trpc.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const customers = Array.isArray((customersResponse as any)?.data)
    ? (customersResponse as any).data
    : Array.isArray(customersResponse)
      ? customersResponse
      : [];

  const selectedCustomerName = useMemo(() => {
    return (
      customers.find(
        (customer: any) => String(customer.id) === formData.customerId
      )?.name ?? "Nenhum cliente selecionado"
    );
  }, [customers, formData.customerId]);

  const canSubmit = useMemo(() => {
    return (
      formData.customerId.trim().length > 0 &&
      formData.amount.trim().length > 0 &&
      formData.dueDate.trim().length > 0
    );
  }, [formData.customerId, formData.amount, formData.dueDate]);

  const shortNotes = formData.notes.trim();
  const summarizedNotes =
    shortNotes.length > 60
      ? `${shortNotes.slice(0, 57)}...`
      : shortNotes || "Sem observações";

  const discardGuard = useFormDiscardGuard({
    open: isOpen,
    guardNavigation: true,
    dirty: JSON.stringify(formData) !== JSON.stringify(baseline.current),
    blocked: createCharge.isPending || attempt.pending,
    onDiscard: () => { setFormData(INITIAL_FORM); onClose(); },
  });
  const resetAndClose = discardGuard.requestClose;

  const submitCharge = async () => {
    if (attempt.pending) return;
    const customerId = formData.customerId.trim();
    const amount = formData.amount.trim();
    const dueDate = formData.dueDate;
    const notes = [
      formData.notes.trim(),
      formData.serviceReference.trim() &&
        `Ref.: ${formData.serviceReference.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const amountCents = parseAmountToCents(amount);

    const parsed = chargeSchema.safeParse({
      customerId,
      amountCents: amountCents ?? 0,
      dueDate,
      notes: notes || undefined,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dados inválidos";
      toast.error(firstError);
      return;
    }

    if (!localeReady) { toast.error("Aguarde a confirmação do fuso da empresa."); return; }
    const dueInstant = parseLocalDateTimeInput(`${parsed.data.dueDate}T12:00`, undefined, timezone);
    if (!dueInstant) { toast.error("Vencimento inválido no fuso da empresa."); return; }
    const payload = {
      customerId: parsed.data.customerId,
      amountCents: parsed.data.amountCents,
      dueDate: dueInstant.toISOString(),
      notes: parsed.data.notes || undefined,
    };
    const idempotencyKey = attempt.begin(payload);
    if (!idempotencyKey) return;

    createCharge.mutate({ ...payload, idempotencyKey }, {
      onSuccess: created => {
        attempt.confirm();
        const customerId = String(
          (created as any)?.customerId ?? payload.customerId ?? ""
        );

        const operationStatus = String(
          (created as any)?.operation?.status ?? ""
        ).toLowerCase();
        const degraded = (created as any)?.degraded;
        const successMessage = resolveOperationFeedback({
          operationStatus,
          degradedStatus: degraded?.status,
          executedMessage: "Cobrança criada.",
          duplicateMessage:
            "Requisição duplicada detectada: cobrança reaproveitada com segurança.",
          retryScheduledMessage:
            "Cobrança criada. WhatsApp entrou em modo pendente para retry.",
        });

        toast.success(successMessage, {
          action: {
            label: "Ver cobrança",
            onClick: () =>
              navigate(
                `/finances?chargeId=${String((created as any)?.id ?? "")}`
              ),
          },
        });

        if (formData.postAction === "CREATE_AND_CHARGE") {
          notify.successPersistent(
            "Cobrança criada",
            "A próxima ação já está pronta: enviar agora no WhatsApp.",
            {
              label: "Enviar WhatsApp",
              onClick: () =>
                navigate(
                  `/whatsapp?customerId=${customerId}&chargeId=${String((created as any)?.id ?? "")}`
                ),
            }
          );
        } else {
          notify.successPersistent(
            "Cobrança criada",
            "Essa cobrança já está disponível no acompanhamento financeiro.",
            {
              label: "Abrir financeiro",
              onClick: () => navigate("/finances"),
            }
          );
        }

        registerActionFlowEvent("charge_created");
        track("generate_charge", {
          screen: "finances",
          chargeId: String((created as any)?.id ?? ""),
          customerId,
          amountCents: payload.amountCents,
          nextStep: formData.postAction,
          chargeMode: formData.mode,
        });

        setFormData(INITIAL_FORM);
        onClose();
        onSuccess();
        void invalidateOperationalGraph(utils, customerId || undefined).catch(() => {
          toast.warning("Cobrança criada. Atualize a consulta para conferir os dados.");
        });
      },
      onError: error => {
        toast.error(error.message || "Erro ao criar cobrança");
      },
      onSettled: () => attempt.settle(),
    });
  };

  return (
    <>
    <FormModal
      returnFocusRef={returnFocusRef}
      returnFocusFallback={returnFocusFallback}
      open={isOpen}
      onOpenChange={open => {
        if (!open) resetAndClose();
      }}
      closeBlocked={createCharge.isPending}
      size="lg"
      initialFocusRef={customerSelectRef}
      title={
        <span className="inline-flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[var(--nx-brand-text,var(--accent-primary))]" />
          Nova cobrança
        </span>
      }
      description={localeReady ? `Cobrança em reais (BRL). Vencimento no fuso ${timezone}.` : "Aguarde a confirmação do fuso da empresa para salvar."}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--modal-section-muted)]">
            Essa cobrança ficará disponível no acompanhamento financeiro
            imediatamente.
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={createCharge.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-w-[210px]"
              onClick={() => void submitCharge()}
              disabled={!localeReady || createCharge.isPending || !canSubmit}
            >
              {createCharge.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </span>
              ) : (
                postActionLabels[formData.postAction]
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--modal-section-muted)]">
            Modo da cobrança
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(chargeModeLabels) as ChargeMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                aria-pressed={formData.mode === mode}
                disabled={createCharge.isPending || mode === "RECURRING"}
                onClick={() => setFormData(state => ({ ...state, mode }))}
                className="rounded-[0.82rem] nexo-field border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-left text-sm text-[var(--modal-section-text)] transition hover:border-[var(--accent-primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="font-medium">{chargeModeLabels[mode]}</p>
                <p className="text-xs text-[var(--modal-section-muted)]">
                  {mode === "MANUAL" &&
                    "Fluxo direto para cobrança fora da rotina."}
                  {mode === "RECURRING" &&
                    "Indisponível. A criação atual gera apenas cobranças avulsas."}
                  {mode === "SERVICE" &&
                    "Vincule ao contexto de execução do serviço."}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-[0.95rem] nexo-modal-section border border-[var(--modal-section-border)] bg-[var(--modal-section-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--modal-section-text)]">
            Dados essenciais
          </p>

          <div className="space-y-2">
            <label htmlFor={`${fieldId}-customer`} className="text-sm font-medium text-[var(--modal-section-muted)]">
              Cliente *
            </label>
            <Select
              value={formData.customerId}
              onValueChange={customerId =>
                setFormData(state => ({ ...state, customerId }))
              }
              disabled={createCharge.isPending}
            >
              <SelectTrigger id={`${fieldId}-customer`} ref={customerSelectRef}>
                <SelectValue placeholder="Busque e selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer: any) => (
                  <SelectItem key={customer.id} value={String(customer.id)}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!formData.customerId ? (
              <p className="text-xs text-[var(--modal-section-muted)]">
                Selecione o cliente para liberar o envio da cobrança.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`${fieldId}-amount`} className="text-sm font-medium text-[var(--modal-section-muted)]">
                Valor em reais (BRL) *
              </label>
              <Input
                inputMode="decimal"
                placeholder="100,00"
                aria-label="Valor em reais"
                id={`${fieldId}-amount`}
                value={formData.amount}
                onChange={e =>
                  setFormData(state => ({ ...state, amount: e.target.value }))
                }
                disabled={createCharge.isPending}
              />
              <p className="text-xs text-[var(--modal-section-muted)]">
                Valor atual: {formatCurrencyFromInput(formData.amount)}. Use
                1234,56 ou 1.234,56.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor={`${fieldId}-due-date`} className="text-sm font-medium text-[var(--modal-section-muted)]">
                Vencimento *
              </label>
              <Input
                disabled={!localeReady || createCharge.isPending}
                type="date"
                id={`${fieldId}-due-date`}
                value={formData.dueDate}
                onChange={e =>
                  setFormData(state => ({ ...state, dueDate: e.target.value }))
                }
              />
              <p className="text-xs text-[var(--modal-section-muted)]">
                Prévia: {formatDueDatePreview(formData.dueDate)}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--modal-section-text)]">
              Contexto opcional
            </p>
            <p className="text-xs text-[var(--modal-section-muted)]">
              Use apenas se ajudar no acompanhamento e na comunicação.
            </p>
          </div>

          {formData.mode === "SERVICE" ? (
            <div className="space-y-2">
              <label htmlFor={`${fieldId}-service-reference`} className="text-sm font-medium text-[var(--modal-section-muted)]">
                Referência do serviço
              </label>
              <Input
                placeholder="Ex.: OS #1042 · Troca de compressor"
                id={`${fieldId}-service-reference`}
                value={formData.serviceReference}
                onChange={e =>
                  setFormData(state => ({
                    ...state,
                    serviceReference: e.target.value,
                  }))
                }
                disabled={createCharge.isPending}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={`${fieldId}-notes`} className="text-sm font-medium text-[var(--modal-section-muted)]">
              Observações
            </label>
            <Textarea
              rows={3}
              placeholder="Ex.: combinado com cliente para envio até 18h"
              className="max-h-32 resize-y"
              id={`${fieldId}-notes`}
              value={formData.notes}
              onChange={e =>
                setFormData(state => ({ ...state, notes: e.target.value }))
              }
              disabled={createCharge.isPending}
            />
          </div>
        </section>

        <section className="space-y-2 rounded-[0.95rem] nexo-modal-section border border-[var(--modal-section-border)] bg-[var(--modal-section-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--modal-section-text)]">
            Após criar
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(postActionLabels) as PostCreateAction[]).map(
              action => (
                <button
                  key={action}
                  type="button"
                  onClick={() =>
                    setFormData(state => ({ ...state, postAction: action }))
                  }
                  disabled={createCharge.isPending}
                  className="rounded-[0.82rem] nexo-field border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-left text-sm text-[var(--modal-section-text)] transition hover:border-[var(--accent-primary)]/50"
                >
                  <span className="font-medium">
                    {postActionLabels[action]}
                  </span>
                  {action === "CREATE_AND_CHARGE" ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--modal-section-muted)]">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Sugere envio imediato
                    </span>
                  ) : null}
                </button>
              )
            )}
          </div>
        </section>

        <section className="rounded-[0.95rem] nexo-modal-section border border-[var(--modal-section-border)] bg-[var(--modal-section-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--modal-section-text)]">
            Resumo ao vivo
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-[var(--modal-section-muted)]">
                Cliente:
              </span>{" "}
              {selectedCustomerName}
            </p>
            <p>
              <span className="text-[var(--modal-section-muted)]">Valor:</span>{" "}
              {formatCurrencyFromInput(formData.amount)}
            </p>
            <p>
              <span className="text-[var(--modal-section-muted)]">
                Vencimento:
              </span>{" "}
              {formatDueDatePreview(formData.dueDate)}
            </p>
            <p>
              <span className="text-[var(--modal-section-muted)]">Tipo:</span>{" "}
              {chargeModeLabels[formData.mode]}
            </p>
            <p className="sm:col-span-2">
              <span className="text-[var(--modal-section-muted)]">
                Observações:
              </span>{" "}
              {summarizedNotes}
            </p>
          </div>
        </section>
      </div>
    </FormModal>
    {discardGuard.confirmation}
    </>
  );
}
