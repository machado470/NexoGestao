import { normalizeArrayPayload } from "@/lib/query-helpers";
import { completeOnboardingService } from "@/lib/onboarding-service";
import { parseMoneyInputToCents } from "@/lib/money-input";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Coins,
  AlertTriangle,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";

import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import {
  AppInfoCard,
  AppInput,
  AppSelect,
  AppSectionCard,
  AppStatusBadge,
} from "@/components/app-system";
import { Button } from "@/components/ui/button";
import { useDemoEnvironment } from "@/hooks/useDemoEnvironment";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";

type StepKey =
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
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "customer",
    title: "Criar cliente",
    description: "Abra uma oportunidade real de receita dentro do seu funil.",
    cta: "Criar cliente",
    icon: UserRound,
  },
  {
    key: "appointment",
    title: "Criar agendamento",
    description: "Agende o atendimento e transforme lead em execução.",
    cta: "Criar agendamento",
    icon: Calendar,
  },
  {
    key: "serviceOrder",
    title: "Concluir serviço",
    description: "Registre e conclua a execução para liberar a cobrança.",
    cta: "Concluir serviço",
    icon: ClipboardList,
  },
  {
    key: "charge",
    title: "Gerar cobrança",
    description: "Converta a execução em valor financeiro rastreável.",
    cta: "Gerar cobrança",
    icon: Coins,
  },
];

function getStepStatusLabel(done: boolean, enabled: boolean) {
  if (done) return "Concluído";
  if (enabled) return "Pronto para executar";
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
  if (!payload || Array.isArray(payload)) return null;

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
  return <ThemeProvider defaultTheme="light"><OnboardingJourney /></ThemeProvider>;
}

