import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  AppAlertList,
  AppChartPanel,
  AppKpiRow,
  AppListBlock,
  AppPageHeader,
  AppPageShell,
  AppRecentActivity,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

export default function WhatsAppPage() {
  const [, navigate] = useLocation();
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const data = [{ day: "Seg", enviadas: 92, falhas: 4 }, { day: "Ter", enviadas: 106, falhas: 5 }, { day: "Qua", enviadas: 118, falhas: 3 }, { day: "Qui", enviadas: 133, falhas: 8 }, { day: "Sex", enviadas: 97, falhas: 2 }];

  const runAction = async (actionId: string, callback: () => void) => {
    try {
      setLoadingActionId(actionId);
      await new Promise(resolve => setTimeout(resolve, 280));
      callback();
      toast.success("Ação concluída.");
    } catch {
      toast.error("Erro ao executar ação.");
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <AppPageShell>
      <AppPageHeader title="WhatsApp Operacional" description="Comunicação contextual vinculada a cliente, cobrança e O.S." ctaLabel="Nova mensagem" onCta={() => runAction("new-message", () => navigate("/whatsapp?composer=open"))} />
      <AppSectionBlock title="Contexto da conversa" subtitle="Atlas Engenharia · cobrança vencida há 2 dias">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AppStatusBadge label="Cobrança vencida" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => runAction("quick-charge", () => navigate("/finances?status=overdue&customer=atlas"))} isLoading={loadingActionId === "quick-charge"}>Cobrar</Button>
            <Button size="sm" variant="secondary" onClick={() => runAction("quick-link", () => navigate("/whatsapp?customer=atlas&template=payment-link"))} isLoading={loadingActionId === "quick-link"}>Enviar link</Button>
            <Button size="sm" variant="outline" onClick={() => runAction("quick-confirm", () => navigate("/timeline?customer=atlas&type=confirmation"))} isLoading={loadingActionId === "quick-confirm"}>Confirmar</Button>
          </div>
        </div>
      </AppSectionBlock>
      <AppKpiRow items={[{ label: "Enviadas", value: "546", trend: 6.4, context: "+18 hoje · últimos 7 dias", onClick: () => navigate("/whatsapp?metric=sent&period=7d") }, { label: "Entregues", value: "519", trend: 5.9, context: "↑ taxa de entrega · 7 dias", onClick: () => navigate("/whatsapp?metric=delivered&period=7d") }, { label: "Falhas", value: "19", trend: -3.7, context: "-2 hoje · semana atual", onClick: () => navigate("/whatsapp?status=failed&period=7d") }, { label: "Taxa entrega", value: "95,0%", trend: 1.2, context: "estável · média móvel", onClick: () => navigate("/whatsapp?metric=delivery_rate&period=7d") }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Volume e falhas de envio" description="Saúde de comunicação operacional." trendValue={9.4} trendLabel="↑ +9,4% · últimos 7 dias" onCtaClick={() => navigate("/whatsapp?chart=send_failures&period=7d")}>
          <ChartContainer className="h-[240px] w-full" config={{ enviadas: { label: "Enviadas" }, falhas: { label: "Falhas" } }}>
            <BarChart data={data}><CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="enviadas" fill="var(--brand-primary)" /><Bar dataKey="falhas" fill="var(--color-danger)" /></BarChart>
          </ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Falhas recentes" subtitle="Entrega e roteamento" onCtaClick={() => navigate("/whatsapp?status=failed")}>
          <AppAlertList alerts={[{ text: "3 falhas por número inválido", tone: "warning" }, { text: "2 falhas por timeout da API", tone: "danger" }]} />
        </AppSectionBlock>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Conversas por contexto" subtitle="Lista operacional dominante">
          <AppListBlock items={[{ title: "Atlas Engenharia", subtitle: "Cobrança #218 · enviada há 5 min", right: <AppStatusBadge label="Entregue" />, action: <Button size="sm" onClick={() => runAction("open-atlas", () => navigate("/whatsapp?customer=atlas"))} isLoading={loadingActionId === "open-atlas"}>Abrir</Button> }, { title: "Condomínio Orion", subtitle: "O.S. #1849 · mensagem de atraso", right: <AppStatusBadge label="Pendente" />, action: <Button size="sm" onClick={() => runAction("charge-orion", () => navigate("/whatsapp?customer=orion&context=charge"))} isLoading={loadingActionId === "charge-orion"}>Cobrar</Button> }, { title: "Solar Prime", subtitle: "Agendamento #443", right: <AppStatusBadge label="Falhou" />, action: <Button size="sm" onClick={() => runAction("retry-solar", () => navigate("/whatsapp?customer=solar-prime&action=retry"))} isLoading={loadingActionId === "retry-solar"}>Avançar status</Button> }]} />
        </AppSectionBlock>
        <AppSectionBlock title="Atividade da comunicação" subtitle="Contexto recente" onCtaClick={() => navigate("/timeline?source=whatsapp")}>
          <AppRecentActivity items={["Template cobrança enviado há 3 min", "Confirmação de agendamento há 8 min", "Reenvio de mensagem por falha há 15 min"]} />
        </AppSectionBlock>
      </div>
    </AppPageShell>
  );
}
