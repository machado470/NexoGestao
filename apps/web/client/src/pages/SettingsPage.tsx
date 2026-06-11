// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  type OperationalFlowStageState,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalStateLevel,
} from "@/components/app/OperationalCommandLayer";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppKpiRow,
  AppOperationalHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";

type Section = {
  title: string;
  description: string;
  impact: string;
  status: string;
  action: string;
  path?: string;
};

type SettingsSignal = {
  key: string;
  label: string;
  configured: boolean;
  reason: string;
  impact: string;
  path?: string;
  actionLabel: string;
  critical?: boolean;
};

function configured(readiness: Record<string, any>, key: string) {
  return (
    readiness?.[key]?.configured === true ||
    readiness?.integrations?.[key] === "configured" ||
    readiness?.integrations?.[key]?.configured === true
  );
}

function hasAnySettingValue(source: Record<string, any>, keys: string[]) {
  return keys.some(key => {
    const value = source?.[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object")
      return Object.keys(value).length > 0;
    return value != null;
  });
}

function flowState(
  configured: boolean,
  active: boolean,
  critical?: boolean
): OperationalFlowStageState {
  if (configured) return "done";
  if (critical) return "blocked";
  if (active) return "active";
  return "warning";
}

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const settingsQuery = trpc.nexo.settings.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const membersQuery = trpc.nexo.invites.members.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const utils = trpc.useUtils();

  const settings = useMemo(
    () => normalizeObjectPayload<any>(settingsQuery.data) ?? {},
    [settingsQuery.data]
  );
  const members = useMemo(
    () => normalizeArrayPayload<any>(membersQuery.data),
    [membersQuery.data]
  );
  const readiness = useMemo(
    () => normalizeObjectPayload<any>(readinessQuery.data) ?? {},
    [readinessQuery.data]
  );
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setName(String(settings.name ?? ""));
    setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
  }, [settings.name, settings.timezone]);

  const updateMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Configurações da empresa salvas.");
      await Promise.all([
        settingsQuery.refetch(),
        utils.nexo.settings.get.invalidate(),
      ]);
    },
    onError: error =>
      toast.error(error.message || "Não foi possível salvar as configurações."),
  });

  const hasCompany = name.trim().length > 0;
  const hasTimezone = timezone.trim().length > 0;
  const stripeReady = configured(readiness, "stripe");
  const whatsappReady =
    configured(readiness, "twilio") || configured(readiness, "whatsapp");
  const hasFinancialRule = hasAnySettingValue(settings, [
    "currency",
    "defaultPaymentTermDays",
    "paymentDueDays",
    "billingDueDays",
    "invoiceDueDays",
    "defaultDueDays",
    "lateFee",
    "interestRate",
    "financialRules",
  ]);
  const hasOperationPattern = hasAnySettingValue(settings, [
    "operation",
    "operational",
    "serviceOrderDefaults",
    "appointmentDefaults",
    "businessHours",
    "defaultServiceOrderStatus",
    "workflows",
  ]);
  const hasCommunicationTemplate =
    whatsappReady ||
    hasAnySettingValue(settings, [
      "communication",
      "messageTemplates",
      "templates",
      "notificationTemplates",
    ]);
  const hasGovernancePolicy = hasAnySettingValue(settings, [
    "governance",
    "risk",
    "riskPolicy",
    "governancePolicy",
    "riskRules",
    "policies",
  ]);
  const hasPermissionOwner = members.some((member: any) =>
    ["ADMIN", "OWNER", "MANAGER"].includes(
      String(member?.role ?? "").toUpperCase()
    )
  );
  const permissionsConfigured = members.length > 0 && hasPermissionOwner;
  const integrationsConfigured = stripeReady && whatsappReady;
  const unsaved =
    name !== String(settings.name ?? "") ||
    timezone !== String(settings.timezone ?? "America/Sao_Paulo");

  const signals: SettingsSignal[] = [
    {
      key: "company",
      label: "Empresa",
      configured: hasCompany && hasTimezone,
      reason: hasCompany
        ? "Fuso horário precisa permanecer visível para agenda, prazos e relatórios."
        : "Nome da empresa ainda não está completo.",
      impact:
        "Agenda, O.S., relatórios e comunicações perdem referência comum quando a empresa base fica incompleta.",
      actionLabel: "Completar configuração crítica",
      critical: true,
    },
    {
      key: "finance",
      label: "Financeiro",
      configured: hasFinancialRule,
      reason:
        "Nenhum parâmetro financeiro visível foi retornado para prazo, moeda ou regra de cobrança padrão.",
      impact:
        "Cobrança, inadimplência e previsibilidade de caixa podem ser interpretadas de formas diferentes pela operação.",
      actionLabel: "Configurar regras financeiras",
      path: "/finances",
    },
    {
      key: "operation",
      label: "Operação",
      configured: hasOperationPattern,
      reason:
        "A leitura atual não retornou padrão operacional explícito para agenda, O.S. ou horário de atendimento.",
      impact:
        "A fila diária pode depender de decisão manual sem padrão comum de execução.",
      actionLabel: "Configurar fluxo operacional",
      path: "/service-orders",
    },
    {
      key: "communication",
      label: "Comunicação",
      configured: hasCommunicationTemplate,
      reason:
        "Nenhum canal/template de comunicação configurado foi confirmado pela leitura atual.",
      impact:
        "Confirmações, cobranças e avisos podem exigir ação manual e gerar retrabalho.",
      actionLabel: "Configurar comunicação",
      path: "/whatsapp",
    },
    {
      key: "governance",
      label: "Governança/Risco",
      configured: hasGovernancePolicy,
      reason:
        "Nenhuma política ou regra de risco visível foi retornada junto das configurações.",
      impact:
        "Sinais de risco podem ficar sem critério administrativo explícito para intervenção.",
      actionLabel: "Revisar governança",
      path: "/governance",
    },
    {
      key: "permissions",
      label: "Usuários e permissões",
      configured: permissionsConfigured,
      reason: members.length
        ? "Equipe retornou sem papel administrativo claro na leitura de permissões."
        : "Nenhum usuário foi retornado pela fonte de permissões.",
      impact:
        "Execução, aprovação e rastreabilidade ficam frágeis quando responsabilidades não estão claras.",
      actionLabel: "Revisar usuários e permissões",
      path: "/people",
    },
    {
      key: "integrations",
      label: "Integrações",
      configured: integrationsConfigured,
      reason:
        "Pagamentos e comunicação ainda não aparecem simultaneamente como integrações prontas.",
      impact:
        "O ciclo O.S. → cobrança → aviso ao cliente pode exigir operação manual ou conferência extra.",
      actionLabel: "Ver integrações",
    },
  ];

  const firstCriticalSignal = signals.find(
    signal => signal.critical && !signal.configured
  );
  const firstPendingSignal =
    firstCriticalSignal ?? signals.find(signal => !signal.configured);
  const pendingCount = signals.filter(signal => !signal.configured).length;
  const operationalState: OperationalStateLevel = firstCriticalSignal
    ? "RESTRICTED"
    : pendingCount > 0
      ? "WARNING"
      : "NORMAL";
  const stateReason = firstPendingSignal
    ? `${firstPendingSignal.label}: ${firstPendingSignal.reason}`
    : "Configurações essenciais completas na leitura atual.";
  const stateImpact = firstPendingSignal
    ? firstPendingSignal.impact
    : "Empresa, operação, financeiro, comunicação, governança, permissões e integrações têm sinais suficientes para operar com previsibilidade.";
  const riskSignal = firstPendingSignal ?? signals[signals.length - 1];
  const nextAction = firstPendingSignal ?? {
    key: "healthy",
    label: "Configurações",
    configured: true,
    reason: "Nenhuma pendência crítica foi detectada na leitura atual.",
    impact: "A administração pode revisar parâmetros sem bloquear a operação.",
    actionLabel: "Revisar configurações da operação",
  };

  const sections: Section[] = [
    {
      title: "Empresa",
      description: "Nome, fuso horário e identidade operacional.",
      impact:
        "Agenda, prazos, comunicações e relatórios passam a usar a mesma referência.",
      status: hasCompany && hasTimezone ? "Configurado" : "Pendente",
      action: "Salvar dados da empresa",
    },
    {
      title: "Usuários e permissões",
      description: "Pessoas que podem executar, aprovar e administrar rotinas.",
      impact:
        "Define responsabilidade, segurança e rastreabilidade por pessoa.",
      status: members.length ? `${members.length} usuário(s)` : "Sem equipe",
      action: "Gerenciar equipe",
      path: "/people",
    },
    {
      title: "Operação",
      description: "Regras de execução para O.S., agenda e pendências.",
      impact: "Muda como a fila diária é priorizada e acompanhada.",
      status: hasOperationPattern ? "Padrão visível" : "Padrão pendente",
      action: "Abrir operação",
      path: "/service-orders",
    },
    {
      title: "Financeiro",
      description: "Parâmetros de cobrança, recorrência e recebimento.",
      impact: "Afeta previsibilidade de caixa e bloqueios por inadimplência.",
      status: hasFinancialRule
        ? "Regra visível"
        : stripeReady
          ? "Pagamento sem regra"
          : "Pagamento pendente",
      action: "Abrir financeiro",
      path: "/finances",
    },
    {
      title: "WhatsApp",
      description:
        "Canal de confirmação, cobrança e relacionamento com clientes.",
      impact: "Muda o alcance das notificações e reduz retrabalho manual.",
      status: whatsappReady ? "Canal conectado" : "Canal pendente",
      action: "Abrir WhatsApp",
      path: "/whatsapp",
    },
    {
      title: "Automações",
      description: "Rotinas automáticas acionadas por evento operacional.",
      impact:
        "Padroniza lembretes, follow-ups e alertas sem depender de ação manual.",
      status: hasGovernancePolicy ? "Governado" : "Regra pendente",
      action: "Revisar governança",
      path: "/governance",
    },
    {
      title: "Governança",
      description: "Critérios que indicam risco, restrição e recomendação.",
      impact:
        "Muda quando o sistema recomenda intervenção antes do problema escalar.",
      status: hasGovernancePolicy ? "Política visível" : "Política pendente",
      action: "Abrir governança",
      path: "/governance",
    },
    {
      title: "Integrações",
      description: "Conexões externas essenciais para operação e cobrança.",
      impact: "Evita ruptura de comunicação, pagamento e auditoria.",
      status: integrationsConfigured ? "Integrações ativas" : "Ação necessária",
      action: "Ver integrações",
    },
    {
      title: "Sistema",
      description: "Preferências globais de estabilidade, ambiente e suporte.",
      impact: "Mantém comportamento previsível para o piloto e para o time.",
      status: hasTimezone ? timezone : "Fuso pendente",
      action: "Atualizar leitura",
    },
  ];

  const flowStages: Array<{
    id: string;
    label: string;
    summary: string;
    state: OperationalFlowStageState;
    countOrValue?: string;
    hrefLabel?: string;
    onClick?: () => void;
  }> = [
    {
      id: "company",
      label: "Empresa",
      summary:
        hasCompany && hasTimezone
          ? "Identidade e fuso horário prontos para orientar agenda e relatórios."
          : "Complete nome e fuso para estabilizar a referência operacional.",
      state: flowState(hasCompany && hasTimezone, true, true),
      countOrValue: hasCompany ? "OK" : "Pendente",
    },
    {
      id: "operation",
      label: "Operação",
      summary: hasOperationPattern
        ? "Padrão operacional retornado nas configurações."
        : "Sem padrão operacional visível para O.S. e agenda.",
      state: flowState(hasOperationPattern, hasCompany && hasTimezone),
      onClick: () => navigate("/service-orders"),
      hrefLabel: "Abrir O.S.",
    },
    {
      id: "finance",
      label: "Financeiro",
      summary: hasFinancialRule
        ? "Regra financeira visível para a operação."
        : "Defina moeda, prazo ou regra padrão de cobrança.",
      state: flowState(hasFinancialRule, hasOperationPattern),
      onClick: () => navigate("/finances"),
      hrefLabel: "Abrir financeiro",
    },
    {
      id: "communication",
      label: "Comunicação",
      summary: hasCommunicationTemplate
        ? "Canal/template confirmado pela leitura atual."
        : "Canal ou template não confirmado; WhatsApp segue congelado.",
      state: flowState(hasCommunicationTemplate, hasFinancialRule),
      onClick: () => navigate("/whatsapp"),
      hrefLabel: "Abrir canal",
    },
    {
      id: "governance",
      label: "Governança/Risco",
      summary: hasGovernancePolicy
        ? "Política de risco visível para intervenção administrativa."
        : "Sem política visível para classificar risco operacional.",
      state: flowState(
        hasGovernancePolicy,
        hasOperationPattern || hasFinancialRule
      ),
      onClick: () => navigate("/governance"),
      hrefLabel: "Abrir governança",
    },
    {
      id: "integrations",
      label: "Integrações",
      summary: integrationsConfigured
        ? "Pagamentos e comunicação conectados."
        : "Integrações essenciais ainda exigem conferência.",
      state: flowState(integrationsConfigured, stripeReady || whatsappReady),
      countOrValue: `${Number(stripeReady) + Number(whatsappReady)}/2`,
    },
    {
      id: "system",
      label: "Sistema",
      summary: hasTimezone
        ? `Fuso ${timezone} aplicado como preferência global.`
        : "Sistema sem fuso horário persistente para prazos.",
      state: hasTimezone ? "done" : "warning",
    },
  ];

  const timelineEvents = settings?.updatedAt
    ? [
        {
          id: "settings-updated",
          type: "Configuração",
          occurredAt: new Date(settings.updatedAt).toLocaleString("pt-BR"),
          entity: "Configurações da organização",
          summary:
            "Última alteração real retornada pelo payload de configurações.",
          actor: String(
            settings?.updatedBy?.name ?? settings?.updatedByName ?? "Sistema"
          ),
        },
      ]
    : [];

  return (
    <PageWrapper
      title="Configurações"
      subtitle="Centro de controle operacional com impacto explicado em linguagem de negócio."
    >
      <AppPageShell>
        <AppOperationalHeader
          title="Configurações operacionais"
          description="Cada bloco mostra o que muda na operação antes de pedir uma ação. Evita painel técnico e decisões sem contexto."
          primaryAction={
            <Button
              disabled={!unsaved || updateMutation.isPending}
              onClick={() => updateMutation.mutate({ name, timezone })}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar empresa"}
            </Button>
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() =>
                void Promise.all([
                  settingsQuery.refetch(),
                  membersQuery.refetch(),
                  readinessQuery.refetch(),
                ])
              }
            >
              Atualizar leitura
            </Button>
          }
          contextChips={
            <>
              <AppStatusBadge
                label={unsaved ? "Alterações não salvas" : "Sem alterações"}
              />
              <AppStatusBadge label={`${pendingCount} pendência(s)`} />
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-3">
          <OperationalStateCard
            title="Estado das configurações"
            level={operationalState}
            reason={stateReason}
            impact={stateImpact}
            detailsLabel="Ver blocos de configuração"
            onDetails={() =>
              document
                .getElementById("settings-control-center")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
          <OperationalRiskCard
            title={
              riskSignal?.configured
                ? "Configuração sem risco crítico"
                : `Risco em ${riskSignal?.label ?? "configuração"}`
            }
            reason={
              riskSignal?.configured
                ? "A leitura atual não encontrou configuração crítica ausente."
                : (riskSignal?.reason ??
                  "Há configuração pendente na leitura atual.")
            }
            impact={
              riskSignal?.configured
                ? "A operação pode seguir com revisão administrativa periódica."
                : (riskSignal?.impact ??
                  "A operação pode exigir conferência administrativa.")
            }
            ctaLabel={
              riskSignal?.path ? riskSignal.actionLabel : "Atualizar leitura"
            }
            onClick={() =>
              riskSignal?.path
                ? navigate(riskSignal.path)
                : void Promise.all([
                    settingsQuery.refetch(),
                    readinessQuery.refetch(),
                  ])
            }
          />
          <NextBestActionCard
            title={nextAction.actionLabel}
            entity={nextAction.label}
            reason={nextAction.reason}
            impact={nextAction.impact}
            safetyNote="A ação é apenas orientativa: nenhuma configuração, permissão, automação ou comunicação é executada automaticamente."
            primaryActionLabel={nextAction.actionLabel}
            onPrimaryAction={() =>
              nextAction.path
                ? navigate(nextAction.path)
                : document
                    .getElementById("settings-company-form")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            secondaryActionLabel="Atualizar leitura"
            onSecondaryAction={() =>
              void Promise.all([
                settingsQuery.refetch(),
                membersQuery.refetch(),
                readinessQuery.refetch(),
              ])
            }
          />
        </div>

        <OperationalFlowCard
          title="Fluxo de configuração operacional"
          subtitle="Empresa → Operação → Financeiro → Comunicação → Governança/Risco → Integrações → Sistema"
          stages={flowStages}
        />

        <EntityTimelineCard
          title="Últimas alterações de configuração"
          subtitle={
            timelineEvents.length
              ? "Eventos reais retornados pelo payload de configurações."
              : "Fallback seguro: nenhuma timeline real de configuração foi retornada; o Nexo não cria histórico fictício."
          }
          events={timelineEvents}
          fullTimelineLabel="Abrir Timeline"
          onFullTimeline={() => navigate("/timeline")}
        />

        <div id="settings-company-form">
          <AppSectionBlock
            title="Empresa"
            subtitle="Dados base usados por agenda, prazos e relatórios."
            compact
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Empresa
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Nome da empresa"
                />
              </label>
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Fuso horário
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  value={timezone}
                  onChange={event => setTimezone(event.target.value)}
                  placeholder="America/Sao_Paulo"
                />
              </label>
            </div>
          </AppSectionBlock>
        </div>

        <AppKpiRow
          items={[
            {
              title: "Blocos de controle",
              value: String(sections.length),
              hint: "Áreas organizadas por impacto operacional.",
            },
            {
              title: "Equipe",
              value: String(members.length),
              hint: "Usuários e permissões atuais.",
            },
            {
              title: "Integrações",
              value: stripeReady && whatsappReady ? "Ativas" : "Pendentes",
              hint: "Pagamentos e comunicação.",
            },
            {
              title: "Pendências",
              value: String(pendingCount),
              hint: "Itens que podem afetar piloto.",
            },
          ]}
        />

        <div id="settings-control-center">
          <AppSectionBlock
            title="Centro de controle"
            subtitle="Áreas em cards: impacto visível antes da ação."
            compact
          >
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {sections.map(section => (
                <article
                  key={section.title}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {section.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
                        {section.description}
                      </p>
                    </div>
                    <AppStatusBadge label={section.status} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                    {section.impact}
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      section.path
                        ? navigate(section.path)
                        : void Promise.all([
                            settingsQuery.refetch(),
                            readinessQuery.refetch(),
                          ])
                    }
                  >
                    {section.action}
                  </Button>
                </article>
              ))}
            </div>
          </AppSectionBlock>
        </div>

        <AppSectionBlock
          title="Usuários e permissões"
          subtitle="Leitura rápida de quem pode agir no sistema."
        >
          <AppDataTable className="min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Função</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Impacto</th>
              </tr>
            </thead>
            <tbody>
              {members.length ? (
                members.slice(0, 8).map((member: any, index: number) => (
                  <tr
                    key={String(member?.id ?? index)}
                    className="border-b border-[var(--border-subtle)]/60"
                  >
                    <td className="px-3 py-3 text-[var(--text-primary)]">
                      {String(member?.name ?? member?.email ?? "Usuário")}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {String(member?.role ?? "Sem função")}
                    </td>
                    <td className="px-3 py-3">
                      <AppStatusBadge
                        label={member?.active === false ? "Inativo" : "Ativo"}
                      />
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      Define o que essa pessoa pode executar ou aprovar.
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-[var(--text-muted)]"
                  >
                    Nenhum usuário retornado pela fonte de permissões.
                  </td>
                </tr>
              )}
            </tbody>
          </AppDataTable>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
