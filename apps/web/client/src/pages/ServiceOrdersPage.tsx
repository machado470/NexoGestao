import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { normalizeOrders } from "@/lib/operations/operations.utils";
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
  const utils = trpc.useUtils();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinancialFilter>("ALL");

  const listQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 50 },
    { retry: false, refetchOnWindowFocus: false }
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const peopleQuery = trpc.nexo.people.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const activeQuery = trpc.nexo.serviceOrders.getById.useQuery(
    { id: activeId as string },
    { enabled: Boolean(activeId), retry: false, refetchOnWindowFocus: false }
  );

  const customers = useMemo(
    () => normalizeOrders<{ id: string; name: string }>(customersQuery.data),
    [customersQuery.data]
  );

  const people = useMemo(
    () => normalizeOrders<{ id: string; name: string }>(peopleQuery.data),
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

  useEffect(() => {
    if (operationalQueue.length === 0) return;

    const stillExists = operationalQueue.some((item) => item.id === activeId);
    if (!stillExists) {
      setActiveId(operationalQueue[0].id);
    }
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">
            Centro da operação: execução, cobrança e status em tempo real.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)}>Nova O.S.</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((currentFilter) => (
          <Button
            key={currentFilter}
            size="sm"
            variant={filter === currentFilter ? "default" : "outline"}
            onClick={() => setFilter(currentFilter)}
          >
            {getFinancialFilterLabel(currentFilter)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5 2xl:col-span-4">
          <div className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Fila operacional</h2>
              <p className="text-xs text-muted-foreground">
                {operationalQueue.length} ordem(ns) no fluxo atual
              </p>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-3">
              {listQuery.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : operationalQueue.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma ordem neste fluxo.
                </div>
              ) : (
                <div className="space-y-3">
                  {operationalQueue.map((os) => {
                    const chargeBadge = getChargeBadge(os.financialSummary);
                    const operationalStage = getOperationalStage(os);
                    const financialStage = getFinancialStage(os);

                    return (
                      <div
                        key={os.id}
                        className={`rounded-2xl ${
                          activeId === os.id ? "ring-2 ring-blue-500" : ""
                        }`}
                      >
                        <ServiceOrderCard
                          os={os}
                          isProcessing={false}
                          chargeBadge={chargeBadge}
                          operationalStage={operationalStage}
                          financialStage={financialStage}
                          onEdit={(id) => setEditId(id)}
                          onOpenDeepLink={openAsActive}
                          isUpdating={false}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 2xl:col-span-8">
          <div className="rounded-xl border bg-card p-4">
            {!activeId ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Selecione uma ordem.
              </div>
            ) : activeOs ? (
              <ServiceOrderDetailsPanel os={activeOs} />
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateServiceOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          void utils.nexo.serviceOrders.list.invalidate();
        }}
        customers={customers}
        people={people}
      />

      <EditServiceOrderModal
        isOpen={Boolean(editId)}
        serviceOrderId={editId}
        onClose={() => setEditId(null)}
        onSuccess={() => {
          const id = editId;
          setEditId(null);

          void utils.nexo.serviceOrders.list.invalidate();

          if (id) {
            void utils.nexo.serviceOrders.getById.invalidate({ id });
          }
        }}
        people={people}
      />
    </div>
  );
}
