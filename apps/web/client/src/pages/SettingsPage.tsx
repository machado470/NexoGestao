import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import { AppToolbar } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const settingsQuery = trpc.nexo.settings.get.useQuery(undefined, { retry: false });
  const membersQuery = trpc.nexo.invites.members.useQuery(undefined, { retry: false });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const settings = useMemo(() => normalizeObjectPayload<any>(settingsQuery.data) ?? {}, [settingsQuery.data]);
  const members = useMemo(() => normalizeArrayPayload<any>(membersQuery.data), [membersQuery.data]);
  const readiness = useMemo(() => normalizeObjectPayload<any>(readinessQuery.data) ?? {}, [readinessQuery.data]);

  const [organizationName, setOrganizationName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setOrganizationName(String(settings.organizationName ?? settings.name ?? ""));
    setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
  }, [settings]);

  const updateMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Configurações atualizadas.");
      await Promise.all([settingsQuery.refetch(), utils.nexo.settings.get.invalidate()]);
    },
    onError: error => toast.error(error.message || "Falha ao salvar."),
  });

  const isLoading = settingsQuery.isLoading || membersQuery.isLoading || readinessQuery.isLoading;
  const hasError = settingsQuery.isError || membersQuery.isError || readinessQuery.isError;

  const refetchAll = () => {
    void Promise.all([settingsQuery.refetch(), membersQuery.refetch(), readinessQuery.refetch()]);
  };

  const sections = [
    { title: "Empresa", impact: "Define identidade e contexto base da operação.", action: "Atualizar dados institucionais e timezone.", route: "/settings?section=empresa" },
    { title: "Usuários e permissões", impact: "Controla quem pode agir e aprovar ações críticas.", action: "Criar usuários, ajustar funções e ativar/desativar acesso.", route: "/people" },
    { title: "Operação", impact: "Molda fluxo de serviço, duração e padrão de execução.", action: "Configurar tipos de serviço e regras operacionais.", route: "/service-orders" },
    { title: "Financeiro", impact: "Define comportamento de cobrança e vencimento.", action: "Ajustar prazo padrão, juros e meios de pagamento.", route: "/finances" },
    { title: "WhatsApp / comunicação", impact: "Orquestra mensagens de confirmação, lembrete e cobrança.", action: "Configurar templates e cadência de follow-up.", route: "/whatsapp" },
    { title: "Automações", impact: "Reduz tarefas manuais e amplia previsibilidade.", action: "Estrutura de gatilho, condição e ação pronta para crescer.", route: "/governance?view=acoes" },
    { title: "Governança / risco", impact: "Protege a empresa contra desvio de padrão e falhas críticas.", action: "Definir níveis de risco, alertas e ação automática.", route: "/governance" },
    { title: "Integrações", impact: "Conecta comunicação e cobrança à operação real.", action: "Verificar estado de WhatsApp e pagamentos.", route: "/settings?section=integracoes" },
    { title: "Sistema", impact: "Define idioma, timezone e comportamento global.", action: "Padronizar preferências para todo o time.", route: "/settings?section=sistema" },
  ];

  return (
    <PageWrapper title="Configurações" subtitle="Centro de controle de como o sistema se comporta para a sua empresa.">
      <AppPageShell>
      <AppPageHeader title="Configurações" description="Centro de controle de como o sistema se comporta para a sua empresa." />
      <OperationalTopCard
        contextLabel="Direção de configuração"
        title="Comportamento operacional da empresa"
        description="Cada bloco abaixo define consequência real na execução, cobrança e governança."
        chips={
          <>
            <AppStatusBadge label={`${members.length} usuários`} />
            <AppStatusBadge label={readiness?.stripe?.configured ? "Pagamentos conectados" : "Pagamentos pendentes"} />
          </>
        }
        primaryAction={<Button onClick={() => updateMutation.mutate({ organizationName, timezone })} isLoading={updateMutation.isPending}>Salvar configuração-base</Button>}
      />

      <AppToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <AppStatusBadge label={`${members.length} usuários`} />
          <AppStatusBadge label={readiness?.stripe?.configured ? "Pagamentos conectados" : "Pagamentos pendentes"} />
          <AppStatusBadge label={readiness?.twilio?.configured ? "Comunicação conectada" : "Comunicação pendente"} />
        </div>
        <Button onClick={() => updateMutation.mutate({ organizationName, timezone })} isLoading={updateMutation.isPending}>Salvar configuração-base</Button>
      </AppToolbar>

      {isLoading ? <AppPageLoadingState description="Carregando blocos de configuração da organização..." /> : null}
      {hasError ? <AppPageErrorState description="Não foi possível carregar as configurações da empresa." onAction={refetchAll} /> : null}

      {!isLoading && !hasError ? (
        <>
          {!organizationName ? (
            <AppPageEmptyState title="Empresa sem configuração inicial" description="Defina o nome da organização para habilitar um contexto administrativo completo." />
          ) : null}

          <AppSectionBlock title="1) Empresa" subtitle="Base institucional que define o comportamento global da conta.">
            <div className="grid gap-2 md:grid-cols-3">
              <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="Nome da empresa" />
              <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={String(settings.cnpj ?? "")} readOnly placeholder="CNPJ" />
              <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={String(settings.phone ?? "")} readOnly placeholder="Telefone" />
              <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm md:col-span-2" value={String(settings.address ?? "")} readOnly placeholder="Endereço" />
              <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="Timezone" />
            </div>
          </AppSectionBlock>

          <AppSectionBlock title="2) Blocos por impacto operacional" subtitle="Sem checklist técnico: cada bloco mostra o que muda de verdade no sistema.">
            <div className="grid gap-3 xl:grid-cols-2">
              {sections.map(section => (
                <div key={section.title} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{section.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{section.impact}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Impacto direto: {section.action}</p>
                  <div className="mt-2"><Button size="sm" variant="outline" onClick={() => navigate(section.route)}>Abrir bloco</Button></div>
                </div>
              ))}
            </div>
          </AppSectionBlock>

          <div className="grid gap-4 xl:grid-cols-2">
            <AppSectionBlock title="3) Usuários e permissões" subtitle="Quem pode agir, aprovar e operar no dia a dia.">
              {members.length === 0 ? (
                <AppPageEmptyState title="Sem usuários ativos" description="Adicione usuários para iniciar distribuição real de responsabilidades." />
              ) : (
                <div className="space-y-2">
                  {members.slice(0, 8).map((member, index) => (
                    <div key={`${String(member?.id ?? "member")}-${index}`} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{String(member?.name ?? member?.email ?? "Usuário")}</p>
                        <p className="text-xs text-[var(--text-muted)]">{String(member?.role ?? "Sem função")}</p>
                      </div>
                      <AppStatusBadge label={member?.active === false ? "Inativo" : "Ativo"} />
                    </div>
                  ))}
                </div>
              )}
            </AppSectionBlock>

            <AppSectionBlock title="4) Integrações e automações" subtitle="Preparação para automações mais fortes sem alterar backend agora.">
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>WhatsApp: <strong className="text-[var(--text-primary)]">{readiness?.twilio?.configured ? "Conectado" : "Pendente"}</strong></p>
                <p>Pagamentos: <strong className="text-[var(--text-primary)]">{readiness?.stripe?.configured ? "Conectado" : "Pendente"}</strong></p>
                <p>Exemplo de automação preparada: cobrança vencida {'>'} 3 dias → enviar mensagem automática.</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate("/governance")}>Abrir governança</Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/whatsapp")}>Abrir comunicação</Button>
              </div>
            </AppSectionBlock>
          </div>
        </>
      ) : null}
      </AppPageShell>
    </PageWrapper>
  );
}
