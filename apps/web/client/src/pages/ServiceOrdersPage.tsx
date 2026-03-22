import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { normalizeList } from "@/lib/utils/normalizeList";
import ServiceOrderCard from "@/components/service-orders/ServiceOrderCard";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import EditServiceOrderModal from "@/components/EditServiceOrderModal";
import {
  getChargeBadge,
  getFinancialStage,
  getOperationalStage,
  getPriorityScore,
  matchesFinancialFilter,
  getServiceOrderIdFromUrl,
  buildServiceOrdersUrl,
} from "@/components/service-orders/service-order.utils";
import type {
  FinancialFilter,
  ServiceOrder,
} from "@/components/service-orders/service-order.types";

export default function ServiceOrdersPage() {
  const utils = trpc.useUtils();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinancialFilter>("ALL");

  const listQuery = trpc.nexo.serviceOrders.list.useQuery({
    page: 1,
    limit: 50,
  });

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });

  const customers = useMemo(() => {
    return normalizeList<{ id: string; name: string }>(customersQuery.data);
  }, [customersQuery.data]);

  const people: { id: string; name: string }[] = [];

  const generateCharge = trpc.nexo.serviceOrders.generateCharge.useMutation({
    onSuccess: () => utils.nexo.serviceOrders.list.invalidate(),
  });

  const startExecution = trpc.nexo.executions.start.useMutation({
    onSuccess: () => utils.nexo.serviceOrders.list.invalidate(),
  });

  const finishExecution = trpc.nexo.executions.complete.useMutation({
    onSuccess: () => utils.nexo.serviceOrders.list.invalidate(),
  });

  const list = useMemo(() => {
    return normalizeList<ServiceOrder>(listQuery.data);
  }, [listQuery.data]);

  const sorted = useMemo(() => {
    return [...list].sort(
      (a: ServiceOrder, b: ServiceOrder) =>
        getPriorityScore(b) - getPriorityScore(a),
    );
  }, [list]);

  const filtered = useMemo(() => {
    return sorted.filter((os) => matchesFinancialFilter(os, filter));
  }, [sorted, filter]);

  useEffect(() => {
    const id = getServiceOrderIdFromUrl();
    if (id) setExpandedId(id);
  }, []);

  function openDeepLink(id: string) {
    window.history.pushState({}, "", buildServiceOrdersUrl(id));
    setExpandedId(id);
  }

  async function handleStart(os: ServiceOrder) {
    try {
      setProcessingId(os.id);
      await startExecution.mutateAsync({ serviceOrderId: os.id });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleFinish(os: ServiceOrder) {
    try {
      setProcessingId(os.id);
      await finishExecution.mutateAsync({ id: os.id });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCharge(os: ServiceOrder) {
    try {
      setProcessingId(os.id);
      await generateCharge.mutateAsync({ id: os.id });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ordens de Serviço</h1>
        <Button onClick={() => setIsCreateOpen(true)}>Nova O.S.</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          "ALL",
          "NO_CHARGE",
          "READY_TO_CHARGE",
          "PENDING",
          "PAID",
          "OVERDUE",
        ].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f as FinancialFilter)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((os: ServiceOrder) => {
          const chargeBadge = getChargeBadge(os.financialSummary);
          const operationalStage = getOperationalStage(os);
          const financialStage = getFinancialStage(os);

          return (
            <ServiceOrderCard
              key={os.id}
              os={os}
              isExpanded={expandedId === os.id}
              isProcessing={processingId === os.id}
              chargeBadge={chargeBadge}
              canGenerateCharge={
                financialStage.label === "Pronta para cobrança"
              }
              canStartExecution={
                os.status !== "IN_PROGRESS" && os.status !== "DONE"
              }
              operationalStage={operationalStage}
              financialStage={financialStage}
              onEdit={(id) => setEditId(id)}
              onStartExecution={handleStart}
              onFinishExecution={handleFinish}
              onGenerateCharge={handleCharge}
              onOpenDeepLink={openDeepLink}
              onToggleExpanded={(id) =>
                setExpandedId((prev) => (prev === id ? null : id))
              }
              isUpdating={false}
              isStartingExecution={startExecution.isPending}
              isFinishingExecution={finishExecution.isPending}
              isGeneratingCharge={generateCharge.isPending}
            />
          );
        })}
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
