import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Coins,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type StepKey =
  | "company"
  | "customer"
  | "appointment"
  | "serviceOrder"
  | "charge";

type Progress = Record<StepKey, boolean>;
type JourneyIds = {
  customerId: string | null;
  appointmentId: string | null;
  serviceOrderId: string | null;
  chargeId: string | null;
};

const BASE_PROGRESS: Progress = {
  company: false,
  customer: false,
  appointment: false,
  serviceOrder: false,
  charge: false,
};

const BASE_IDS: JourneyIds = {
  customerId: null,
  appointmentId: null,
  serviceOrderId: null,
  chargeId: null,
};

const STEP_META: Array<{
  key: StepKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "company",
    title: "Ajustar perfil da empresa",
    description: "Defina o nome da operação para personalizar o ambiente.",
    icon: Building2,
  },
  {
    key: "customer",
    title: "Cadastrar primeiro cliente",
    description: "Crie a primeira base de relacionamento da operação.",
    icon: UserRound,
  },
  {
    key: "appointment",
    title: "Criar primeiro agendamento",
    description: "Marque um atendimento e inicie o fluxo operacional.",
    icon: Calendar,
  },
  {
    key: "serviceOrder",
    title: "Abrir primeira ordem de serviço",
    description: "Transforme agenda em execução operacional real.",
    icon: ClipboardList,
  },
  {
    key: "charge",
    title: "Gerar primeira cobrança",
    description: "Feche o ciclo com financeiro conectado à operação.",
    icon: Coins,
  },
];

function getStepStatusLabel(done: boolean, enabled: boolean) {
  if (done) return "Concluído";
  if (enabled) return "Pronto para avançar";
  return "Aguardando etapa anterior";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractId(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim();
    return normalized || null;
  }

  return null;
}

