import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { getOperationalSeverityLabel, getServiceOrderSeverity } from "@/lib/operations/operational-intelligence";
import {
  AppDataTable,
  AppKpiRow,
  AppNextActionCard,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPriorityBadge,
  AppRowActions,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { formatDelta, getWindow, inRange, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";

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
  usePageDiagnostics({
    page: "service-orders",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty: !showInitialLoading && !showErrorState && orders.length === 0,
    dataCount: orders.length,
  });

  const inProgress = orders.filter((item) => String(item?.status ?? "").toUpperCase() === "IN_PROGRESS").length;
  const done = orders.filter((item) => String(item?.status ?? "").toUpperCase() === "DONE").length;
  const current7 = getWindow(7, 0);
  const previous7 = getWindow(7, 1);
  const openedCurrent = orders.filter(item => inRange(safeDate(item?.createdAt), current7.start, current7.end)).length;
  const openedPrevious = orders.filter(item => inRange(safeDate(item?.createdAt), previous7.start, previous7.end)).length;
  const pipeline = {
    aberta: orders.filter(item => ["OPEN", "ASSIGNED"].includes(String(item?.status ?? "").toUpperCase())).length,
    execucao: orders.filter(item => String(item?.status ?? "").toUpperCase() === "IN_PROGRESS").length,
    concluida: orders.filter(item => String(item?.status ?? "").toUpperCase() === "DONE").length,
    prontaCobranca: orders.filter(item => String(item?.status ?? "").toUpperCase() === "DONE" && !item?.financialSummary?.hasCharge).length,
  };

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
          {
            title: "O.S. abertas",
            value: String(openedCurrent),
            delta: formatDelta(percentDelta(openedCurrent, openedPrevious)),
            trend: trendFromDelta(percentDelta(openedCurrent, openedPrevious)),
            hint: "últimos 7 dias",
          },
          { title: "Em execução", value: String(inProgress), hint: "status IN_PROGRESS" },
          { title: "Concluídas", value: String(done), hint: "status DONE" },
          { title: "Prontas p/ cobrança", value: String(pipeline.prontaCobranca), hint: "concluídas sem cobrança" },
          { title: "Base de clientes", value: String(customers.length), hint: "vinculáveis à execução" },
        ]}
      />

      <AppSectionBlock title="Leitura executiva do pipeline" subtitle="Coração operacional da execução">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Abertas: <strong>{pipeline.aberta}</strong></div>
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Em execução: <strong>{pipeline.execucao}</strong></div>
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Concluídas: <strong>{pipeline.concluida}</strong></div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Prontas para cobrança: <strong>{pipeline.prontaCobranca}</strong></div>
        </div>
      </AppSectionBlock>

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
                      <div className="space-y-2">
                        <AppNextActionCard
                          title="Próxima ação"
                          action={String(order?.financialSummary?.hasCharge ? "Enviar WhatsApp" : "Gerar cobrança")}
                          reason={order?.financialSummary?.hasCharge ? "Cobrança já vinculada, mantenha cliente informado." : "Sem cobrança vinculada após execução."}
                          onExecute={() => navigate(order?.financialSummary?.hasCharge ? `/whatsapp?customerId=${order.customerId}` : `/finances?serviceOrderId=${order.id}`)}
                        />
                        <AppRowActions actions={[
                          { label: "Gerar cobrança", onClick: () => navigate(`/finances?serviceOrderId=${order.id}`) },
                          { label: "Enviar WhatsApp", onClick: () => navigate(`/whatsapp?customerId=${order.customerId}`) },
                        ]} />
                      </div>
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
