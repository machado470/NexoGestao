import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import { CustomerWorkspaceModal } from "@/components/CustomerWorkspaceModal";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { Button } from "@/components/design-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppDataTable,
  AppKpiRow,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppRowActions,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { formatDelta, getWindow, inRange, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 200 }, { retry: false });

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const hasData = customers.length > 0;
  const showInitialLoading = customersQuery.isLoading && !hasData;
  const showErrorState = customersQuery.error && !hasData;
  usePageDiagnostics({
    page: "customers",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty: !showInitialLoading && !showErrorState && customers.length === 0,
    dataCount: customers.length,
  });

  const activeCustomers = customers.filter((item) => item?.active !== false).length;
  const currentWindow = getWindow(30, 0);
  const previousWindow = getWindow(30, 1);
  const newCustomersCurrent = customers.filter(item => inRange(safeDate(item?.createdAt), currentWindow.start, currentWindow.end)).length;
  const newCustomersPrevious = customers.filter(item => inRange(safeDate(item?.createdAt), previousWindow.start, previousWindow.end)).length;
  const customersWithOverdue = new Set(
    charges
      .filter((item) => String(item?.status ?? "").toUpperCase() === "OVERDUE")
      .map((item) => String(item?.customerId ?? ""))
      .filter(Boolean)
  );
  const withoutEmail = customers.filter((item) => !String(item?.email ?? "").trim()).length;
  const withoutPhone = customers.filter((item) => !String(item?.phone ?? "").trim()).length;

  return (
    <PageWrapper title="Clientes" subtitle="Base comercial viva para atendimento, execução e cobrança.">
      <OperationalTopCard
        contextLabel="Direção comercial"
        title="Base de clientes operacional"
        description="Cadastre clientes reais, acompanhe status e siga para os próximos passos da operação."
        chips={(
          <>
            <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]">Ativos: {activeCustomers}</span>
            <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]">Em risco: {customersWithOverdue.size}</span>
          </>
        )}
        primaryAction={(
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Criar cliente agora
          </Button>
        )}
      />

      <AppKpiRow
        items={[
          { title: "Clientes ativos", value: String(activeCustomers), hint: "base ativa atual" },
          {
            title: "Novos no período",
            value: String(newCustomersCurrent),
            delta: formatDelta(percentDelta(newCustomersCurrent, newCustomersPrevious)),
            trend: trendFromDelta(percentDelta(newCustomersCurrent, newCustomersPrevious)),
            hint: "últimos 30 dias vs período anterior",
          },
          { title: "Com pendência financeira", value: String(customersWithOverdue.size), hint: "com cobrança vencida" },
          { title: "Sem cobrança", value: String(Math.max(customers.length - charges.length, 0)), hint: "potencial de monetização" },
        ]}
      />

      <AppSectionBlock title="Leitura operacional da carteira" subtitle="Onde agir primeiro para evitar atraso de receita">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Em risco financeiro: <strong>{customersWithOverdue.size}</strong></div>
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Sem e-mail: <strong>{withoutEmail}</strong></div>
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Sem telefone: <strong>{withoutPhone}</strong></div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Próxima ação: <strong>{customersWithOverdue.size > 0 ? "cobrar pendentes hoje" : "ativar clientes sem cobrança"}</strong></div>
        </div>
      </AppSectionBlock>

      <AppSectionBlock title="Base de clientes" subtitle="Lista sincronizada com backend">
        {showInitialLoading ? (
          <AppPageLoadingState description="Carregando base de clientes..." />
        ) : showErrorState ? (
          <AppPageErrorState
            description={customersQuery.error?.message ?? "Falha ao carregar clientes."}
            actionLabel="Tentar novamente"
            onAction={() => void customersQuery.refetch()}
          />
        ) : customers.length === 0 ? (
          <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cliente" />
        ) : (
          <AppDataTable>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-left text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Nome</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const hasOverdue = customersWithOverdue.has(String(customer?.id ?? ""));
                  return (
                    <tr key={String(customer?.id)} className="border-t border-[var(--border-subtle)]">
                      <td className="p-3 font-medium">{String(customer?.name ?? "Sem nome")}</td>
                      <td>{String(customer?.phone ?? "—")}</td>
                      <td>{String(customer?.email ?? "—")}</td>
                      <td><AppStatusBadge label={hasOverdue ? "Em risco" : "Concluído"} /></td>
                      <td className="p-3">
                        <AppRowActions
                          actions={[
                            {
                              label: "Abrir workspace",
                              onClick: () => {
                                setSelectedCustomerId(String(customer.id));
                                setSelectedCustomerName(String(customer?.name ?? "Cliente"));
                              },
                            },
                            { label: "Criar agendamento", onClick: () => navigate(`/appointments?customerId=${customer.id}`) },
                            { label: "Criar O.S.", onClick: () => navigate(`/service-orders?customerId=${customer.id}`) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>

      <CreateCustomerModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (created) => {
          setCreateOpen(false);
          await customersQuery.refetch();
          if (created?.id) navigate(`/appointments?customerId=${created.id}`);
        }}
      />

      <CustomerWorkspaceModal
        open={Boolean(selectedCustomerId)}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCustomerId(null);
            setSelectedCustomerName("");
          }
        }}
      />
    </PageWrapper>
  );
}