function OnboardingJourney() {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { track } = useProductAnalytics();
  const { user, isAuthenticated, isInitializing, refresh } = useAuth();
  const utils = trpc.useUtils();
  const { isGenerating, generateDemoEnvironment } = useDemoEnvironment();

  const canQuery = isAuthenticated && !isInitializing;

  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(BASE_PROGRESS);
  const [journeyIds, setJourneyIds] = useState<JourneyIds>(BASE_IDS);
  const [error, setError] = useState<string | null>(null);
  const [flowMessage, setFlowMessage] = useState<string | null>(null);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const [seedFallback, setSeedFallback] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("Cliente Demo NexoGestão");
  const [customerPhone, setCustomerPhone] = useState("11999990000");
  const [appointmentNotes, setAppointmentNotes] = useState(
    "Atendimento de diagnóstico com foco em faturamento"
  );
  const [serviceOrderTitle, setServiceOrderTitle] = useState(
    "Execução inicial pronta para faturar"
  );
  const serviceStepPending = useRef(false);
  const [assigneeId, setAssigneeId] = useState("");
  const assigneesQuery = trpc.people.assignees.useQuery(undefined, { enabled: canQuery, retry: false });
  const assignees = Array.isArray(assigneesQuery.data) ? assigneesQuery.data : [];
  const [chargeAmount, setChargeAmount] = useState("150");

  const storageKey = useMemo(() => {
    const organizationId = user?.organizationId?.trim();
    const userId = user?.id?.trim();

    if (!organizationId || !userId) return null;

    return `pilot-onboarding:${organizationId}:${userId}`;
  }, [user?.organizationId, user?.id]);

  const customersQuery = trpc.customers.list.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const appointmentsQuery = trpc.appointments.list.useQuery(
    { page: 1, limit: 20 },
    { enabled: canQuery, retry: false, refetchOnWindowFocus: false }
  );

  const serviceOrdersQuery = trpc.serviceOrders.list.useQuery(
    { page: 1, limit: 20 },
    { enabled: canQuery, retry: false, refetchOnWindowFocus: false }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 20 },
    { enabled: canQuery, retry: false, refetchOnWindowFocus: false }
  );

  const statusQuery = trpc.onboarding.status.useQuery(undefined, { enabled: canQuery, retry: false });

  const customerMutation = trpc.customers.create.useMutation();
  const appointmentMutation = trpc.appointments.create.useMutation();
  const serviceOrderMutation = trpc.serviceOrders.create.useMutation();
  const serviceOrderUpdateMutation = trpc.serviceOrders.update.useMutation();
  const chargeMutation = trpc.finance.charges.create.useMutation();
  const skipOnboardingMutation = trpc.onboarding.skip.useMutation();
  const completeOnboardingMutation = trpc.onboarding.complete.useMutation();

  useEffect(() => {
    if (!storageKey) return;

    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : null;
      const storedProgress = saved?.progress ?? saved;
      setProgress(Object.fromEntries(Object.keys(BASE_PROGRESS).map(key => [key, storedProgress?.[key] === true])) as Progress);
      setJourneyIds(Object.fromEntries(Object.keys(BASE_IDS).map(key => [key, extractId(saved?.ids?.[key])])) as JourneyIds);
    } catch {
      setProgress(BASE_PROGRESS);
      setJourneyIds(BASE_IDS);
    }
    setHydratedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || hydratedKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ progress, ids: journeyIds }));
    } catch {
      // Storage may be unavailable; the server still supplies persisted progress.
    }
  }, [progress, journeyIds, storageKey, hydratedKey]);

  useEffect(() => {
    if (!canQuery || hydratedKey !== storageKey) return;

    const customersPayload = normalizeArrayPayload(customersQuery.data);
    const appointmentsPayload = normalizeArrayPayload(appointmentsQuery.data);
    const hasCustomer = Array.isArray(customersPayload) && customersPayload.length > 0;
    const hasAppointment = Array.isArray(appointmentsPayload) && appointmentsPayload.length > 0;
    setProgress((prev) => ({
      ...prev,
      customer: prev.customer || statusQuery.data?.steps.createCustomer === true || hasCustomer,
      appointment: prev.appointment || hasAppointment,
      serviceOrder: prev.serviceOrder || statusQuery.data?.steps.createService === true,
      charge: prev.charge || statusQuery.data?.steps.createCharge === true,
    }));
  }, [
    canQuery,
    hydratedKey,
    storageKey,
    customersQuery.data,
    appointmentsQuery.data,
    serviceOrdersQuery.data,
    chargesQuery.data,
    statusQuery.data,
  ]);

  const firstCustomer = normalizeArrayPayload<{ id: string }>(customersQuery.data)[0];
  const activeCustomerId = journeyIds.customerId ?? firstCustomer?.id ?? null;

  const canRun = {
    customer: true,
    appointment: progress.customer && Boolean(activeCustomerId),
    serviceOrder: progress.appointment,
    charge: progress.serviceOrder,
  } as const;

  const completedCount = useMemo(
    () => Object.values(progress).filter(Boolean).length,
    [progress]
  );

  const percent = Math.round((completedCount / STEP_META.length) * 100);

  const stepRefs = useRef<Partial<Record<StepKey, HTMLDivElement | null>>>({});
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  const completeStep = (key: StepKey) => {
    setProgress((prev) => ({ ...prev, [key]: true }));
    const next = STEP_META[STEP_META.findIndex(step => step.key === key) + 1];
    if (next) stepRefs.current[next.key]?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const isLeaving = completeOnboardingMutation.isPending || skipOnboardingMutation.isPending;
  const isExecuting = isGenerating || customerMutation.isPending || appointmentMutation.isPending || serviceOrderMutation.isPending || serviceOrderUpdateMutation.isPending || chargeMutation.isPending;

  const skip = async () => {
    setError(null);
    try {
      const status = await skipOnboardingMutation.mutateAsync({});
      if (!status || status.requiresOnboarding) throw new Error("Não foi possível liberar o painel. Tente novamente.");
      if (storageKey) localStorage.removeItem(storageKey);
      await refresh();
      navigate("/executive-dashboard");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const finish = async () => {
    setError(null);

    try {
      await completeOnboardingMutation.mutateAsync({});
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      await refresh();
      navigate("/executive-dashboard");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <AppInfoCard className="text-sm text-[var(--text-muted)]">
          Faça login para continuar o onboarding.
        </AppInfoCard>
      </div>
    );
  }

  return (
    <div className={`nexo-app nexo-app-shell app-root min-h-screen text-[var(--text-primary)] ${theme === "dark" ? "dark" : ""}`} data-theme={theme}>
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <nav aria-label="Opções da demonstração" className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold">NexoGestão · Primeiros passos</span>
        <div className="flex flex-wrap gap-2">
          {toggleTheme ? <Button variant="outline" onClick={toggleTheme}>{theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}</Button> : null}
          <Button variant="outline" disabled={isLeaving || isExecuting} onClick={() => void skip()}>
            {skipOnboardingMutation.isPending ? "Abrindo painel..." : "Pular demonstração"}
          </Button>
        </div>
      </nav>
      {statusQuery.isError ? (
        <AppInfoCard role="alert">
          Não foi possível confirmar o progresso no servidor. Consulte novamente antes de finalizar.
          <Button type="button" variant="outline" disabled={statusQuery.isFetching} onClick={() => void statusQuery.refetch()}>Consultar progresso</Button>
        </AppInfoCard>
      ) : null}
      <section className="relative overflow-hidden rounded-[1.8rem] border border-[var(--border-subtle)] bg-[var(--surface-base)] px-6 py-6 shadow-[var(--app-shadow-soft)]">

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
              <AppStatusBadge label="Demo guiada" tone="accent" className="text-[var(--text-primary)]" />
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
              Entregue o primeiro valor em 4 passos guiados
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              O produto conduz automaticamente o caminho oficial: cliente → agendamento
              → serviço concluído → cobrança gerada.
            </p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Esta demonstração é opcional. Você pode pular e cadastrar seus dados depois no painel.</p>
          </div>

          <div className="min-w-[220px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--text-secondary)]">Progresso</span>
              <span className="font-semibold text-[var(--text-primary)]">{percent}%</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-base)]">
              <div className="h-full rounded-full bg-[var(--accent-primary)] transition-all" style={{ width: `${percent}%` }} />
            </div>

            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {completedCount} de {STEP_META.length} etapas concluídas
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div ref={errorRef}>
        <AppSectionCard role="alert" variant="critical" className="p-4 text-sm text-[var(--text-primary)]">
          {error}
        </AppSectionCard>
        </div>
      ) : null}

      {flowMessage ? (
        <AppInfoCard role="status" aria-live="polite" className="text-sm">
          {flowMessage}
        </AppInfoCard>
      ) : null}

      {seedFallback ? (
        <AppSectionCard variant="warning" className="p-4 text-sm text-[var(--text-primary)]">
          {seedFallback}
        </AppSectionCard>
      ) : null}

      {degradedMessage ? (
        <AppSectionCard variant="warning" className="p-4 text-sm text-[var(--text-primary)]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{degradedMessage}</span>
          </div>
        </AppSectionCard>
      ) : null}

      <AppSectionCard variant="action" className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
          Quer impressionar em 30 segundos?
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Preencha dados reais de demo instantaneamente (clientes, agenda, O.S., cobrança, pagamento, timeline e governança).
        </p>
        <Button className="mt-3" variant="secondary" disabled={isGenerating} onClick={async () => {
          track("cta_click", { screen: "onboarding", ctaId: "generate_demo_data" });
          setError(null);
          setFlowMessage("Preparando dados da demonstração...");
          setDegradedMessage(null);
          setSeedFallback(null);
          try {
            const payload = await generateDemoEnvironment();
            if (payload?.customerId) {
              setJourneyIds((prev) => ({ ...prev, customerId: String(payload.customerId) }));
            }
            await Promise.all([
              customersQuery.refetch(),
              appointmentsQuery.refetch(),
              serviceOrdersQuery.refetch(),
              chargesQuery.refetch(),
              statusQuery.refetch(),
            ]);
            setFlowMessage("Ambiente de demonstração pronto. Confira as etapas concluídas abaixo ou continue no painel.");
            setDegradedMessage("Se o WhatsApp estiver em fila, continue o onboarding normalmente: o envio será processado em background.");
          } catch (e) {
            setError((e as Error).message);
            setSeedFallback("A geração automática de dados falhou. Continue pela jornada manual abaixo: ela possui permite tentar novamente. Você também pode pular a demonstração e continuar no painel.");
            setFlowMessage(null);
          }
        }}>
          {isGenerating ? "Preparando ambiente demo..." : "Gerar dados de demo agora"}
        </Button>
      </AppSectionCard>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {STEP_META.map((step, index) => {
            const Icon = step.icon;
            const done = progress[step.key];
            const enabled = canRun[step.key];

            return (
              <AppSectionCard
                key={step.key}
                variant={done ? "success" : enabled ? "action" : "context"}
                className="p-4 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="nexo-icon-tile mt-0.5">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Etapa {index + 1}
                    </span>

                    <h3 className="mt-1 font-semibold text-[var(--text-primary)]">
                      {step.title}
                    </h3>

                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {step.description}
                    </p>

                    <div className="mt-2">
                      <AppStatusBadge
                        className="text-[var(--text-primary)]"
                        label={getStepStatusLabel(done, enabled)}
                        tone={done ? "success" : enabled ? "accent" : "neutral"}
                      />
                    </div>
                  </div>
                </div>
              </AppSectionCard>
            );
          })}
        </aside>

        <div className="space-y-6">
          <div ref={node => { stepRefs.current.customer = node; }}>
          <AppSectionCard className="p-6">
            <h2 className="text-lg font-semibold">1. Criar cliente</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Cadastre um cliente e mostre onde a receita começa.</p>
            <div className="mt-4 grid gap-4">
              <AppInput className="w-full" aria-label="Nome do cliente" placeholder="Nome do cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <AppInput className="w-full" aria-label="Telefone ou WhatsApp do cliente" placeholder="Telefone / WhatsApp" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <Button className="mt-4" disabled={!canRun.customer || progress.customer || customerMutation.isPending} onClick={async () => {
              track("cta_click", { screen: "onboarding", ctaId: "step_create_customer" });
              setError(null);
              setFlowMessage("Criando cliente e preparando o próximo passo...");
              try {
                if (!customerName.trim()) throw new Error("Informe o nome do cliente.");
                if (!customerPhone.trim()) throw new Error("Informe o telefone do cliente.");
                const customerResult = await customerMutation.mutateAsync({ name: customerName.trim(), phone: customerPhone.trim() });
                setJourneyIds((prev) => ({ ...prev, customerId: extractEntityId(customerResult, ["customerId", "id"]) ?? prev.customerId }));
                await utils.customers.list.invalidate();
                await utils.onboarding.status.invalidate();
                completeStep("customer");
                setFlowMessage("Cliente criado. Agora avance para o agendamento para mostrar previsibilidade operacional.");
              } catch (e) {
                setError((e as Error).message);
                setFlowMessage(null);
              }
            }}>{customerMutation.isPending ? "Criando..." : progress.customer ? "Concluído" : STEP_META[0].cta}</Button>
          </AppSectionCard>
          </div>

          <div ref={node => { stepRefs.current.appointment = node; }}>
          <AppSectionCard className="p-6">
            <h2 className="text-lg font-semibold">2. Criar agendamento</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Marque o atendimento e mostre previsibilidade de operação.</p>
            <AppInput className="mt-4 w-full" aria-label="Observação do agendamento" value={appointmentNotes} onChange={(e) => setAppointmentNotes(e.target.value)} placeholder="Observação do agendamento" />
            {!canRun.appointment ? <p className="mt-3 text-sm text-[var(--text-muted)]">Crie um cliente na etapa 1 para liberar o agendamento.</p> : null}
            <Button className="mt-4" disabled={!canRun.appointment || progress.appointment || appointmentMutation.isPending} onClick={async () => {
              setError(null);
              setFlowMessage("Registrando agendamento...");
              try {
                if (!activeCustomerId) throw new Error("Crie um cliente primeiro.");
                const startsAt = new Date();
                const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
                const result = await appointmentMutation.mutateAsync({
                  customerId: String(activeCustomerId),
                  startsAt: startsAt.toISOString(),
                  endsAt: endsAt.toISOString(),
                  notes: appointmentNotes.trim() || "Atendimento de demo",
                  status: "SCHEDULED",
                });
                setJourneyIds((prev) => ({ ...prev, appointmentId: extractEntityId(result, ["appointmentId", "id"]) ?? prev.appointmentId }));
                await utils.appointments.list.invalidate();
                completeStep("appointment");
                setFlowMessage("Agendamento criado. Agora formalize a entrega na O.S.");
              } catch (e) {
                setError((e as Error).message);
                setFlowMessage(null);
              }
            }}>{appointmentMutation.isPending ? "Criando..." : progress.appointment ? "Concluído" : STEP_META[1].cta}</Button>
          </AppSectionCard>
          </div>

          <div ref={node => { stepRefs.current.serviceOrder = node; }}>
          <AppSectionCard className="p-6">
            <h2 className="text-lg font-semibold">3. Concluir serviço</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Escolha o responsável para criar, iniciar e concluir a O.S. na sequência operacional.</p>
            <AppInput className="mt-4 w-full" aria-label="Título da ordem de serviço" value={serviceOrderTitle} onChange={(e) => setServiceOrderTitle(e.target.value)} placeholder="Título da ordem de serviço" />
            <div className="mt-4">
              <AppSelect ariaLabel="Responsável pela execução" value={assigneeId} onValueChange={setAssigneeId} placeholder="Selecione o responsável" options={assignees.map((person: any) => ({ value: person.id, label: person.name }))} />
              {assigneesQuery.isLoading ? <p role="status" className="mt-2 text-sm">Carregando responsáveis...</p> : assigneesQuery.isError ? (
                <div role="alert" className="mt-2 text-sm">Não foi possível consultar os responsáveis. <Button variant="outline" disabled={assigneesQuery.isFetching} onClick={() => void assigneesQuery.refetch()}>Tentar novamente</Button></div>
              ) : assignees.length === 0 ? <p className="mt-2 text-sm text-[var(--text-secondary)]">Nenhum responsável cadastrado. Pule a demonstração para cadastrar sua equipe em Pessoas no painel.</p> : !assigneeId ? <p className="mt-2 text-sm text-[var(--text-muted)]">Selecione quem executará o serviço para continuar.</p> : null}
            </div>
            {!canRun.serviceOrder ? <p className="mt-3 text-sm text-[var(--text-muted)]">Conclua o agendamento na etapa 2 para liberar o serviço.</p> : null}
            <Button className="mt-4" disabled={!assigneeId || !canRun.serviceOrder || progress.serviceOrder || serviceOrderMutation.isPending || serviceOrderUpdateMutation.isPending} onClick={async () => {
              track("cta_click", { screen: "onboarding", ctaId: "step_create_service_order" });
              setError(null);
              setFlowMessage("Registrando e concluindo serviço...");
              try {
                if (!activeCustomerId) throw new Error("Crie um cliente primeiro.");
                if (!serviceOrderTitle.trim()) throw new Error("Informe o título da ordem de serviço.");
                if (serviceStepPending.current) return;
                serviceStepPending.current = true;
                try {
                  const result = await completeOnboardingService({
                    existingId: journeyIds.serviceOrderId ?? normalizeArrayPayload<any>(serviceOrdersQuery.data).find((order: any) => order.customerId === activeCustomerId && order.title === serviceOrderTitle.trim() && order.status !== "CANCELED")?.id ?? null,
                    assigneeId,
                    create: () => serviceOrderMutation.mutateAsync({ customerId: String(activeCustomerId), title: serviceOrderTitle.trim(), priority: 2, assignedToPersonId: assigneeId }),
                    load: id => utils.serviceOrders.getById.fetch({ id }, { staleTime: 0 }),
                    update: input => serviceOrderUpdateMutation.mutateAsync(input),
                    onCreated: id => setJourneyIds(prev => ({ ...prev, serviceOrderId: id })),
                  });
                  setJourneyIds(prev => ({ ...prev, serviceOrderId: result.id }));
                } finally {
                  serviceStepPending.current = false;
                }
                await utils.serviceOrders.list.invalidate();
                await utils.onboarding.status.invalidate();
                completeStep("serviceOrder");
                setFlowMessage("Execução registrada. Próximo passo: gerar cobrança para evidenciar valor financeiro.");
              } catch (e) {
                setError((e as Error).message);
                setFlowMessage(null);
              }
            }}>{serviceOrderMutation.isPending || serviceOrderUpdateMutation.isPending ? "Concluindo..." : progress.serviceOrder ? "Concluído" : STEP_META[2].cta}</Button>
          </AppSectionCard>
          </div>

          <div ref={node => { stepRefs.current.charge = node; }}>
          <AppSectionCard className="p-6">
            <h2 className="text-lg font-semibold">4. Gerar cobrança</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Mostre dinheiro em potencial pronto para entrar no caixa.</p>
            <AppInput className="mt-4 w-full" aria-label="Valor da cobrança" inputMode="decimal" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="Valor da cobrança" />
            {!canRun.charge ? <p className="mt-3 text-sm text-[var(--text-muted)]">Conclua o serviço na etapa 3 para liberar a cobrança.</p> : null}
            <Button className="mt-4" disabled={!canRun.charge || progress.charge || chargeMutation.isPending} onClick={async () => {
              track("cta_click", { screen: "onboarding", ctaId: "step_generate_charge" });
              setError(null);
              setFlowMessage("Gerando cobrança e conectando operação ao caixa...");
              try {
                if (!activeCustomerId) throw new Error("Crie um cliente primeiro.");
                const amountCents = parseMoneyInputToCents(chargeAmount);
                if (amountCents === null) throw new Error("Informe um valor válido, como 150,00.");
                const orders = normalizeArrayPayload<any>(serviceOrdersQuery.data);
                const serviceOrderId = journeyIds.serviceOrderId ?? (Array.isArray(orders) ? orders.find((order: any) => order.customerId === activeCustomerId && order.status === "DONE")?.id : null);
                if (!serviceOrderId) throw new Error("Conclua a O.S. deste cliente antes de gerar a cobrança.");
                const result = await chargeMutation.mutateAsync({ customerId: String(activeCustomerId), serviceOrderId, amountCents, dueDate: new Date(), notes: "Cobrança demo pronta para receber" });
                setJourneyIds((prev) => ({ ...prev, chargeId: extractEntityId(result, ["chargeId", "id"]) ?? prev.chargeId }));
                await utils.finance.charges.list.invalidate();
                await utils.onboarding.status.invalidate();
                completeStep("charge");
                setFlowMessage("Cobrança criada. Você já comprovou o primeiro valor gerado para o cliente.");
                setDegradedMessage("Se houver envio WhatsApp em fila, o status é processado em segundo plano sem bloquear o fluxo.");
              } catch (e) {
                setError((e as Error).message);
                setFlowMessage(null);
              }
            }}>{chargeMutation.isPending ? "Gerando..." : progress.charge ? "Concluído" : STEP_META[3].cta}</Button>
          </AppSectionCard>
          </div>

          <AppSectionCard className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Primeiro valor entregue</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Finalize e siga para o Dashboard Executivo com o fluxo operacional completo.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
              <Button variant="outline" disabled={isLeaving || isExecuting} onClick={() => void skip()}>Continuar sem demonstração</Button>
              <Button disabled={isLeaving || isExecuting || !statusQuery.data?.steps.createCustomer || !statusQuery.data?.steps.createService || !statusQuery.data?.steps.createCharge || completeOnboardingMutation.isPending} onClick={() => void finish()} className="gap-2">
                {completeOnboardingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    Ir para Dashboard Executivo
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              </div>
            </div>
          </AppSectionCard>
        </div>
      </div>
    </div>
    </div>
  );
}
