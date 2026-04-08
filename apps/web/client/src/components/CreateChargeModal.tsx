import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  X,
  Loader2,
  Wallet,
  CalendarDays,
  Receipt,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { chargeSchema } from "@/lib/validations";
import { registerActionFlowEvent } from "@/lib/actionFlow";
import { useCriticalActionGuard } from "@/hooks/useCriticalActionGuard";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";

interface CreateChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type FormState = {
  customerId: string;
  amount: string;
  dueDate: string;
  notes: string;
};

const INITIAL_FORM: FormState = {
  customerId: "",
  amount: "",
  dueDate: "",
  notes: "",
};

function parseAmountToCents(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

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

export function CreateChargeModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateChargeModalProps) {
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const utils = trpc.useUtils();
  const { track } = useProductAnalytics();
  const createCharge = trpc.finance.charges.create.useMutation();
  useCriticalActionGuard({
    isPending: createCharge.isPending,
    reason: "Criando cobrança e sincronizando financeiro + cliente.",
  });

  const { data: customersResponse } = trpc.nexo.customers.list.useQuery(undefined, {
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
      customers.find((customer: any) => String(customer.id) === formData.customerId)?.name ??
      "Nenhum cliente selecionado"
    );
  }, [customers, formData.customerId]);

  const canSubmit = useMemo(() => {
    return (
      formData.customerId.trim().length > 0 &&
      formData.amount.trim().length > 0 &&
      formData.dueDate.trim().length > 0
    );
  }, [formData.customerId, formData.amount, formData.dueDate]);

  const handleClose = () => {
    if (createCharge.isPending) return;
    setFormData(INITIAL_FORM);
    onClose();
  };

  const submitCharge = async () => {
    const customerId = formData.customerId.trim();
    const amount = formData.amount.trim();
    const dueDate = formData.dueDate;
    const notes = formData.notes.trim();

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

    const payload = {
      customerId: parsed.data.customerId,
      amountCents: parsed.data.amountCents,
      dueDate: new Date(`${parsed.data.dueDate}T12:00:00`).toISOString(),
      notes: parsed.data.notes || undefined,
    };

    const previousCharges = utils.finance.charges.list.getData(undefined);
    const tempId = `temp-charge-${Date.now()}`;
    utils.finance.charges.list.setData(undefined, (old: any) => {
      const raw = old as { data: any[]; pagination: any } | undefined;
      const optimistic = {
        id: tempId,
        ...payload,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };
      if (!raw || !Array.isArray(raw.data)) return undefined;
      return { ...raw, data: [optimistic, ...raw.data] };
    });

    createCharge.mutate(payload, {
      onSuccess: async (created) => {
        utils.finance.charges.list.setData(undefined, (old: any) => {
          const raw = old as { data: any[]; pagination: any } | undefined;
          const applyReplace = (items: any[]) =>
            items.map((item) => (String(item?.id) === tempId ? created : item));
          if (!raw || !Array.isArray(raw.data)) return undefined;
          return { ...raw, data: applyReplace(raw.data) };
        });

        const customerId = String((created as any)?.customerId ?? payload.customerId ?? "");
        await invalidateOperationalGraph(utils, customerId || undefined);
        toast.success("Cobrança criada com contexto sincronizado.", {
          action: {
            label: "Ver cobrança",
            onClick: () => window.location.assign(`/finances?chargeId=${String((created as any)?.id ?? "")}`),
          },
        });
        registerActionFlowEvent("charge_created");
        track("generate_charge", {
          screen: "finances",
          chargeId: String((created as any)?.id ?? ""),
          customerId,
          amountCents: payload.amountCents,
          nextStep: "register_payment_or_send_whatsapp",
        });
        setFormData(INITIAL_FORM);
        onSuccess();
        onClose();
      },
      onError: (error) => {
        utils.finance.charges.list.setData(undefined, previousCharges as any);
        toast.error(error.message || "Erro ao criar cobrança");
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] max-w-2xl overflow-hidden border-zinc-800/80 bg-white p-0 shadow-xl dark:bg-zinc-900"
      >
        <DialogHeader className="border-b border-gray-200 px-6 py-6 dark:border-zinc-800">
          <DialogTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-white">
            <Wallet className="h-5 w-5 text-orange-500" />
            Nova Cobrança
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Crie uma cobrança manual com cliente, valor, vencimento e contexto básico.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
              <SectionTitle
                icon={Receipt}
                title="Dados da cobrança"
                subtitle="Defina cliente, valor e vencimento da cobrança manual."
              />

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Cliente *
                  </label>
                  <select
                    value={formData.customerId}
                    onChange={(e) =>
                      setFormData((state) => ({
                        ...state,
                        customerId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    disabled={createCharge.isPending}
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map((customer: any) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Valor (R$) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData((state) => ({
                          ...state,
                          amount: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder="100,00"
                      disabled={createCharge.isPending}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Valor atual: {formatCurrencyFromInput(formData.amount)}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <CalendarDays className="h-4 w-4 text-gray-500" />
                      Data de vencimento *
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData((state) => ({
                          ...state,
                          dueDate: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      disabled={createCharge.isPending}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Notas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((state) => ({
                        ...state,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    placeholder="Adicione observações sobre a cobrança, referência do serviço ou contexto de emissão"
                    rows={4}
                    disabled={createCharge.isPending}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="space-y-1 text-xs text-amber-900 dark:text-amber-300">
                  <p className="font-medium">Leitura rápida do que será criado</p>
                  <p>
                    Esta ação cria uma cobrança manual, independente do fluxo automático da O.S.,
                    quando você precisa registrar algo fora da rotina padrão.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
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
                    Valor
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrencyFromInput(formData.amount)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Vencimento
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formatDueDatePreview(formData.dueDate)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Observações
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formData.notes.trim() || "Sem observações"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
        <DialogFooter className="flex gap-2 border-t border-gray-200 p-6 sm:justify-start dark:border-zinc-800">
          <Button
            onClick={() => void submitCharge()}
            disabled={createCharge.isPending || !canSubmit}
            className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
            type="button"
          >
            {createCharge.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando...
              </span>
            ) : (
              "Criar cobrança"
            )}
          </Button>

          <Button
            onClick={handleClose}
            variant="outline"
            type="button"
            disabled={createCharge.isPending}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
