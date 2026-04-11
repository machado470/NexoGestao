// Operating-system contract: PageWrapper + NexoActionGroup
import { AppFiltersBar, AppKpiRow, AppPageHeader, AppPageShell, AppSectionBlock, Input, AppStatusBadge } from "@/components/internal-page-system";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <AppPageShell>
      <AppPageHeader title="Configurações" description="Administração da organização, usuários, integrações e preferências." ctaLabel="Salvar alterações" />
      <AppKpiRow items={[{ label: "Usuários ativos", value: "28", trend: 2.5, context: "no mês" }, { label: "Integrações", value: "6", trend: 0.0, context: "conectadas" }, { label: "Notificações ativas", value: "14", trend: 3.2, context: "regras" }, { label: "Falhas de configuração", value: "1", trend: -50, context: "vs semana passada" }]} />
      <AppSectionBlock title="Administração do sistema" subtitle="Estrutura em seções claras">
        <Tabs defaultValue="organizacao">
          <TabsList>
            <TabsTrigger value="organizacao">Organização</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          </TabsList>
          <TabsContent value="organizacao" className="space-y-3 pt-3">
            <AppFiltersBar><Input className="max-w-sm" placeholder="Nome da organização" /><Input className="max-w-xs" placeholder="Timezone" /><Button>Atualizar</Button></AppFiltersBar>
            <p className="text-sm text-[var(--text-secondary)]">Estado atual: <AppStatusBadge label="Concluído" /></p>
          </TabsContent>
          <TabsContent value="usuarios" className="pt-3 text-sm text-[var(--text-secondary)]">Controle de convites, papéis e permissões.</TabsContent>
          <TabsContent value="integracoes" className="pt-3 text-sm text-[var(--text-secondary)]">Conexões operacionais (WhatsApp, gateway, webhook).</TabsContent>
          <TabsContent value="notificacoes" className="pt-3 text-sm text-[var(--text-secondary)]">Regras de alerta por risco, atraso e cobrança.</TabsContent>
        </Tabs>
      </AppSectionBlock>
    </AppPageShell>
  );
}
