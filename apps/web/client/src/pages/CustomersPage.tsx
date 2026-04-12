import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
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

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
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
  const customersWithOverdue = new Set(
    charges
      .filter((item) => String(item?.status ?? "").toUpperCase() === "OVERDUE")
      .map((item) => String(item?.customerId ?? ""))
      .filter(Boolean)
  );

  return (
    <PageWrapper title="Clientes" subtitle="Cadastre clientes reais e avance o fluxo operacional sem rupturas.">
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
          { label: "Clientes totais", value: String(customers.length), trend: 0, context: "dados reais do backend" },
          { label: "Ativos", value: String(activeCustomers), trend: 0, context: "clientes ativos" },
          { label: "Com cobrança vencida", value: String(customersWithOverdue.size), trend: 0, context: "exigem ação" },
          { label: "Sem cobrança", value: String(Math.max(customers.length - charges.length, 0)), trend: 0, context: "potencial de receita" },
        ]}
      />

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
    </PageWrapper>
  );
}
