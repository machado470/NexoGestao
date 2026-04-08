import { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildServiceOrdersDeepLink,
  buildWhatsAppUrlFromServiceOrder,
  getServiceOrderIdFromUrl,
  normalizeOrders,
} from "@/lib/operations/operations.utils";
import {
  getChargeBadge,
  getFinancialStage,
  getOperationalStage,
  getPriorityScore,
  matchesFinancialFilter,
} from "@/lib/operations/operations.selectors";
import {
  MessageCircle,
  Plus,
  RefreshCw,
  ArrowLeft,
  BriefcaseBusiness,
} from "lucide-react";
import { PageHero, PageShell, SmartPage, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";

import ServiceOrderCard from "@/components/service-orders/ServiceOrderCard";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";

import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import EditServiceOrderModal from "@/components/EditServiceOrderModal";

import type {
  FinancialFilter,
  ServiceOrder,
} from "@/components/service-orders/service-order.types";
import { getErrorMessage, getQueryUiState, normalizeArrayPayload } from "@/lib/query-helpers";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";

const FINANCIAL_FILTERS: Array<{
  value: FinancialFilter;
  label: string;
}> = [
  { value: "ALL", label: "Todas" },
  { value: "NO_CHARGE", label: "Sem cobrança" },
  { value: "READY_TO_CHARGE", label: "Prontas para cobrar" },
  { value: "PENDING", label: "Pendentes" },
  { value: "PAID", label: "Pagas" },
  { value: "OVERDUE", label: "Vencidas" },
  { value: "CANCELED", label: "Canceladas" },
];

function sortOrders(items: ServiceOrder[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = getPriorityScore(b) - getPriorityScore(a);
    if (priorityDiff !== 0) return priorityDiff;

    const aUpdated = new Date(
      a.updatedAt || a.createdAt || a.scheduledFor || 0
    ).getTime();
    const bUpdated = new Date(
      b.updatedAt || b.createdAt || b.scheduledFor || 0
    ).getTime();

    return bUpdated - aUpdated;
  });
}

function buildOperationalQueue(items: ServiceOrder[]) {
  return items.filter(
    (item) => item.status !== "DONE" && item.status !== "CANCELED"
  );
}

function extractServiceOrder(payload: unknown): ServiceOrder | null {
  if (!payload || typeof payload !== "object") return null;
  if ("id" in payload) return payload as ServiceOrder;
  if ("data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (nested && typeof nested === "object" && "id" in nested) {
      return nested as ServiceOrder;
    }
  }
  return null;
}

function appendReturnTo(url: string, returnTo: string) {
  const [pathname, rawQuery = ""] = url.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("returnTo", returnTo);
  return `${pathname}?${params.toString()}`;
}

