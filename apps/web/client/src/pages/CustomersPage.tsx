// Operating-system contract: PageWrapper + NexoActionGroup
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useLocation } from "wouter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AppChartPanel,
  AppDataTable,
  AppFiltersBar,
  AppKpiRow,
  AppPageHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
  Input,
  AppAlertList,
  AppRowActions,
} from "@/components/internal-page-system";
import { AppNextActions } from "@/components/app";
import { buildOperationalRoute } from "@/lib/operational";

const growthData = [
  { month: "Jan", base: 240 },
  { month: "Fev", base: 258 },
  { month: "Mar", base: 281 },
  { month: "Abr", base: 312 },
];

export default function CustomersPage() {
  const [, navigate] = useLocation();
  return (
    <AppPageShell>
      <AppPageHeader title="Clientes" description="Veja quem está ativo, quem precisa de contato e onde agir primeiro." ctaLabel="Criar cliente agora" />
      <AppNextActions
        title="Você precisa fazer isso agora"
        engineInput={{
          customers: [
            { id: "c-atlas", name: "Atlas Engenharia", phone: "5511988881200" },
            { id: "c-solar", name: "Solar Prime", phone: "5511988881210" },
            { id: "c-orion", name: "Condomínio Orion", phone: "5511988881220" },
          ],
          charges: [{ id: "charge-customers-1", customerId: "c-atlas", status: "OVERDUE", amountCents: 20000, dueDate: "2026-04-05T10:00:00Z" }],
          serviceOrders: [],
          appointments: [],
        }}
      />
      <AppKpiRow items={[
        { label: "Clientes totais", value: "312", trend: 4.8, context: "vs mês anterior" },
        { label: "Ativos", value: "276", trend: 3.3, context: "últimos 30 dias" },
        { label: "Crescimento", value: "+31", trend: 12.5, context: "novos no período" },
        { label: "Ticket médio", value: "R$ 1.145", trend: 5.2, context: "por cliente ativo" },
      ]} />

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Crescimento da base" description="Evolução mensal de clientes ativos.">
          <ChartContainer className="h-[240px] w-full" config={{ base: { label: "Clientes" } }}>
            <BarChart data={growthData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="base" fill="var(--brand-primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Alertas de relacionamento" subtitle="Clientes que precisam de contato para evitar perda de receita">
          <AppAlertList alerts={[{ text: "12 clientes sem contato há mais de 15 dias", tone: "warning" }, { text: "3 contas estratégicas em risco de churn", tone: "danger" }]} />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Base de clientes" subtitle="Lista principal para agir em cada cliente com clareza">
        <AppFiltersBar>
          <Input placeholder="Buscar por nome, telefone ou e-mail" className="max-w-sm" />
        </AppFiltersBar>
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-left text-xs text-[var(--text-muted)]"><tr><th className="p-3">Nome</th><th>Telefone</th><th>Status</th><th>Último contato</th><th>Valor gerado</th><th className="p-3">Ações</th></tr></thead>
            <tbody>
              {["Atlas Engenharia", "Solar Prime", "Condomínio Orion"].map((name, i) => (
                <tr key={name} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-base)]/70">
                  <td className="p-3 font-medium text-[var(--text-primary)]">{name}</td><td>(11) 98888-12{i}0</td><td><AppStatusBadge label={i === 2 ? "Em risco" : "Concluído"} /></td><td>{i === 0 ? "há 2 horas" : "há 2 dias"}</td><td>R$ {(38 + i * 7).toFixed(1)}k</td><td className="p-3"><AppRowActions actions={[{ label: "Ver detalhes do cliente", onClick: () => navigate(buildOperationalRoute("/customers", { customer: name.toLowerCase() })) }]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppDataTable>
      </AppSectionBlock>
    </AppPageShell>
  );
}
