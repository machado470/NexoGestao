import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildServiceOrdersDeepLink,
  buildWhatsAppUrlFromServiceOrder,
  normalizeOrders,
} from "@/lib/operations/operations.utils";
import {
  getChargeBadge,
  getFinancialStage,
  getOperationalStage,
  getPriorityScore,
  getServiceOrderNextAction,
  matchesFinancialFilter,
} from "@/lib/operations/operations.selectors";
import { MessageCircle, Plus, RefreshCw } from "lucide-react";

import ServiceOrderCard from "@/components/service-orders/ServiceOrderCard";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";

import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import EditServiceOrderModal from "@/components/EditServiceOrderModal";

import type {
  FinancialFilter,
  ServiceOrder,
} from "@/components/service-orders/service-order.types";

function getOsFromLocation(location: string) {
  const params = new URLSearchParams(location.split("?")[1] || "");
  return params.get("os");
}

function getFinancialFilterLabel(filter: FinancialFilter) {
  if (filter === "ALL") return "Todas";
  if (filter === "NO_CHARGE") return "Sem cobrança";
  if (filter === "READY_TO_CHARGE") return "Prontas para cobrar";
  if (filter === "PENDING") return "Pendentes";
  if (filter === "PAID") return "Pagas";
  if (filter === "OVERDUE") return "Vencidas";
  if (filter === "CANCELED") return "Canceladas";
  return filter;
}

function getQueueSummaryLabel(filter: FinancialFilter) {
  if (filter === "ALL") return "Fila operacional completa";
  if (filter === "NO_CHARGE") return "Ordens sem cobrança";
  if (filter === "READY_TO_CHARGE") return "Ordens prontas para cobrar";
  if (filter === "PENDING") return "Ordens com cobrança pendente";
  if (filter === "PAID") return "Ordens com cobrança paga";
  if (filter === "OVERDUE") return "Ordens com cobrança vencida";
  if (filter === "CANCELED") return "Ordens canceladas";
  return "Fila operacional";
}

export default function ServiceOrdersPage() {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinancialFilter>("ALL");

  const listQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 50 },
    { retry: false }
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });

  const peopleQuery = trpc.nexo.people.list.useQuery(undefined, {
    retry: false,
  });

  const activeQuery = trpc.nexo.serviceOrders.getById.useQuery(
    { id: activeId as string },
    {
      enabled: Boolean(activeId),
      retry: false,
    }
  );

  const customers = useMemo(
    () => normalizeOrders(customersQuery.data),
    [customersQuery.data]
  );

  const people = useMemo(
    () => normalizeOrders(peopleQuery.data),
    [peopleQuery.data]
  );

  const list = useMemo(
    () => normalizeOrders<ServiceOrder>(listQuery.data),
    [listQuery.data]
  );

  const sorted = useMemo(
    () => [...list].sort((a, b) => getPriorityScore(b) - getPriorityScore(a)),
    [list]
  );

  const operationalQueue = useMemo(
    () => sorted.filter((os) => matchesFinancialFilter(os, filter)),
    [sorted, filter]
  );

  const urgentCount = useMemo(() => {
    return operationalQueue.filter(
      (os) => getServiceOrderNextAction(os).tone === "red"
    ).length;
  }, [operationalQueue]);

  const pendingFinancialCount = useMemo(() => {
    return sorted.filter((os) => {
      const status = String(os.financialSummary?.chargeStatus ?? "").toUpperCase();
      return status === "PENDING" || status === "OVERDUE";
    }).length;
  }, [sorted]);

  const readyToChargeCount = useMemo(() => {
    return sorted.filter((os) => matchesFinancialFilter(os, "READY_TO_CHARGE"))
      .length;
  }, [sorted]);

  const activeFromList = useMemo(() => {
    if (!activeId) return null;
    return sorted.find((item) => item.id === activeId) ?? null;
  }, [sorted, activeId]);

  const activeOs = useMemo(() => {
    const raw = activeQuery.data;

    if (raw && typeof raw === "object") {
      const normalized = normalizeOrders<ServiceOrder>(raw);
      if (normalized.length > 0) return normalized[0];
      return raw as ServiceOrder;
    }

    return activeFromList;
  }, [activeQuery.data, activeFromList]);

  useEffect(() => {
    const id = getOsFromLocation(location);
    if (id) setActiveId(id);
  }, [location]);

  useEffect(() => {
    if (activeId && sorted.some((item) => item.id === activeId)) return;

    if (operationalQueue.length === 0) {
      setActiveId(null);
      return;
    }

    const nextId = operationalQueue[0].id;
    setActiveId(nextId);
    navigate(buildServiceOrdersDeepLink(nextId));
  }, [operationalQueue, sorted, activeId, navigate]);

  function openAsActive(id: string) {
    navigate(buildServiceOrdersDeepLink(id));
    setActiveId(id);
  }

  async function refreshAll() {
    await Promise.all([
      utils.nexo.serviceOrders.list.invalidate(),
      activeId
        ? utils.nexo.serviceOrders.getById.invalidate({ id: activeId })
        : Promise.resolve(),
      utils.finance.charges.list.invalidate(),
      utils.dashboard.alerts.invalidate(),
    ]);
  }

  const filters: FinancialFilter[] = [
    "ALL",
    "NO_CHARGE",
    "READY_TO_CHARGE",
    "PENDING",
    "PAID",
    "OVERDUE",
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">
            Fila operacional central do NexoGestão.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>

          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova O.S.
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Fila visível
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {operationalQueue.length}
            </div>
            <div className="text-sm text-muted-foreground">
              {getQueueSummaryLabel(filter)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Urgentes
            </div>
            <div className="mt-1 text-2xl font-semibold">{urgentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Prontas para cobrar
            </div>
            <div className="mt-1 text-2xl font-semibold">{readyToChargeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Pendência financeira
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {pendingFinancialCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {getFinancialFilterLabel(f)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5 space-y-3">
          {operationalQueue.map((os) => {
            const whatsappUrl = buildWhatsAppUrlFromServiceOrder(os);
            const isActive = activeId === os.id;

            return (
              <div
                key={os.id}
                className={isActive ? "rounded-xl ring-2 ring-primary/20" : ""}
              >
                <ServiceOrderCard
                  os={os}
                  isProcessing={false}
                  chargeBadge={getChargeBadge(os.financialSummary)}
                  operationalStage={getOperationalStage(os)}
                  financialStage={getFinancialStage(os)}
                  onEdit={(id) => setEditId(id)}
                  onOpenDeepLink={openAsActive}
                  onOpenWhatsApp={(url) => navigate(url)}
                  isUpdating={false}
                />

                <div className="mt-2 flex justify-between px-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => whatsappUrl && navigate(whatsappUrl)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>

                  <Button size="sm" onClick={() => openAsActive(os.id)}>
                    Abrir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="xl:col-span-7">
          {activeOs ? (
            <ServiceOrderDetailsPanel os={activeOs} />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Selecione uma ordem para abrir o hub operacional.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CreateServiceOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refreshAll}
        customers={customers}
        people={people}
      />

      <EditServiceOrderModal
        isOpen={Boolean(editId)}
        serviceOrderId={editId}
        onClose={() => setEditId(null)}
        onSuccess={refreshAll}
        people={people}
      />
    </div>
  );
}
