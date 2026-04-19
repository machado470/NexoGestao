import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import type { ReactNode } from "react";
import { Button } from "@/components/design-system";
import {
  AppChartPanel,
  AppKpiRow,
  AppListBlock,
  AppNextActionCard,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
} from "@/components/internal-page-system";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FinanceOverviewProps {
  kpis: Array<{ title: string; value: string; hint?: string; delta?: string; trend?: "up" | "down" | "neutral"; tone?: "default" | "important" | "critical" }>;
  revenueData: Array<{ label: string; revenue: number }>;
  revenueLoading: boolean;
  revenueError?: string;
  isRevenueValid: boolean;
  revenueInvalidReason?: string;
  riskSummary: string;
  openCreate: () => void;
  cobrarAgora: () => void;
  nextActions: Array<{ title: string; subtitle?: string; action?: ReactNode }>;
}

export function FinanceOverview(props: FinanceOverviewProps) {
  return (
    <div className="space-y-4">
      <AppKpiRow items={props.kpis} />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AppChartPanel title="Receita por mês" description="Evolução mensal para confirmar tendência de entrada.">
            {props.revenueLoading && props.revenueData.length === 0 ? (
              <AppPageLoadingState description="Carregando evolução de receita..." />
            ) : props.revenueError && props.revenueData.length === 0 ? (
              <AppPageErrorState description={props.revenueError} actionLabel="Tentar novamente" onAction={props.openCreate} />
            ) : !props.isRevenueValid ? (
              <AppPageEmptyState title="Erro ao renderizar gráfico" description={props.revenueInvalidReason ?? "Dados inválidos do gráfico."} />
            ) : props.revenueData.length === 0 ? (
              <AppPageEmptyState title="Ainda sem histórico mensal" description="Use os cards ao lado para gerar entradas hoje." />
            ) : (
              <ChartContainer className="h-[260px] w-full" config={{ revenue: { label: "Receita" } }}>
                <AreaChart data={props.revenueData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="revenue" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.2} />
                </AreaChart>
              </ChartContainer>
            )}
          </AppChartPanel>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <AppSectionBlock
            title="Risco do caixa"
            subtitle={props.riskSummary}
            className="border-rose-500/20 bg-rose-500/5"
          >
            <ActionFeedbackButton state="idle" idleLabel="Cobrar agora" onClick={props.cobrarAgora} />
          </AppSectionBlock>

          <AppNextActionCard
            title="Próximas ações"
            description="Priorize cobranças com vencimento hoje e próximos 7 dias."
            severity="high"
            metadata="operação"
            action={{ label: "Criar cobrança", onClick: props.openCreate }}
          />
        </div>
      </div>

      <AppSectionBlock title="Fila rápida" subtitle="Sem tabela extensa: apenas próximos itens a operar.">
        <AppListBlock
          items={props.nextActions.length > 0
            ? props.nextActions
            : [{ title: "Sem cobranças na fila", subtitle: "Crie cobrança para alimentar o fluxo.", action: <Button size="sm" variant="outline" onClick={props.openCreate}>Criar cobrança</Button> }]}
        />
      </AppSectionBlock>
    </div>
  );
}
