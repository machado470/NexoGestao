// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppOperationalHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
  unwrapTrpcPayload,
} from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";

type ControlStatus = "Configurado" | "Atenção" | "Incompleto";

type ControlSection = {
  title: string;
  description: string;
  status: ControlStatus;
  action: string;
  path?: string;
};

type SettingsSignal = {
  key: string;
  label: string;
  configured: boolean;
  reason: string;
  path?: string;
  actionLabel: string;
  critical?: boolean;
};

type Member = {
  id?: string;
  email?: string | null;
  role?: string | null;
  active?: boolean | null;
  person?: { name?: string | null } | null;
  name?: string | null;
};

type MembersSource = {
  users: Member[];
  pendingInvites: Member[];
  sourceKind: "users-array" | "members-object" | "unknown";
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

function extractMembersSource(payload: unknown): MembersSource {
  const raw = unwrapTrpcPayload(payload);

  if (Array.isArray(raw)) {
    return {
      users: raw as Member[],
      pendingInvites: [],
      sourceKind: "users-array",
    };
  }

  if (raw && typeof raw === "object") {
    const candidate = raw as Record<string, unknown>;
    const users = normalizeArrayPayload<Member>(candidate.users);
    const pendingInvites = normalizeArrayPayload<Member>(
      candidate.pendingInvites
    );

    if (users.length || pendingInvites.length || "users" in candidate) {
      return { users, pendingInvites, sourceKind: "members-object" };
    }
  }

  return { users: [], pendingInvites: [], sourceKind: "unknown" };
}

function memberName(member: Member) {
  return String(
    member.person?.name ?? member.name ?? member.email ?? "Usuário sem nome"
  );
}

function statusFromConfigured(
  configuredValue: boolean,
  attention?: boolean
): ControlStatus {
  if (configuredValue) return "Configurado";
  return attention ? "Atenção" : "Incompleto";
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
  const memberSource = useMemo(
    () => extractMembersSource(membersQuery.data),
    [membersQuery.data]
  );
  const members = memberSource.users;
  const pendingInvites = memberSource.pendingInvites;
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
  const hasPermissionOwner = members.some(member =>
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
        ? "Fuso horário precisa estar definido para agenda, prazos e relatórios."
        : "Nome da empresa ainda não está completo.",
      actionLabel: "Configurar empresa",
      critical: true,
    },
    {
      key: "permissions",
      label: "Usuários e permissões",
      configured: permissionsConfigured,
      reason: members.length
        ? "Equipe retornou sem papel administrativo claro."
        : "A fonte administrativa não retornou usuários ativos.",
      actionLabel: "Revisar usuários",
    },
    {
      key: "operation",
      label: "Operação",
      configured: hasOperationPattern,
      reason: "Sem padrão operacional visível para agenda, O.S. ou horários.",
      actionLabel: "Abrir operação",
      path: "/service-orders",
    },
    {
      key: "finance",
      label: "Financeiro",
      configured: hasFinancialRule,
      reason: "Sem parâmetro financeiro visível para prazo, moeda ou cobrança.",
      actionLabel: "Configurar financeiro",
      path: "/finances",
    },
    {
      key: "communication",
      label: "Comunicação",
      configured: hasCommunicationTemplate,
      reason:
        "Canal ou template de comunicação não confirmado na leitura atual.",
      actionLabel: "Revisar comunicação",
      path: "/whatsapp",
    },
    {
      key: "governance",
      label: "Governança/Risco",
      configured: hasGovernancePolicy,
      reason: "Sem política administrativa visível para risco e intervenção.",
      actionLabel: "Abrir governança",
      path: "/governance",
    },
    {
      key: "integrations",
      label: "Integrações",
      configured: integrationsConfigured,
      reason:
        "Pagamentos e comunicação ainda não aparecem juntos como prontos.",
      actionLabel: "Ver integrações",
    },
    {
      key: "system",
      label: "Sistema",
      configured: hasTimezone,
      reason: "Fuso horário é a preferência global mínima para prazos.",
      actionLabel: "Revisar sistema",
    },
  ];

  const pendingSignals = signals.filter(signal => !signal.configured);
  const nextAction =
    pendingSignals.find(signal => signal.critical) ?? pendingSignals[0] ?? null;
  const pendingItems = pendingSignals.slice(0, 5);

  const sections: ControlSection[] = [
    {
      title: "Empresa",
      description:
        "Identidade e fuso horário usados por agenda, prazos e relatórios.",
      status: statusFromConfigured(hasCompany && hasTimezone, hasCompany),
      action: hasCompany && hasTimezone ? "Revisar" : "Configurar",
    },
    {
      title: "Usuários",
      description: "Acesso, papéis administrativos e convites pendentes.",
      status: statusFromConfigured(permissionsConfigured, members.length > 0),
      action: "Revisar aqui",
    },
    {
      title: "Operação",
      description: "Padrões que influenciam O.S., agenda e execução diária.",
      status: statusFromConfigured(hasOperationPattern),
      action: "Abrir O.S.",
      path: "/service-orders",
    },
    {
      title: "Financeiro",
      description:
        "Regras de cobrança, prazo, moeda e recorrência operacional.",
      status: statusFromConfigured(hasFinancialRule, stripeReady),
      action: "Abrir financeiro",
      path: "/finances",
    },
    {
      title: "Comunicação",
      description:
        "Canal e templates que apoiam avisos sem criar automação nova.",
      status: statusFromConfigured(hasCommunicationTemplate, whatsappReady),
      action: "Abrir comunicação",
      path: "/whatsapp",
    },
    {
      title: "Governança/Risco",
      description:
        "Critérios administrativos para atenção, risco e intervenção.",
      status: statusFromConfigured(hasGovernancePolicy),
      action: "Abrir governança",
      path: "/governance",
    },
    {
      title: "Integrações",
      description:
        "Prontidão de pagamentos e comunicação conectados ao sistema.",
      status: statusFromConfigured(
        integrationsConfigured,
        stripeReady || whatsappReady
      ),
      action: "Atualizar leitura",
    },
    {
      title: "Sistema",
      description: "Preferências globais que mantêm comportamento previsível.",
      status: statusFromConfigured(hasTimezone),
      action: "Revisar",
    },
  ];

  const sourceMessage = membersQuery.isError
    ? "Não foi possível carregar membros nesta fonte. Revise usuários e permissões em Configurações; Pessoas é a visão operacional da equipe."
    : memberSource.sourceKind === "unknown" && !membersQuery.isLoading
      ? "Fonte administrativa sem lista compatível. Revise usuários e permissões em Configurações; Pessoas é a visão operacional da equipe."
      : members.length === 0
        ? "Nenhum membro ativo retornado pela fonte administrativa; Pessoas pode usar outra fonte operacional."
        : `${members.length} membro(s) retornado(s) pela fonte administrativa.`;

  return (
    <PageWrapper
      title="Configurações"
      subtitle="Controle de empresa, operação, permissões e integrações."
    >
      <AppPageShell>
        <AppOperationalHeader
          title="Configurações"
          description="Centro de Controle do Nexo: veja o que está configurado, o que precisa de atenção e onde ajustar o comportamento do sistema."
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
              <AppStatusBadge label={`${pendingSignals.length} pendência(s)`} />
            </>
          }
        />

        <div id="settings-control-center">
          <AppSectionBlock
            title="Centro de controle"
            subtitle="Áreas que controlam o comportamento do sistema, com estado e ação direta."
            compact
          >
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {sections.map(section => (
                <article
                  key={section.title}
                  className="flex min-h-[148px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4"
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
                  <Button
                    className="mt-auto self-start"
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <AppSectionBlock
            title="Próxima ação administrativa"
            subtitle="Ação compacta; não substitui Dashboard nem Governança."
            compact
          >
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {nextAction?.actionLabel ??
                    "Configurações essenciais revisadas"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {nextAction?.reason ??
                    "Nenhuma pendência administrativa foi detectada na leitura atual."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  nextAction?.path
                    ? navigate(nextAction.path)
                    : document
                        .getElementById("settings-company-form")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                {nextAction?.actionLabel ?? "Revisar empresa"}
              </Button>
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Pendências de configuração"
            subtitle="Lista curta, sem múltiplos estados vazios."
            compact
          >
            {pendingItems.length ? (
              <ul className="space-y-2">
                {pendingItems.map(item => (
                  <li
                    key={item.key}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                          {item.reason}
                        </p>
                      </div>
                      <AppStatusBadge
                        label={item.critical ? "Crítico" : "Atenção"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                Sem alterações recentes registradas e sem pendências
                administrativas na leitura atual.
              </p>
            )}
          </AppSectionBlock>
        </div>

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

        <AppSectionBlock
          title="Usuários e permissões"
          subtitle={sourceMessage}
          compact
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
                members.slice(0, 8).map((member, index) => (
                  <tr
                    key={String(member?.id ?? member?.email ?? index)}
                    className="border-b border-[var(--border-subtle)]/60"
                  >
                    <td className="px-3 py-3 text-[var(--text-primary)]">
                      {memberName(member)}
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
                      Define acesso, execução ou aprovação administrativa.
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-[var(--text-muted)]"
                  >
                    {sourceMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </AppDataTable>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{pendingInvites.length} convite(s) pendente(s).</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/people")}
            >
              Gerenciar na página Pessoas
            </Button>
          </div>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
