import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  buildWhatsAppUrlFromServiceOrder,
  normalizeOrders,
} from "@/lib/operations/operations.utils";
import {
  getChargeBadge,
  getFinancialStage,
  getOperationalStage,
  getPriorityScore,
  matchesFinancialFilter,
} from "@/lib/operations/operations.selectors";

import ServiceOrderCard from "@/components/service-orders/ServiceOrderCard";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";

import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import EditServiceOrderModal from "@/components/EditServiceOrderModal";

import type {
  FinancialFilter,
  ServiceOrder,
} from "@/components/service-orders/service-order.types";

function buildServiceOrdersUrl(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("os", id);
  return `${url.pathname}${url.search}`;
}

function getServiceOrderIdFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("os");
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

export default function ServiceOrdersPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinancialFilter>("ALL");

  const listQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 50 },
    { retry: false }
  );

  const customersQuery = trpc.nexo.customers.list.useQuery();
  const peopleQuery = trpc.nexo.people.list.useQuery();

  const activeQuery = trpc.nexo.serviceOrders.getById.useQuery(
    { id: activeId as string },
    { enabled: Boolean(activeId) }
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

  const activeFromList = useMemo(() => {
    if (!activeId) return null;
    return operationalQueue.find((item) => item.id === activeId) ?? null;
  }, [operationalQueue, activeId]);

  const activeOs = useMemo(() => {
    if (activeQuery.data && typeof activeQuery.data === "object") {
      return activeQuery.data as ServiceOrder;
    }
    return activeFromList;
  }, [activeQuery.data, activeFromList]);

  useEffect(() => {
    const deepLinkedId = getServiceOrderIdFromUrl();
    if (deepLinkedId) setActiveId(deepLinkedId);
  }, []);

  useEffect(() => {
    if (activeId) return;
    if (operationalQueue.length === 0) return;
    setActiveId(operationalQueue[0].id);
  }, [operationalQueue, activeId]);

  function openAsActive(id: string) {
    window.history.pushState({}, "", buildServiceOrdersUrl(id));
    setActiveId(id);
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
      <div className="flex justify-between">
        <h1 className="text-xl font-semibold">Ordens de Serviço</h1>
        <Button onClick={() => setIsCreateOpen(true)}>Nova O.S.</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5">
          <div className="space-y-3">
            {operationalQueue.map((os) => {
              const whatsappUrl = buildWhatsAppUrlFromServiceOrder(os);

              return (
                <div key={os.id} className="space-y-2">
                  <ServiceOrderCard
                    os={os}
                    isProcessing={false}
                    chargeBadge={getChargeBadge(os.financialSummary)}
                    operationalStage={getOperationalStage(os)}
                    financialStage={getFinancialStage(os)}
                    onEdit={(id) => setEditId(id)}
                    onOpenDeepLink={openAsActive}
                    isUpdating={false}
                  />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (whatsappUrl) navigate(whatsappUrl);
                      }}
                      disabled={!whatsappUrl}
                    >
                      WhatsApp
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAsActive(os.id)}
                    >
                      Abrir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-7">
          {activeOs ? (
            <ServiceOrderDetailsPanel os={activeOs} />
          ) : (
            <div className="text-sm text-muted-foreground">
              Selecione uma ordem.
            </div>
          )}
        </div>
      </div>

      <CreateServiceOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          utils.nexo.serviceOrders.list.invalidate();
        }}
        customers={customers}
        people={people}
      />

      <EditServiceOrderModal
        isOpen={Boolean(editId)}
        serviceOrderId={editId}
        onClose={() => setEditId(null)}
        onSuccess={() => {
          setEditId(null);
          utils.nexo.serviceOrders.list.invalidate();
        }}
        people={people}
      />
    </div>
  );
}
