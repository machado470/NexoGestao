import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { AppFiltersBar, AppKpiRow, AppNextActionCard, AppPageLoadingState, AppSectionBlock, AppStatusBadge, Input } from "@/components/internal-page-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.nexo.settings.get.useQuery(undefined, { retry: false });
  const membersQuery = trpc.nexo.invites.members.useQuery(undefined, { retry: false });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, { retry: false });

  const settings = useMemo(() => normalizeObjectPayload<any>(settingsQuery.data) ?? {}, [settingsQuery.data]);
  const members = useMemo(() => normalizeArrayPayload<any>(membersQuery.data), [membersQuery.data]);
  const readiness = useMemo(() => normalizeObjectPayload<any>(readinessQuery.data) ?? {}, [readinessQuery.data]);

  const [organizationName, setOrganizationName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setOrganizationName(String(settings.organizationName ?? settings.name ?? ""));
    setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
  }, [settings.organizationName, settings.name, settings.timezone]);

  const updateMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Configurações salvas com sucesso.");
      await settingsQuery.refetch();
      await utils.nexo.settings.get.invalidate();
    },
    onError: (error) => toast.error(error.message || "Falha ao salvar configurações."),
  });

  if (settingsQuery.isLoading) {
    return (
      <PageWrapper title="Configurações" subtitle="Administração da organização, usuários, integrações e preferências.">
        <AppSectionBlock title="Carregando" subtitle="Sincronizando organização.">
          <AppPageLoadingState description="Carregando configurações..." />
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Configurações" subtitle="Administração da organização, usuários, integrações e preferências.">
      <OperationalTopCard
        contextLabel="Direção administrativa"
        title="Parâmetros organizacionais"
        description="Padronize timezone, estado da organização e integrações em uma única superfície."
        primaryAction={(
          <Button isLoading={updateMutation.isPending} onClick={() => updateMutation.mutate({ organizationName, timezone })}>
            Salvar alterações
          </Button>
        )}
      />
      <AppKpiRow
        items={[
          { title: "Organização", value: String(organizationName || "Não definida"), hint: "identidade da operação" },
          { title: "Membros", value: String(members.length), hint: "time com acesso ativo" },
          {
            title: "Integrações prontas",
            value: `${[readiness?.stripe?.configured, readiness?.twilio?.configured].filter(Boolean).length}/2`,
            hint: "Stripe e WhatsApp/Twilio",
          },
          { title: "Timezone", value: String(timezone), hint: "fuso usado em agenda e cobranças" },
        ]}
      />

      <AppSectionBlock title="Resumo administrativo" subtitle="Pendências e próximos passos sem linguagem técnica">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Cobrança automática: <strong>{readiness?.stripe?.configured ? "ativa" : "pendente"}</strong></div>
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Canal WhatsApp: <strong>{readiness?.twilio?.configured ? "ativo" : "pendente"}</strong></div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Próxima ação: <strong>{readiness?.stripe?.configured && readiness?.twilio?.configured ? "revisar usuários e permissões" : "concluir integrações pendentes"}</strong></div>
        </div>
      </AppSectionBlock>

      <AppSectionBlock title="Próxima ação administrativa" subtitle="Evite gargalo operacional por configuração incompleta">
        <AppNextActionCard
          title={readiness?.stripe?.configured ? "Revisar equipe e permissões" : "Concluir integração de cobrança"}
          description={readiness?.stripe?.configured ? "Com Stripe ativo, foque em membros, papéis e notificações." : "Sem Stripe configurado, o upgrade automático fica indisponível no billing."}
          severity={readiness?.stripe?.configured ? "medium" : "high"}
          metadata="configurações"
          action={{
            label: readiness?.stripe?.configured ? "Revisar membros" : "Ver integrações",
            onClick: () => window.scrollTo({ top: 820, behavior: "smooth" }),
          }}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Administração do sistema" subtitle="Estrutura em seções claras">
        <Tabs defaultValue="organizacao">
          <TabsList>
            <TabsTrigger value="organizacao">Organização</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          </TabsList>

          <TabsContent value="organizacao" className="space-y-3 pt-3">
            <AppFiltersBar>
              <Input className="max-w-sm" placeholder="Ex.: Nexo Serviços" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
              <Input className="max-w-xs" placeholder="Ex.: America/Sao_Paulo" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
              <Button variant="outline" onClick={() => {
                setOrganizationName(String(settings.organizationName ?? settings.name ?? ""));
                setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
              }}>
                Reverter
              </Button>
            </AppFiltersBar>
            <p className="text-sm text-[var(--text-secondary)]">Estado atual: <AppStatusBadge label="Concluído" /></p>
          </TabsContent>

          <TabsContent value="usuarios" className="pt-3 text-sm text-[var(--text-secondary)]">
            <div className="space-y-2">
              <p>Total de membros: {members.length}</p>
              <p>Convites e papéis seguem o controle de autenticação da organização.</p>
            </div>
          </TabsContent>

          <TabsContent value="integracoes" className="pt-3 text-sm text-[var(--text-secondary)]">
            <div className="space-y-2">
              <p>Stripe: <AppStatusBadge label={readiness?.stripe?.configured ? "Concluído" : "Pendente"} /></p>
              <p>WhatsApp/Twilio: <AppStatusBadge label={readiness?.twilio?.configured ? "Concluído" : "Pendente"} /></p>
            </div>
          </TabsContent>

          <TabsContent value="notificacoes" className="pt-3 text-sm text-[var(--text-secondary)]">
            Alertas de risco, atraso e cobrança seguem a política definida em Governança.
          </TabsContent>
        </Tabs>
      </AppSectionBlock>
    </PageWrapper>
  );
}
