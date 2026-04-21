import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import {
  AppListBlock,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
  Input,
} from "@/components/internal-page-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { Button } from "@/components/ui/button";

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
      <PageWrapper title="Configurações" subtitle="Administração da organização.">
        <AppSectionBlock title="Carregando" subtitle="Sincronizando organização" compact>
          <AppPageLoadingState description="Carregando configurações..." />
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  const integrationsReady = [readiness?.stripe?.configured, readiness?.twilio?.configured].filter(Boolean).length;
  const settingsBlocks = [
    {
      title: "Empresa",
      impact: "Define identidade e parâmetros base para todos os módulos.",
      action: "Atualizar nome, timezone e dados institucionais.",
    },
    {
      title: "Usuários e permissões",
      impact: "Controla quem pode executar ações críticas.",
      action: "Revisar acessos, papéis e pessoas ativas.",
    },
    {
      title: "Operação",
      impact: "Afeta fila, prioridades e ritmo de execução.",
      action: "Configurar regras de agenda, O.S. e distribuição.",
    },
    {
      title: "Financeiro",
      impact: "Define como entradas e cobranças operam no dia a dia.",
      action: "Ajustar políticas de cobrança, repasse e vencimentos.",
    },
    {
      title: "WhatsApp / comunicação",
      impact: "Mantém o relacionamento com o cliente no timing certo.",
      action: "Habilitar canal e revisar templates de mensagem.",
    },
    {
      title: "Automações",
      impact: "Reduz tarefas manuais e evita perda de follow-up.",
      action: "Ativar gatilhos e ações automáticas por evento.",
    },
    {
      title: "Governança / risco",
      impact: "Protege padrões, compliance e qualidade operacional.",
      action: "Configurar alertas, limites e políticas de bloqueio.",
    },
    {
      title: "Integrações",
      impact: "Conecta cobrança, comunicação e ferramentas externas.",
      action: "Validar chaves e status de disponibilidade.",
    },
    {
      title: "Sistema",
      impact: "Comportamento global da plataforma para sua empresa.",
      action: "Revisar preferências técnicas e estabilidade.",
    },
  ];

  return (
    <PageWrapper title="Configurações" subtitle="Central administrativa previsível e escaneável.">
      <OperationalTopCard
        contextLabel="Direção administrativa"
        title="Centro de controle do sistema"
        description="Defina como o Nexo deve funcionar para sua empresa, com impacto real na operação."
        chips={
          <>
            <AppStatusBadge label={`${members.length} membros`} />
            <AppStatusBadge label={`${integrationsReady}/2 integrações prontas`} />
          </>
        }
        primaryAction={(
          <Button isLoading={updateMutation.isPending} onClick={() => updateMutation.mutate({ organizationName, timezone })}>
            Salvar alterações
          </Button>
        )}
      />

      <AppSectionBlock title="Resumo administrativo" subtitle="Leitura rápida da conta" compact>
        <div className="grid gap-2 md:grid-cols-3 text-sm">
          <p><span className="text-[var(--text-muted)]">Organização:</span> {String(organizationName || "Não definida")}</p>
          <p><span className="text-[var(--text-muted)]">Membros:</span> {members.length}</p>
          <p><span className="text-[var(--text-muted)]">Integrações:</span> {integrationsReady}/2</p>
        </div>
      </AppSectionBlock>

      <AppSectionBlock title="Resumo operacional" subtitle="Saúde de configuração sem ruído" compact>
        <AppListBlock
          compact
          minItems={3}
          items={[
            {
              title: "Cobrança automática",
              subtitle: readiness?.stripe?.configured ? "Stripe configurado." : "Stripe pendente.",
              right: <AppStatusBadge label={readiness?.stripe?.configured ? "Concluído" : "Pendente"} />,
            },
            {
              title: "Canal WhatsApp",
              subtitle: readiness?.twilio?.configured ? "Twilio configurado." : "Twilio pendente.",
              right: <AppStatusBadge label={readiness?.twilio?.configured ? "Concluído" : "Pendente"} />,
            },
            {
              title: "Próxima ação",
              subtitle: integrationsReady === 2 ? "Revisar usuários e permissões." : "Concluir integrações pendentes.",
              action: <Button size="sm" variant="outline">Revisar</Button>,
            },
          ]}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Empresa" subtitle="Dados principais que moldam o comportamento geral">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input placeholder="Ex.: Nexo Serviços" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
          <Input placeholder="Ex.: America/Sao_Paulo" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          <Button variant="outline" onClick={() => {
            setOrganizationName(String(settings.organizationName ?? settings.name ?? ""));
            setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
          }}>
            Reverter
          </Button>
        </div>
      </AppSectionBlock>

      <AppSectionBlock title="Blocos de configuração" subtitle="Organizados por impacto real no sistema">
        <AppListBlock
          compact
          items={settingsBlocks.map((block) => ({
            title: block.title,
            subtitle: `${block.impact} ${block.action}`,
            action: <Button size="sm" variant="outline">Abrir bloco</Button>,
          }))}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Usuários e permissões" subtitle="Equipe com acesso governado" compact>
        <AppListBlock
          compact
          items={members.slice(0, 8).map((member: any, index) => ({
            title: String(member?.name ?? member?.email ?? `Membro ${index + 1}`),
            subtitle: String(member?.role ?? "Sem papel definido"),
            right: <AppStatusBadge label={member?.active === false ? "Inativo" : "Ativo"} />,
            action: <Button size="sm" variant="outline">Gerenciar</Button>,
          }))}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Integrações" subtitle="Conectores que sustentam cobrança e comunicação" compact>
        <AppListBlock
          compact
          items={[
            { title: "Stripe", subtitle: "Cobrança da assinatura em Planos", right: <AppStatusBadge label={readiness?.stripe?.configured ? "Concluído" : "Pendente"} />, action: <Button size="sm" variant="outline">Abrir</Button> },
            { title: "WhatsApp/Twilio", subtitle: "Comunicação com clientes no fluxo operacional", right: <AppStatusBadge label={readiness?.twilio?.configured ? "Concluído" : "Pendente"} />, action: <Button size="sm" variant="outline">Abrir</Button> },
          ]}
        />
      </AppSectionBlock>
    </PageWrapper>
  );
}
