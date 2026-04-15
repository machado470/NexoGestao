import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { normalizeObjectPayload } from "@/lib/query-helpers";
import {
  AppFiltersBar,
  AppKpiRow,
  AppNextActionCard,
  AppPageHeader,
  AppPageLoadingState,
  AppPageShell,
  AppRecentActivity,
  AppSectionBlock,
  Input,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProfilePage() {
  const utils = trpc.useUtils();
  const meQuery = trpc.nexo.me.useQuery(undefined, { retry: false });
  const settingsQuery = trpc.nexo.settings.get.useQuery(undefined, { retry: false });
  const updateSettings = trpc.nexo.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Preferências salvas com sucesso.");
      await settingsQuery.refetch();
      await utils.nexo.settings.get.invalidate();
    },
    onError: (error) => toast.error(error.message || "Falha ao salvar preferências."),
  });

  const me = useMemo(() => normalizeObjectPayload<any>(meQuery.data) ?? {}, [meQuery.data]);
  const settings = useMemo(() => normalizeObjectPayload<any>(settingsQuery.data) ?? {}, [settingsQuery.data]);
  const [timezone, setTimezone] = useState<string>("America/Sao_Paulo");

  useEffect(() => {
    setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
  }, [settings.timezone]);

  if (meQuery.isLoading || settingsQuery.isLoading) {
    return (
      <AppPageShell>
        <AppPageHeader title="Perfil" description="Dados pessoais, segurança e preferências individuais." />
        <AppSectionBlock title="Carregando" subtitle="Buscando dados de perfil.">
          <AppPageLoadingState description="Sincronizando dados do usuário..." />
        </AppSectionBlock>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <AppPageHeader title="Perfil" description="Sua identidade no sistema, segurança de acesso e ajustes pessoais." />
      <AppKpiRow
        items={[
          { title: "Perfil", value: String(me.name ?? me.fullName ?? "Usuário"), hint: "identidade da sessão atual" },
          { title: "E-mail", value: String(me.emailVerifiedAt ? "Verificado" : "Pendente"), hint: "segurança de acesso" },
          { title: "Função", value: String(me.role ?? "Usuário"), hint: "permissão operacional" },
          { title: "Timezone", value: String(timezone || "America/Sao_Paulo"), hint: "preferência aplicada no produto" },
        ]}
      />
      <div className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Dados pessoais" subtitle="Identidade da sessão autenticada">
          <AppFiltersBar>
            <Input value={String(me.name ?? me.fullName ?? "")} readOnly className="max-w-sm" />
            <Input value={String(me.email ?? "")} readOnly className="max-w-sm" />
            <Input value={String(me.role ?? "USER")} readOnly className="max-w-xs" />
          </AppFiltersBar>
        </AppSectionBlock>
        <AppSectionBlock title="Segurança" subtitle="Estado atual de proteção da conta">
          <AppFiltersBar>
            <Input value={String(me.emailVerifiedAt ? "E-mail verificado" : "E-mail pendente")} readOnly className="max-w-sm" />
            <Input value={String(me.lastLoginAt ? new Date(String(me.lastLoginAt)).toLocaleString("pt-BR") : "Sem registro")} readOnly className="max-w-sm" />
            <Button variant="outline" disabled>
              Alteração de senha em liberação
            </Button>
          </AppFiltersBar>
        </AppSectionBlock>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <AppNextActionCard
          title="Próxima ação recomendada"
          description={me.emailVerifiedAt ? "Revise preferências para manter alertas e horários corretos." : "Valide seu e-mail para reduzir risco de perda de acesso."}
          severity={me.emailVerifiedAt ? "low" : "high"}
          metadata="perfil"
          action={{
            label: me.emailVerifiedAt ? "Revisar preferências" : "Validar conta",
            onClick: () => window.scrollTo({ top: 720, behavior: "smooth" }),
          }}
        />
        <AppSectionBlock title="Preferências" subtitle="Ajustes pessoais sincronizados com organização" className="xl:col-span-2">
        <AppFiltersBar>
          <Input placeholder="Ex.: America/Sao_Paulo" className="max-w-sm" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          <Button
            onClick={() => updateSettings.mutate({ timezone })}
            isLoading={updateSettings.isPending}
          >
            Salvar alterações do perfil
          </Button>
        </AppFiltersBar>
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Atividade e contexto" subtitle="Histórico recente do usuário">
        <AppRecentActivity items={[
          me.lastLoginAt ? `Último login em ${new Date(String(me.lastLoginAt)).toLocaleString("pt-BR")}` : "Sem registro recente de login",
          me.emailVerifiedAt ? "E-mail validado com sucesso" : "Validação de e-mail pendente",
          settings.timezone ? `Timezone atual: ${String(settings.timezone)}` : "Timezone padrão da organização",
        ]} />
      </AppSectionBlock>
    </AppPageShell>
  );
}
