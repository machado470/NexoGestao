import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  X,
  ClipboardList,
  CalendarDays,
  Wallet,
  AlertCircle,
  CircleHelp,
  User,
} from "lucide-react";
import { serviceOrderSchema } from "@/lib/validations";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  customers: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
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
  onClose,
  onCreated,
  customers,
  people,
}: Props) {
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);

  const createMutation = trpc.nexo.serviceOrders.create.useMutation({
    onSuccess: () => {
      setFormData(INITIAL_FORM);
      onCreated?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar ordem de serviço");
    },
  });

  const canSubmit = useMemo(() => {
    return (
      formData.customerId.trim().length > 0 &&
      formData.title.trim().length > 0
    );
  }, [formData.customerId, formData.title]);

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
    setFormData(INITIAL_FORM);
    onClose();
  };

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

    await createMutation.mutateAsync({
      customerId: parsed.data.customerId,
      assignedToPersonId: parsed.data.assignedToPersonId || undefined,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      priority: parsed.data.priority,
      scheduledFor: parsed.data.scheduledFor || undefined,
      amountCents: parsed.data.amountCents,
      dueDate: parsed.data.dueDate || undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between border-b border-gray-200 p-6 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <ClipboardList className="h-5 w-5 text-orange-500" />
              Nova Ordem de Serviço
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Cadastre a execução operacional e, se quiser, já deixe a base financeira preparada.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"
            type="button"
            disabled={createMutation.isPending}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          <div className="space-y-6">
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
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                      className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                      className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
        </div>

        <div className="flex gap-2 border-t border-gray-200 p-6 dark:border-zinc-800">
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
        </div>
      </div>
    </div>
  );
}
