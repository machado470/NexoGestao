import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import {
  AppDataTable,
  AppEmptyState,
  AppKpiRow,
  AppLoadingState,
  AppPageHeader,
  AppPageShell,
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

  const activeCustomers = customers.filter((item) => item?.active !== false).length;
  const customersWithOverdue = new Set(
    charges
      .filter((item) => String(item?.status ?? "").toUpperCase() === "OVERDUE")
      .map((item) => String(item?.customerId ?? ""))
      .filter(Boolean)
  );

  return (
    <AppPageShell>
      <AppPageHeader
        title="Clientes"
        description="Cadastre clientes reais, acompanhe status e siga para os próximos passos da operação."
        ctaLabel="Criar cliente agora"
        onCta={() => setCreateOpen(true)}
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
        {customersQuery.isLoading ? (
          <AppLoadingState rows={4} />
        ) : customers.length === 0 ? (
          <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cliente" />
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
    </AppPageShell>
  );
}
