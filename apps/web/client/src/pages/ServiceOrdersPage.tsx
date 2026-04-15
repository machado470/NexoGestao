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
  const travadas = orders.filter(item => ["BLOCKED", "ON_HOLD", "PAUSED"].includes(String(item?.status ?? "").toUpperCase())).length;
  const semResponsavel = orders.filter(item => !item?.assignedToPersonId).length;
  const aguardandoCliente = orders.filter(item => String(item?.status ?? "").toUpperCase() === "WAITING_CUSTOMER").length;
  const semAvanco = orders.filter((item) => {
    const status = String(item?.status ?? "").toUpperCase();
    return status === "OPEN" || status === "ASSIGNED";
  }).length;
  const valorPotencialCobranca = orders
    .filter(item => String(item?.status ?? "").toUpperCase() === "DONE" && !item?.financialSummary?.hasCharge)
    .reduce((acc, item) => acc + Number(item?.financialSummary?.estimatedAmountCents ?? item?.amountCents ?? 0), 0);
  const valorPotencialFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorPotencialCobranca / 100);

  return (
    <PageWrapper title="Ordens de Serviço" subtitle="Centro da operação: execução, cobrança e próxima ação sem ruído.">
      <OperationalTopCard
        contextLabel="Direção de execução"
        title="Pipeline de ordens de serviço"
        description="Leitura direta da rotina de campo: o que está aberto, em execução, travado e pronto para cobrança."
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
          { title: "Em execução", value: String(inProgress), hint: "equipes com atendimento em campo" },
          { title: "Concluídas", value: String(done), hint: "serviços finalizados" },
          { title: "Prontas p/ cobrança", value: String(pipeline.prontaCobranca), hint: "concluídas e sem cobrança ativa" },
          { title: "Travadas", value: String(travadas), hint: "pedem desbloqueio imediato" },
          { title: "Base de clientes", value: String(customers.length), hint: "vinculáveis à execução" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <AppNextActionCard
          title="Travadas"
          description={`${semResponsavel} sem responsável · ${semAvanco} sem avanço · ${aguardandoCliente} aguardando cliente.`}
          severity={travadas + semResponsavel > 0 ? "high" : "medium"}
          metadata="ordens em risco"
          action={{ label: "Destravar ordens", onClick: () => navigate("/service-orders?status=blocked") }}
        />
        <AppNextActionCard
          title="Prontas para cobrar"
          description={`${pipeline.prontaCobranca} O.S. concluídas sem cobrança ativa${valorPotencialCobranca > 0 ? ` · potencial ${valorPotencialFormatado}` : ""}.`}
          severity={pipeline.prontaCobranca > 0 ? "high" : "low"}
          metadata="oportunidade de receita"
          action={{ label: "Gerar cobrança", onClick: () => navigate("/finances?status=pending&source=service-order") }}
        />
      </div>

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
                          description={order?.financialSummary?.hasCharge ? "Cobrança já vinculada, mantenha cliente informado." : "Sem cobrança vinculada após execução."}
                          severity={order?.financialSummary?.hasCharge ? "medium" : "high"}
                          metadata="ordem de serviço"
                          action={{
                            label: String(order?.financialSummary?.hasCharge ? "Enviar WhatsApp" : "Gerar cobrança"),
                            onClick: () => navigate(order?.financialSummary?.hasCharge ? `/whatsapp?customerId=${order.customerId}` : `/finances?serviceOrderId=${order.id}`),
                          }}
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
