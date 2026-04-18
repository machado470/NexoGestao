import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { getOperationalSeverityLabel, getServiceOrderSeverity } from "@/lib/operations/operational-intelligence";
import {
  AppDataTable,
  AppKpiRow,
  AppListBlock,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPriorityBadge,
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
  const topOS = [...orders]
    .sort((a, b) => {
      const priorityDiff = Number(b?.priority ?? 0) - Number(a?.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return (safeDate(b?.updatedAt)?.getTime() ?? 0) - (safeDate(a?.updatedAt)?.getTime() ?? 0);
    })
    .slice(0, 6);
  const travadasDetalhadas = [
    ...orders
      .filter(item => ["BLOCKED", "ON_HOLD", "PAUSED"].includes(String(item?.status ?? "").toUpperCase()))
      .slice(0, 3)
      .map((item) => ({
        title: String(item?.title ?? "O.S. sem título"),
        subtitle: `Status ${String(item?.status ?? "").toUpperCase()} · cliente ${String(item?.customer?.name ?? "não identificado")}`,
        action: <button className="nexo-cta-secondary" onClick={() => navigate(`/service-orders?serviceOrderId=${item?.id}`)}>Destravar</button>,
      })),
    ...orders
      .filter(item => !item?.assignedToPersonId)
      .slice(0, 2)
      .map((item) => ({
        title: `${String(item?.title ?? "O.S.")} sem responsável`,
        subtitle: "Sem técnico alocado para execução.",
        action: <button className="nexo-cta-secondary" onClick={() => setOpenCreate(true)}>Atribuir</button>,
      })),
    ...orders
      .filter(item => String(item?.status ?? "").toUpperCase() === "WAITING_CUSTOMER")
      .slice(0, 2)
      .map((item) => ({
        title: `${String(item?.title ?? "O.S.")} sem resposta do cliente`,
        subtitle: `Cliente ${String(item?.customer?.name ?? "não identificado")} aguardando retorno.`,
        action: <button className="nexo-cta-secondary" onClick={() => navigate(`/whatsapp?customerId=${item?.customerId}`)}>Cobrar retorno</button>,
      })),
  ].slice(0, 7);

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
        gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
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
        ]}
      />

      <AppSectionBlock
        title="Travadas"
        subtitle="Bloco principal: ordens que mais pressionam SLA e precisam de ação direta agora"
        className="p-6 lg:p-8"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">{semResponsavel} sem responsável · {semAvanco} sem avanço · {aguardandoCliente} aguardando cliente.</p>
          <ActionFeedbackButton state="idle" idleLabel="Destravar ordens agora" onClick={() => navigate("/service-orders?status=blocked")} />
        </div>
        <AppListBlock
          items={travadasDetalhadas.length > 0
            ? travadasDetalhadas
            : [{ title: "Sem travas críticas", subtitle: "Pipeline fluindo no momento.", action: <button className="nexo-cta-secondary" onClick={() => navigate("/finances")}>Seguir para cobrança</button> }]}
        />
      </AppSectionBlock>

      <section className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Top O.S. para executar agora" subtitle="Prioridade alta com ação operacional direta">
          <AppListBlock
            items={topOS.length > 0
              ? topOS.map((item) => ({
                  title: `${String(item?.title ?? "O.S. sem título")} · P${String(item?.priority ?? 2)}`,
                  subtitle: `${String(item?.customer?.name ?? "Cliente")} · ${String(item?.status ?? "").toUpperCase()}`,
                  action: <button className="nexo-cta-secondary" onClick={() => navigate(`/service-orders?serviceOrderId=${item?.id}`)}>Executar</button>,
                }))
              : [{ title: "Sem O.S. abertas", subtitle: "Crie uma ordem para iniciar execução.", action: <button className="nexo-cta-secondary" onClick={() => setOpenCreate(true)}>Criar O.S.</button> }]}
          />
        </AppSectionBlock>
        <AppSectionBlock title="Resumo de bloqueio" subtitle="Indicadores com CTA para destrave imediato">
          <AppListBlock
            items={[
              { title: `Travadas agora: ${travadas}`, subtitle: "Ataque o topo da fila para reduzir pressão de SLA.", action: <button className="nexo-cta-secondary" onClick={() => navigate("/service-orders?status=blocked")}>Destravar</button> },
              { title: `Sem responsável: ${semResponsavel}`, subtitle: "Distribua técnico para remover gargalo de execução.", action: <button className="nexo-cta-secondary" onClick={() => setOpenCreate(true)}>Atribuir</button> },
              { title: `Aguardando cliente: ${aguardandoCliente}`, subtitle: "Cobrança ativa de retorno evita tempo morto.", action: <button className="nexo-cta-secondary" onClick={() => navigate("/whatsapp")}>Cobrar retorno</button> },
            ]}
          />
        </AppSectionBlock>
      </section>

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
                  <th className="w-[168px] p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const status = String(order?.status ?? "").toUpperCase();
                  const hasCharge = Boolean(order?.financialSummary?.hasCharge);
                  const isPending = ["PENDENTE", "SCHEDULED", "OPEN", "ASSIGNED"].includes(status);
                  const isConfirmed = ["CONFIRMADO", "CONFIRMED", "IN_PROGRESS"].includes(status);
                  const isDoneWithoutCharge = status === "DONE" && !hasCharge;
                  const priorityLabel = isDoneWithoutCharge || isPending ? "HIGH" : isConfirmed ? "MEDIUM" : "LOW";
                  const nextAction = isPending
                    ? "Confirmar"
                    : isConfirmed
                      ? "Criar O.S."
                      : isDoneWithoutCharge
                        ? "Gerar cobrança"
                        : hasCharge
                          ? "Enviar WhatsApp"
                          : "Criar O.S.";
                  const handlePrimaryAction = () => {
                    if (nextAction === "Confirmar") {
                      navigate(`/whatsapp?customerId=${order.customerId}`);
                      return;
                    }
                    if (nextAction === "Criar O.S.") {
                      navigate(`/service-orders?serviceOrderId=${order.id}`);
                      return;
                    }
                    if (nextAction === "Gerar cobrança") {
                      navigate(`/finances?serviceOrderId=${order.id}`);
                      return;
                    }
                    navigate(`/whatsapp?customerId=${order.customerId}`);
                  };
                  return (
                    <tr key={String(order?.id)} className="border-t border-[var(--border-subtle)]">
                      <td className="p-3">{String(order?.title ?? "Sem título")}</td>
                      <td>{String(order?.customer?.name ?? "—")}</td>
                      <td><AppStatusBadge label={getOperationalSeverityLabel(getServiceOrderSeverity(order))} /></td>
                      <td className="p-3 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <AppPriorityBadge label={priorityLabel} />
                          <AppRowActionsDropdown
                            triggerLabel="Mais ações"
                            contentClassName="min-w-[220px]"
                            items={[
                              { label: `${nextAction} · prioritário`, onSelect: handlePrimaryAction },
                              ...(nextAction !== "Criar O.S."
                                ? [{ label: "Criar O.S.", onSelect: () => navigate(`/service-orders?serviceOrderId=${order.id}`) }]
                                : []),
                              ...(nextAction !== "Gerar cobrança"
                                ? [{ label: "Gerar cobrança", onSelect: () => navigate(`/finances?serviceOrderId=${order.id}`) }]
                                : []),
                              ...(nextAction !== "Enviar WhatsApp"
                                ? [{ label: "Enviar WhatsApp", onSelect: () => navigate(`/whatsapp?customerId=${order.customerId}`) }]
                                : []),
                              { label: "Reagendar", onSelect: () => navigate(`/appointments`) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
