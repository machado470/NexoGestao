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
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
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
    const returnTo = activeId ? `${basePath}?os=${activeId}` : basePath;
    navigate(appendReturnTo(url, returnTo));
  }

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
        title="Ordens de Serviço"
        description="Fila operacional central do NexoGestão com o mesmo padrão visual da visão executiva."
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

            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova O.S.
            </Button>
          </>
        }
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
              Total de O.S.
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
              Fila operacional
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalOperational}</div>
          </CardContent>
        </Card>

        <Card className="nexo-kpi-card">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Pedindo ação
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
            title="Nenhuma ordem encontrada"
            description="Ajuste os filtros ou crie uma nova O.S. para iniciar o ciclo operacional e financeiro."
            action={{
              label: "Nova O.S.",
              onClick: () => setIsCreateOpen(true),
            }}
            secondaryAction={{
              label: "Limpar filtro",
              onClick: () => setFilter("ALL"),
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
