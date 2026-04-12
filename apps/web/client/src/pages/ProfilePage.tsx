import { AppPageHeader, AppPageShell, AppSectionBlock, AppRecentActivity, AppFiltersBar, Input } from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  return (
    <AppPageShell>
      <AppPageHeader title="Perfil" description="Dados pessoais, segurança e preferências individuais." ctaLabel="Salvar perfil" />
      <div className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Dados pessoais" subtitle="Informações básicas do usuário">
          <AppFiltersBar><Input placeholder="Nome" className="max-w-sm" /><Input placeholder="E-mail" className="max-w-sm" /><Button>Atualizar dados</Button></AppFiltersBar>
        </AppSectionBlock>
        <AppSectionBlock title="Segurança" subtitle="Senha, sessão e validações">
          <AppFiltersBar><Input placeholder="Nova senha" className="max-w-sm" /><Button>Trocar senha</Button></AppFiltersBar>
        </AppSectionBlock>
      </div>
      <AppSectionBlock title="Atividade e contexto" subtitle="Histórico recente do usuário">
        <AppRecentActivity items={["Login validado em novo dispositivo há 2 dias", "Preferência de notificação atualizada ontem", "Exportação de relatório executada há 4 horas"]} />
      </AppSectionBlock>
    </AppPageShell>
  );
}
