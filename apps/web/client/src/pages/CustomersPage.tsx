// Operating-system contract: PageWrapper + NexoActionGroup
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
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
} from "@/components/internal-page-system";

const growthData = [
  { month: "Jan", base: 240 },
  { month: "Fev", base: 258 },
  { month: "Mar", base: 281 },
  { month: "Abr", base: 312 },
];

export default function CustomersPage() {
  return (
    <AppPageShell>
      <AppPageHeader title="Clientes" description="Gestão da base, valor e engajamento operacional." ctaLabel="Novo cliente" />
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
        <AppSectionBlock title="Alertas de relacionamento" subtitle="Clientes sem contato recente">
          <AppAlertList alerts={[{ text: "12 clientes sem contato há mais de 15 dias", tone: "warning" }, { text: "3 contas estratégicas em risco de churn", tone: "danger" }]} />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Base de clientes" subtitle="Lista operacional dominante">
        <AppFiltersBar>
          <Input placeholder="Buscar por nome, telefone ou e-mail" className="max-w-sm" />
        </AppFiltersBar>
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-left text-xs text-[var(--text-muted)]"><tr><th className="p-3">Nome</th><th>Telefone</th><th>Status</th><th>Último contato</th><th>Valor gerado</th><th className="p-3">Ações</th></tr></thead>
            <tbody>
              {["Atlas Engenharia", "Solar Prime", "Condomínio Orion"].map((name, i) => (
                <tr key={name} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-base)]/70">
                  <td className="p-3 font-medium text-[var(--text-primary)]">{name}</td><td>(11) 98888-12{i}0</td><td><AppStatusBadge label={i === 2 ? "Em risco" : "Concluído"} /></td><td>{i === 0 ? "há 2h" : "há 2 dias"}</td><td>R$ {(38 + i * 7).toFixed(1)}k</td><td className="p-3 text-[var(--brand-primary)]">Ver detalhes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppDataTable>
      </AppSectionBlock>
    </AppPageShell>
  );
}
