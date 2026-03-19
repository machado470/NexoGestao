import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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

  const createCharge = trpc.finance.charges.create.useMutation({
    onSuccess: () => {
      toast.success("Cobrança criada com sucesso!");
      setFormData(INITIAL_FORM);
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar cobrança");
    },
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

    await createCharge.mutateAsync({
      customerId: parsed.data.customerId,
      amountCents: parsed.data.amountCents,
      dueDate: new Date(`${parsed.data.dueDate}T12:00:00`).toISOString(),
      notes: parsed.data.notes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between border-b border-gray-200 p-6 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <Wallet className="h-5 w-5 text-orange-500" />
              Nova Cobrança
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Crie uma cobrança manual com cliente, valor, vencimento e contexto básico.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"
            type="button"
            disabled={createCharge.isPending}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
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

        <div className="flex gap-2 border-t border-gray-200 p-6 dark:border-zinc-800">
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
        </div>
      </div>
    </div>
  );
}