function extractEntityId(payload: unknown, keys: string[] = ["id"]): string | null {
  if (!payload) return null;
  if (Array.isArray(payload)) return null;

  if (isRecord(payload)) {
    for (const key of keys) {
      const direct = extractId(payload[key]);
      if (direct) return direct;
    }

    const nestedCandidates = [payload.data, payload.result, payload.item];
    for (const nested of nestedCandidates) {
      const nestedId = extractEntityId(nested, keys);
      if (nestedId) return nestedId;
    }
  }

  return null;
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isInitializing } = useAuth();
  const utils = trpc.useUtils();

  const canQuery = isAuthenticated && !isInitializing;

  const [progress, setProgress] = useState<Progress>(BASE_PROGRESS);
  const [journeyIds, setJourneyIds] = useState<JourneyIds>(BASE_IDS);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState(
    "Primeiro atendimento"
  );
  const [serviceOrderTitle, setServiceOrderTitle] = useState(
    "Primeira ordem de serviço"
  );
  const [chargeAmount, setChargeAmount] = useState("150");

  const storageKey = useMemo(
    () => `pilot-onboarding:${user?.id ?? "anon"}`,
    [user?.id]
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    {
      page: 1,
      limit: 20,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    {
      page: 1,
      limit: 20,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page: 1,
      limit: 20,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const companyMutation = trpc.nexo.settings.update.useMutation();
  const customerMutation = trpc.nexo.customers.create.useMutation();
  const appointmentMutation = trpc.nexo.appointments.create.useMutation();
  const serviceOrderMutation = trpc.nexo.serviceOrders.create.useMutation();
  const chargeMutation = trpc.finance.charges.create.useMutation();
  const completeOnboardingMutation = trpc.nexo.onboarding.complete.useMutation();

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      try {
        setProgress({ ...BASE_PROGRESS, ...JSON.parse(raw) });
      } catch {
        setProgress(BASE_PROGRESS);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [progress, storageKey]);

  useEffect(() => {
    if (!canQuery) return;

    const customersPayload =
      (customersQuery.data as any)?.data ?? customersQuery.data ?? [];
    const appointmentsPayload =
      (appointmentsQuery.data as any)?.data ??
      (appointmentsQuery.data as any)?.items ??
      appointmentsQuery.data ??
      [];
    const serviceOrdersPayload =
      (serviceOrdersQuery.data as any)?.data ??
      (serviceOrdersQuery.data as any)?.items ??
      serviceOrdersQuery.data ??
      [];
    const chargesPayload =
      (chargesQuery.data as any)?.data ??
      (chargesQuery.data as any)?.items ??
      chargesQuery.data ??
      [];

    const hasCustomer = Array.isArray(customersPayload) && customersPayload.length > 0;
    const hasAppointment =
      Array.isArray(appointmentsPayload) && appointmentsPayload.length > 0;
    const hasServiceOrder =
      Array.isArray(serviceOrdersPayload) && serviceOrdersPayload.length > 0;
    const hasCharge = Array.isArray(chargesPayload) && chargesPayload.length > 0;

    setProgress((prev) => ({
      ...prev,
      customer: prev.customer || hasCustomer,
      appointment: prev.appointment || hasAppointment,
      serviceOrder: prev.serviceOrder || hasServiceOrder,
      charge: prev.charge || hasCharge,
    }));
  }, [
    canQuery,
    customersQuery.data,
    appointmentsQuery.data,
    serviceOrdersQuery.data,
    chargesQuery.data,
  ]);

  const firstCustomer =
    ((customersQuery.data as any)?.data ?? customersQuery.data ?? [])[0];
  const activeCustomerId = journeyIds.customerId ?? firstCustomer?.id ?? null;

  const canRun = {
    company: true,
    customer: progress.company,
    appointment: progress.customer,
    serviceOrder: progress.appointment,
    charge: progress.serviceOrder,
  } as const;

  const completedCount = useMemo(() => {
    return Object.values(progress).filter(Boolean).length;
  }, [progress]);

  const percent = Math.round((completedCount / STEP_META.length) * 100);

  const completeStep = (key: StepKey) =>
    setProgress((prev) => ({ ...prev, [key]: true }));

  const finish = async () => {
    setError(null);

    try {
      await completeOnboardingMutation.mutateAsync({});
      localStorage.removeItem(storageKey);
      navigate("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-zinc-500 dark:border-zinc-800">
          Faça login para continuar o onboarding.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%)]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              Primeira configuração
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
              Coloque sua operação para rodar em poucos passos
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Esse fluxo prepara a base inicial do ambiente para você sair do zero
              e enxergar o ciclo principal acontecendo dentro da plataforma.
            </p>
          </div>

          <div className="min-w-[220px] rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                Progresso
              </span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {percent}%
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {completedCount} de {STEP_META.length} etapas concluídas
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {STEP_META.map((step, index) => {
            const Icon = step.icon;
            const done = progress[step.key];
            const enabled = canRun[step.key];

            return (
              <div
                key={step.key}
                className={`rounded-2xl border p-4 transition-colors ${
                  done
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                    : enabled
                      ? "border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20"
                      : "border-slate-200 bg-white dark:border-white/8 dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                      done
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : enabled
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                        Etapa {index + 1}
                      </span>
                    </div>

                    <h3 className="mt-1 font-semibold text-zinc-950 dark:text-white">
                      {step.title}
                    </h3>

                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {step.description}
                    </p>

                    <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {getStepStatusLabel(done, enabled)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </aside>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">1. Perfil da operação</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajuste o nome principal que representa sua empresa dentro da plataforma.
              </p>
            </div>

            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
              placeholder="Nome da empresa"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />

            <Button
              className="mt-4"
              disabled={!canRun.company || progress.company || companyMutation.isPending}
              onClick={async () => {
                setError(null);

                try {
                  if (!companyName.trim()) {
                    throw new Error("Informe o nome da empresa.");
                  }

                  await companyMutation.mutateAsync({
                    name: companyName.trim(),
                  });

                  completeStep("company");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {companyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : progress.company ? (
                "Concluído"
              ) : (
                "Salvar perfil"
              )}
            </Button>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">2. Primeiro cliente</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie um cliente inicial para começar a usar a operação com contexto real.
              </p>
            </div>

            <div className="grid gap-4">
              <input
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                placeholder="Nome do cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />

              <input
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                placeholder="Telefone / WhatsApp"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Pode informar com +55 ou só números. O backend normaliza.
            </p>

            <Button
              className="mt-4"
              disabled={!canRun.customer || progress.customer || customerMutation.isPending}
              onClick={async () => {
                setError(null);

                try {
                  if (!customerName.trim()) {
                    throw new Error("Informe o nome do cliente.");
                  }

                  if (!customerPhone.trim()) {
                    throw new Error("Informe o telefone do cliente.");
                  }

                  const customerResult = await customerMutation.mutateAsync({
                    name: customerName.trim(),
                    phone: customerPhone.trim(),
                  });

                  setJourneyIds((prev) => ({
                    ...prev,
                    customerId:
                      extractEntityId(customerResult, ["customerId", "id"]) ??
                      prev.customerId,
                  }));
                  await utils.nexo.customers.list.invalidate();
                  completeStep("customer");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {customerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : progress.customer ? (
                "Concluído"
              ) : (
                "Criar cliente"
              )}
            </Button>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">3. Primeiro agendamento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Agende um primeiro atendimento para iniciar o fluxo operacional.
              </p>
            </div>

            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
              value={appointmentNotes}
              onChange={(e) => setAppointmentNotes(e.target.value)}
              placeholder="Observação do agendamento"
            />

            <Button
              className="mt-4"
              disabled={
                !canRun.appointment ||
                progress.appointment ||
                appointmentMutation.isPending
              }
              onClick={async () => {
                setError(null);

                try {
                  if (!activeCustomerId) {
                    throw new Error("Crie um cliente primeiro.");
                  }

                  const startsAt = new Date();
                  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

                  const appointmentResult = await appointmentMutation.mutateAsync({
                    customerId: String(activeCustomerId),
                    startsAt: startsAt.toISOString(),
                    endsAt: endsAt.toISOString(),
                    notes: appointmentNotes.trim() || "Primeiro atendimento",
                    status: "SCHEDULED",
                  });

                  setJourneyIds((prev) => ({
                    ...prev,
                    appointmentId:
                      extractEntityId(appointmentResult, ["appointmentId", "id"]) ??
                      prev.appointmentId,
                  }));
                  await utils.nexo.appointments.list.invalidate();
                  completeStep("appointment");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {appointmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : progress.appointment ? (
                "Concluído"
              ) : (
                "Criar agendamento"
              )}
            </Button>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">4. Primeira ordem de serviço</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Transforme o agendamento em execução operacional acompanhável.
              </p>
            </div>

            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
              value={serviceOrderTitle}
              onChange={(e) => setServiceOrderTitle(e.target.value)}
              placeholder="Título da ordem de serviço"
            />

            <Button
              className="mt-4"
              disabled={
                !canRun.serviceOrder ||
                progress.serviceOrder ||
                serviceOrderMutation.isPending
              }
              onClick={async () => {
                setError(null);

                try {
                  if (!activeCustomerId) {
                    throw new Error("Crie um cliente primeiro.");
                  }

                  if (!serviceOrderTitle.trim()) {
                    throw new Error("Informe o título da ordem de serviço.");
                  }

                  const serviceOrderResult = await serviceOrderMutation.mutateAsync({
                    customerId: String(activeCustomerId),
                    title: serviceOrderTitle.trim(),
                    priority: 2,
                  });

                  setJourneyIds((prev) => ({
                    ...prev,
                    serviceOrderId:
                      extractEntityId(serviceOrderResult, ["serviceOrderId", "id"]) ??
                      prev.serviceOrderId,
                  }));
                  await utils.nexo.serviceOrders.list.invalidate();
                  completeStep("serviceOrder");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {serviceOrderMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : progress.serviceOrder ? (
                "Concluído"
              ) : (
                "Criar ordem de serviço"
              )}
            </Button>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">5. Primeira cobrança</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Feche o ciclo inicial com a primeira cobrança criada no sistema.
              </p>
            </div>

            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
              type="number"
              min="1"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              placeholder="Valor da cobrança"
            />

            <Button
              className="mt-4"
              disabled={!canRun.charge || progress.charge || chargeMutation.isPending}
              onClick={async () => {
                setError(null);

                try {
                  if (!activeCustomerId) {
                    throw new Error("Crie um cliente primeiro.");
                  }

                  const amount = Number(chargeAmount);
                  if (!amount || amount <= 0) {
                    throw new Error("Informe um valor de cobrança válido.");
                  }

                  const chargeResult = await chargeMutation.mutateAsync({
                    customerId: String(activeCustomerId),
                    amount,
                    dueDate: new Date(),
                    notes: "Primeira cobrança",
                  });

                  setJourneyIds((prev) => ({
                    ...prev,
                    chargeId: extractEntityId(chargeResult, ["chargeId", "id"]) ?? prev.chargeId,
                  }));
                  await utils.finance.charges.list.invalidate();
                  completeStep("charge");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {chargeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : progress.charge ? (
                "Concluído"
              ) : (
                "Criar cobrança"
              )}
            </Button>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Finalizar configuração inicial</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quando o ciclo base estiver pronto, você segue para o dashboard.
                </p>
              </div>

              <Button
                disabled={!progress.charge || completeOnboardingMutation.isPending}
                onClick={() => void finish()}
                className="gap-2"
              >
                {completeOnboardingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    Ir para o dashboard
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