export default function ServiceOrdersPage() {
  const { track } = useProductAnalytics();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const basePath = useMemo(() => {
    const [pathname] = location.split("?");
    return pathname === "/operations" ? "/operations" : "/service-orders";
  }, [location]);

  const deepLinkBase =
    basePath === "/operations" ? "operations" : "service-orders";

  const activeId = useMemo(() => getServiceOrderIdFromUrl(location), [location]);
  const customerIdFromUrl = useMemo(() => {
    const query = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(query).get("customerId");
  }, [location]);
  const appointmentIdFromUrl = useMemo(() => {
    const query = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(query).get("appointmentId");
  }, [location]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinancialFilter>("ALL");
  const [search, setSearch] = useState("");
  const [nextActionState, setNextActionState] = useState<
    "idle" | "running" | "done"
  >("idle");

  const activeRef = useRef<HTMLDivElement | null>(null);

  const ordersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const peopleQuery = trpc.people.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const activeOrderQuery = trpc.nexo.serviceOrders.getById.useQuery(
    { id: activeId ?? "" },
    {
      enabled: Boolean(activeId),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customers = useMemo(() => {
    return normalizeArrayPayload<{ id: string; name: string }>(
      customersQuery.data
    );
  }, [customersQuery.data]);

  const orders = useMemo(() => {
    return normalizeOrders<ServiceOrder>(ordersQuery.data);
  }, [ordersQuery.data]);

  const people = useMemo(() => {
    return normalizeArrayPayload<{ id: string; name: string }>(peopleQuery.data);
  }, [peopleQuery.data]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((item) => {
      if (
        customerIdFromUrl &&
        String(item.customerId ?? item.customer?.id ?? "") !== customerIdFromUrl
      ) {
        return false;
      }

      if (!matchesFinancialFilter(item, filter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.title,
        item.description,
        item.customer?.name,
        item.assignedTo?.name,
        item.status,
        item.financialSummary?.chargeStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [orders, filter, search, customerIdFromUrl]);

  const sorted = useMemo(() => sortOrders(filtered), [filtered]);

  const operationalQueue = useMemo(
    () => buildOperationalQueue(sorted),
    [sorted]
  );

  const activeOrder = useMemo(() => {
    const fromQuery = extractServiceOrder(activeOrderQuery.data);
    if (fromQuery) return fromQuery;

    return sorted.find((item) => item.id === activeId) ?? null;
  }, [activeOrderQuery.data, sorted, activeId]);

  const totalOrders = orders.length;
  const totalVisible = sorted.length;
  const totalOperational = operationalQueue.length;

  const totalWithUrgency = useMemo(() => {
    return sorted.filter(
      (item) =>
        item.financialSummary?.chargeStatus === "OVERDUE" ||
        (item.status === "DONE" && !item.financialSummary?.hasCharge)
    ).length;
  }, [sorted]);

  const nextAction = useMemo(() => {
    if (activeOrder?.status === "DONE" && !activeOrder.financialSummary?.hasCharge) {
      return {
        severity: "critical" as const,
        title: "Gerar cobrança desta O.S.",
        description: "A execução foi concluída e o próximo passo ideal é faturar imediatamente.",
        ctaLabel: "Gerar cobrança",
        onClick: () => navigate(`/finances?serviceOrderId=${activeOrder.id}`),
      };
    }

    if (activeOrder?.financialSummary?.chargeStatus === "OVERDUE") {
      const url = buildWhatsAppUrlFromServiceOrder(activeOrder);
      return {
        severity: "critical" as const,
        title: "Cobrança vencida: acionar WhatsApp",
        description: "A cobrança está vencida. Conduza recuperação com contato direto.",
        ctaLabel: "Enviar WhatsApp",
        onClick: () => {
          if (url) openWhatsApp(url);
          else navigate("/whatsapp");
        },
      };
    }

    if (activeOrder?.financialSummary?.chargeStatus === "PAID") {
      return {
        severity: "healthy" as const,
        title: "Pagamento confirmado: fechar execução",
        description: "Finalize a O.S. com resultado registrado para encerrar o ciclo.",
        ctaLabel: "Revisar e concluir",
        onClick: () => openAsActive(activeOrder.id),
      };
    }

    const queueOrder = operationalQueue[0];
    if (queueOrder) {
      return {
        severity: "attention" as const,
        title: "Retomar fila operacional",
        description: "Sem foco definido: abra a próxima O.S. prioritária.",
        ctaLabel: "Abrir próxima O.S.",
        onClick: () => openAsActive(queueOrder.id),
      };
    }

    return {
      severity: "healthy" as const,
      title: "Criar nova ordem de serviço",
      description: "Não há itens pendentes. Gere uma nova O.S. para manter o fluxo ativo.",
      ctaLabel: "Nova O.S.",
      onClick: () => setIsCreateOpen(true),
    };
  }, [activeOrder, navigate, operationalQueue]);

  useEffect(() => {
    if (!activeId || !activeRef.current) return;

    activeRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeId]);

  useEffect(() => {
    if (!appointmentIdFromUrl || activeId) return;
    setIsCreateOpen(true);
  }, [appointmentIdFromUrl, activeId]);

  function openAsActive(id: string) {
    const nextUrl = (() => {
      const baseUrl = buildServiceOrdersDeepLink(id, deepLinkBase);
      if (!customerIdFromUrl) return baseUrl;
      return `${baseUrl}&customerId=${customerIdFromUrl}`;
    })();

    if (location !== nextUrl) {
      navigate(nextUrl);
    }
  }

  function closeActivePanel() {
    const target = customerIdFromUrl
      ? `${basePath}?customerId=${customerIdFromUrl}`
      : basePath;
    if (location !== target) {
      navigate(target);
    }
  }

  function openWhatsApp(url: string) {
    track("send_whatsapp", {
      screen: "service-orders",
      serviceOrderId: activeId,
      source: "service_order_next_action",
    });
    const returnTo = activeId ? `${basePath}?os=${activeId}` : basePath;
    navigate(appendReturnTo(url, returnTo));
  }

  function getSeverityClasses(severity: "critical" | "attention" | "healthy") {
    if (severity === "critical") {
      return "border-red-200 bg-red-50/90 dark:border-red-900/40 dark:bg-red-950/20";
    }
    if (severity === "healthy") {
      return "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900/40 dark:bg-emerald-950/20";
    }
    return "border-amber-200 bg-amber-50/90 dark:border-amber-900/40 dark:bg-amber-950/20";
  }

  const nextActionAccent =
    nextAction.severity === "critical"
      ? "text-red-700 dark:text-red-300"
      : nextAction.severity === "healthy"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-amber-700 dark:text-amber-300";


  const smartPriorities = useMemo(() => [
    {
      id: "so-stalled",
      type: "stalled_service_orders" as const,
      title: "O.S. paradas",
      count: totalOperational,
      impactCents: totalOperational * 35000,
      ctaLabel: "Abrir próxima O.S.",
      ctaPath: "/service-orders",
      helperText: "Execução parada atrasa entrega e faturamento.",
    },
    {
      id: "so-overdue",
      type: "overdue_charges" as const,
      title: "Risco financeiro na execução",
      count: totalWithUrgency,
      impactCents: totalWithUrgency * 50000,
      ctaLabel: "Cobrar agora",
      ctaPath: "/finances",
      helperText: "O.S. concluída sem cobrança representa dinheiro parado.",
    },
    {
      id: "so-risk",
      type: "operational_risk" as const,
      title: "Deep-links com foco ativo",
      count: activeId ? 1 : 0,
      impactCents: 0,
      ctaLabel: "Revisar foco",
      ctaPath: "/service-orders",
      helperText: "Garantir foco certo evita retrabalho e desvio de fila.",
    },
  ], [activeId, totalOperational, totalWithUrgency]);

  async function refreshAll() {
    await Promise.all([
      utils.nexo.serviceOrders.list.invalidate(),
      activeId
        ? utils.nexo.serviceOrders.getById.invalidate({ id: activeId })
        : Promise.resolve(),
      utils.nexo.customers.list.invalidate(),
      utils.people.list.invalidate(),
      utils.finance.charges.list.invalidate(),
      utils.dashboard.alerts.invalidate(),
    ]);
  }

  const hasRenderableData =
    ordersQuery.data !== undefined ||
    customersQuery.data !== undefined ||
    peopleQuery.data !== undefined;

  const queryState = getQueryUiState(
    [ordersQuery, customersQuery, peopleQuery],
    hasRenderableData
  );

  const errorMessage =
    getErrorMessage(ordersQuery.error, "") ||
    getErrorMessage(customersQuery.error, "") ||
    getErrorMessage(peopleQuery.error, "") ||
    "Erro ao carregar a fila operacional.";

  return (
    <PageShell>
      <PageHero
        eyebrow="Execução operacional"
        title="O que precisa ser executado agora"
        description="Veja o que está parado na operação, por que isso impacta sua conversão e qual próximo passo deve acontecer agora."
        actions={
          <>
      
      {activeId && (
              <Button
                size="sm"
                variant="outline"
                onClick={closeActivePanel}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para a lista
              </Button>
            )}
            <Button variant="outline" onClick={() => void refreshAll()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>

            <Button
              onClick={() => {
                track("cta_click", {
                  screen: "service-orders",
                  ctaId: "hero_new_service_order",
                });
                setIsCreateOpen(true);
              }}
              className="min-h-12"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova O.S.
            </Button>
          </>
        }
      />


      <SmartPage
        pageContext="service-orders"
        headline="Execução guiada por impacto"
        dominantProblem={nextAction.title}
        dominantImpact={`${totalWithUrgency} itens com impacto imediato`}
        dominantCta={{
          label: nextAction.ctaLabel,
          onClick: nextAction.onClick,
          path: "/service-orders",
        }}
        priorities={smartPriorities}
      />

      {activeId && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
          Você está visualizando uma O.S. em foco por deep-link. A lista continua
          estável, sem redirecionamento automático.
        </div>
      )}
      {activeId && !activeOrder && !activeOrderQuery.isLoading ? (
        <SurfaceSection className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
          Deep link inválido: a O.S. <strong>{activeId}</strong> não foi encontrada.
          Revise o link ou volte para a lista.
        </SurfaceSection>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="nexo-kpi-card">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total em execução
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="nexo-kpi-card">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Visíveis agora
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalVisible}</div>
          </CardContent>
        </Card>

        <Card className="nexo-kpi-card">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              O que precisa andar
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalOperational}</div>
          </CardContent>
        </Card>

        <Card className="nexo-kpi-card">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Impacto imediato
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalWithUrgency}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="nexo-kpi-card">
        <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex-1">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, cliente, responsável ou status"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FINANCIAL_FILTERS.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <SurfaceSection className={getSeverityClasses(nextAction.severity)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${nextActionAccent}`}>
              Próxima ação
            </p>
            <p className={`mt-1 font-medium ${nextActionAccent}`}>
              {nextAction.title}
            </p>
            <p className={`text-sm ${nextActionAccent}`}>
              {nextAction.description}
            </p>
          </div>
          <Button
            onClick={() => {
              track("cta_click", {
                screen: "service-orders",
                ctaId: "next_action_primary",
                label: nextAction.ctaLabel,
              });
              setNextActionState("running");
              nextAction.onClick();
              setTimeout(() => setNextActionState("done"), 220);
              setTimeout(() => setNextActionState("idle"), 1400);
            }}
          >
            {nextActionState === "running"
              ? "Abrindo..."
              : nextActionState === "done"
                ? "Ação iniciada"
                : nextAction.ctaLabel}
          </Button>
        </div>
      </SurfaceSection>

      {queryState.hasBackgroundUpdate ? (
        <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
          Atualizando dados em segundo plano...
        </div>
      ) : null}

      {queryState.hasError && !queryState.shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      {queryState.isInitialLoading ? (
        <SurfaceSection className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
          Carregando ordens de serviço...
        </SurfaceSection>
      ) : queryState.shouldBlockForError ? (
        <SurfaceSection className="border-red-200 text-sm text-red-700 dark:border-red-900/40 dark:text-red-300">
          {errorMessage}
        </SurfaceSection>
      ) : sorted.length === 0 ? (
        <SurfaceSection className="space-y-3">
          <EmptyState
            icon={<BriefcaseBusiness className="h-7 w-7" />}
            title="Ainda não há execução ativa"
            description="Comece criando sua primeira ordem de serviço para sair do planejamento e entrar em entrega com cobrança."
            action={{
              label: "Criar primeira O.S.",
              onClick: () => setIsCreateOpen(true),
            }}
            secondaryAction={{
              label: "Ver sem filtros",
              onClick: () => {
                setFilter("ALL");
                setSearch("");
              },
            }}
          />
          <DemoEnvironmentCta />
        </SurfaceSection>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
          <div className="space-y-4">
            {sorted.map((os) => {
              const isActive = os.id === activeId;
              const chargeBadge = getChargeBadge(os.financialSummary);
              const operationalStage = getOperationalStage(os);
              const financialStage = getFinancialStage(os);
              const whatsappUrl = buildWhatsAppUrlFromServiceOrder(os);

              return (
                <div
                  key={os.id}
                  ref={isActive ? activeRef : null}
                  className={isActive ? "rounded-2xl ring-2 ring-orange-300" : ""}
                >
                  <ServiceOrderCard
                    os={os}
                    isProcessing={false}
                    chargeBadge={chargeBadge}
                    operationalStage={operationalStage}
                    financialStage={financialStage}
                    onEdit={setEditId}
                    onOpenDeepLink={openAsActive}
                    onOpenWhatsApp={
                      whatsappUrl ? (url) => openWhatsApp(url) : undefined
                    }
                    isUpdating={false}
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            {activeOrder ? (
              <ServiceOrderDetailsPanel os={activeOrder} />
            ) : (
              <Card className="nexo-kpi-card">
                <CardContent className="space-y-3 p-6">
                  <div className="text-sm font-medium">
                    Selecione uma O.S. para abrir o hub operacional.
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aqui você acompanha execução, cobrança, pagamento, timeline e
                    ação seguinte sem navegar no escuro.
                  </p>
                  {operationalQueue[0] ? (
                    <Button onClick={() => openAsActive(operationalQueue[0].id)}>
                      Abrir próxima da fila
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {activeOrder?.customer?.phone ? (
              <Card className="nexo-kpi-card">
                <CardContent className="p-4">
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Atalho rápido
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const url = buildWhatsAppUrlFromServiceOrder(activeOrder);
                      if (url) {
                        navigate(
                          appendReturnTo(url, `${basePath}?os=${activeOrder.id}`)
                        );
                      }
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Abrir conversa da O.S.
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      <CreateServiceOrderModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => void refreshAll()}
        initialCustomerId={customerIdFromUrl}
        appointmentId={appointmentIdFromUrl}
        customers={customers}
        people={people}
      />

      <EditServiceOrderModal
        isOpen={Boolean(editId)}
        onClose={() => setEditId(null)}
        onSuccess={() => void refreshAll()}
        serviceOrderId={editId}
        people={people}
      />
    </PageShell>
  );
}
