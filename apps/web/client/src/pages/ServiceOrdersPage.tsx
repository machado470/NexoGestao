import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { getOperationalSeverityLabel, getServiceOrderSeverity } from "@/lib/operations/operational-intelligence";
import {
  AppDataTable,
  AppKpiRow,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPriorityBadge,
  AppRowActions,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

export default function ServiceOrdersPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);
  const orders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const hasData = orders.length > 0;
  const showInitialLoading = serviceOrdersQuery.isLoading && !hasData;
  const showErrorState = serviceOrdersQuery.error && !hasData;

  const inProgress = orders.filter((item) => String(item?.status ?? "").toUpperCase() === "IN_PROGRESS").length;
  const done = orders.filter((item) => String(item?.status ?? "").toUpperCase() === "DONE").length;

  return (
    <PageWrapper title="Ordens de Serviço" subtitle="Pipeline operacional sem desvio de contrato entre módulos.">
      <OperationalTopCard
        contextLabel="Direção de execução"
        title="Pipeline de ordens de serviço"
        description="Execução real conectada ao backend com próximos passos de cobrança e WhatsApp."
        primaryAction={(
          <ActionFeedbackButton state="idle" idleLabel="Criar nova O.S. agora" onClick={() => setOpenCreate(true)} />
        )}
      />

      <AppKpiRow
        items={[
          { label: "Total", value: String(orders.length), trend: 0, context: "ordens registradas" },
          { label: "Em execução", value: String(inProgress), trend: 0, context: "andamento atual" },
          { label: "Concluídas", value: String(done), trend: 0, context: "prontas para cobrança" },
          { label: "Clientes", value: String(customers.length), trend: 0, context: "base vinculável" },
        ]}
      />

      <AppSectionBlock title="Pipeline operacional" subtitle="Cada O.S. com ação real">
        {showInitialLoading ? (
          <AppPageLoadingState description="Carregando ordens de serviço..." />
        ) : showErrorState ? (
          <AppPageErrorState
            description={serviceOrdersQuery.error?.message ?? "Falha ao carregar ordens de serviço."}
            actionLabel="Tentar novamente"
            onAction={() => void serviceOrdersQuery.refetch()}
          />
        ) : orders.length === 0 ? (
          <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar ordem de serviço" />
        ) : (
          <AppDataTable>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Título</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={String(order?.id)} className="border-t border-[var(--border-subtle)]">
                    <td className="p-3">{String(order?.title ?? "Sem título")}</td>
                    <td>{String(order?.customer?.name ?? "—")}</td>
                    <td><AppStatusBadge label={getOperationalSeverityLabel(getServiceOrderSeverity(order))} /></td>
                    <td><AppPriorityBadge label={`P${String(order?.priority ?? 2)}`} /></td>
                    <td className="p-3">
                      <AppRowActions actions={[
                        { label: "Gerar cobrança", onClick: () => navigate(`/finances?serviceOrderId=${order.id}`) },
                        { label: "Enviar WhatsApp", onClick: () => navigate(`/whatsapp?customerId=${order.customerId}`) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>

      <CreateServiceOrderModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={() => {
          void serviceOrdersQuery.refetch();
        }}
        customers={customers.map((item) => ({ id: String(item.id), name: String(item.name ?? "Cliente") }))}
        people={people.map((item) => ({ id: String(item.id), name: String(item.name ?? "Pessoa") }))}
      />
    </PageWrapper>
  );
}
