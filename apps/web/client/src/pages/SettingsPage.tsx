import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppPageEmptyState,
  AppPageErrorState,
  AppOperationalHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";

type SettingsSectionKey = "geral" | "equipe" | "financeiro" | "whatsapp" | "agenda" | "notificacoes" | "integracoes";

const SECTION_ORDER: Array<{
  key: SettingsSectionKey;
  title: string;
  description: string;
  route?: string;
}> = [
  { key: "geral", title: "Geral", description: "Identidade da empresa e horário padrão do sistema." },
  { key: "equipe", title: "Equipe", description: "Pessoas com acesso e papéis da operação.", route: "/people" },
  { key: "financeiro", title: "Financeiro", description: "Cobrança e pagamento para manter fluxo de caixa.", route: "/finances" },
  { key: "whatsapp", title: "WhatsApp", description: "Canal de confirmação, lembrete e retorno com clientes.", route: "/whatsapp" },
  { key: "agenda", title: "Agenda", description: "Organização da rotina e compromissos da equipe.", route: "/calendar" },
  { key: "notificacoes", title: "Notificações", description: "Alertas para time e gestor agirem no tempo certo." },
  { key: "integracoes", title: "Integrações", description: "Conexões externas que sustentam a operação." },
];

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
  const [notifyAppointments, setNotifyAppointments] = useOperationalMemoryState<boolean>("nexo.settings.notify-appointments.v1", true);
  const [notifyFinance, setNotifyFinance] = useOperationalMemoryState<boolean>("nexo.settings.notify-finance.v1", true);
  const [focusedSection, setFocusedSection] = useOperationalMemoryState<SettingsSectionKey>("nexo.settings.focused-section.v3", "geral");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setOrganizationName(String(settings.organizationName ?? settings.name ?? ""));
    setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
  }, [settings]);

  const updateMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async () => {
      setLastSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      toast.success("Ajustes salvos com sucesso.");
      await Promise.all([settingsQuery.refetch(), utils.nexo.settings.get.invalidate()]);
    },
    onError: error => toast.error(error.message || "Não foi possível salvar agora."),
  });

  const isLoading = settingsQuery.isLoading || membersQuery.isLoading || readinessQuery.isLoading;
  const hasError = settingsQuery.isError || membersQuery.isError || readinessQuery.isError;
  const hasUnsavedChanges =
    organizationName !== String(settings.organizationName ?? settings.name ?? "") ||
    timezone !== String(settings.timezone ?? "America/Sao_Paulo");

  const problems = useMemo(() => {
    const items: string[] = [];
    if (!organizationName.trim()) items.push("Preencher o nome da empresa.");
    if (members.length === 0) items.push("Adicionar pelo menos uma pessoa na equipe.");
    if (!readiness?.stripe?.configured) items.push("Conectar pagamentos para evitar falhas de cobrança.");
    if (!readiness?.twilio?.configured) items.push("Conectar WhatsApp para manter confirmações e lembretes.");
    return items;
  }, [organizationName, members.length, readiness?.stripe?.configured, readiness?.twilio?.configured]);

  const refetchAll = () => {
    void Promise.all([settingsQuery.refetch(), membersQuery.refetch(), readinessQuery.refetch()]);
  };

  const focused = SECTION_ORDER.find(section => section.key === focusedSection) ?? SECTION_ORDER[0];

  return (
    <PageWrapper title="Configurações" subtitle="Controle do sistema com linguagem simples e foco operacional.">
      <AppPageShell>
        <AppOperationalHeader
          title="Configurações"
          description="Ajuste regras do dia a dia sem entrar em painéis técnicos."
          primaryAction={
            <Button onClick={() => updateMutation.mutate({ organizationName, timezone })} isLoading={updateMutation.isPending}>
              Salvar ajustes
            </Button>
          }
          contextChips={
            <>
              <AppStatusBadge label={`${members.length} na equipe`} />
              <AppStatusBadge label={readiness?.stripe?.configured ? "Financeiro conectado" : "Financeiro pendente"} />
              <AppStatusBadge label={readiness?.twilio?.configured ? "WhatsApp conectado" : "WhatsApp pendente"} />
              <AppStatusBadge label={`Seção ativa: ${focused.title}`} />
            </>
          }
        />

        <OperationalTopCard className="hidden" title="Configurações operacionais" description="Estrutura V3 para ajustes rápidos sem painel técnico." />

        {isLoading ? <AppPageLoadingState description="Carregando configurações operacionais..." /> : null}
        {hasError ? <AppPageErrorState description="Não foi possível carregar as configurações." onAction={refetchAll} /> : null}

        {!isLoading && !hasError ? (
          <>
            <AppSectionBlock title="2) Atenção" subtitle="O que precisa de ajuste para não travar a operação.">
              {problems.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Tudo certo. Nenhum bloqueio crítico de configuração agora.</p>
              ) : (
                <ul className="space-y-2">
                  {problems.map(problem => (
                    <li key={problem} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                      {problem}
                    </li>
                  ))}
                </ul>
              )}
            </AppSectionBlock>

            <AppSectionBlock title="3) Navegação por seções" subtitle="Escolha uma área e ajuste só o necessário.">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {SECTION_ORDER.map(section => (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => {
                      setFocusedSection(section.key);
                      if (section.route) navigate(section.route);
                    }}
                    className={`rounded-lg border px-3 py-3 text-left transition ${focusedSection === section.key
                      ? "border-[var(--brand-primary)] bg-[var(--surface-base)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-muted)]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{section.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{section.description}</p>
                  </button>
                ))}
              </div>
            </AppSectionBlock>

            <div className="grid gap-4 xl:grid-cols-2">
              <AppSectionBlock title="4) Blocos de configuração · geral" subtitle="Dados principais da empresa.">
                <div className="grid gap-2 md:grid-cols-2">
                  <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="Nome da empresa" />
                  <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="Fuso horário" />
                  <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={String(settings.cnpj ?? "")} readOnly placeholder="CNPJ" />
                  <input className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={String(settings.address ?? "")} readOnly placeholder="Endereço" />
                </div>
              </AppSectionBlock>

              <AppSectionBlock title="4) Blocos de configuração · equipe" subtitle="Quem opera e quais acessos estão ativos.">
                {members.length === 0 ? (
                  <AppPageEmptyState title="Equipe ainda vazia" description="Adicione pessoas para distribuir responsabilidades." />
                ) : (
                  <div className="space-y-2">
                    {members.slice(0, 6).map((member, index) => (
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

              <AppSectionBlock title="4) Blocos de configuração · financeiro" subtitle="Condição de pagamento e cobrança da operação.">
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <p>Pagamentos automáticos: <strong className="text-[var(--text-primary)]">{readiness?.stripe?.configured ? "Conectado" : "Pendente"}</strong></p>
                  <p>Cobrança recorrente: <strong className="text-[var(--text-primary)]">Monitorada pelo módulo financeiro</strong></p>
                </div>
                <div className="mt-3"><Button size="sm" variant="outline" onClick={() => navigate("/finances")}>Abrir financeiro</Button></div>
              </AppSectionBlock>

              <AppSectionBlock title="4) Blocos de configuração · whatsapp" subtitle="Comunicação de rotina com clientes.">
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <p>Canal principal: <strong className="text-[var(--text-primary)]">WhatsApp</strong></p>
                  <p>Status da conexão: <strong className="text-[var(--text-primary)]">{readiness?.twilio?.configured ? "Conectado" : "Pendente"}</strong></p>
                </div>
                <div className="mt-3"><Button size="sm" variant="outline" onClick={() => navigate("/whatsapp")}>Abrir WhatsApp</Button></div>
              </AppSectionBlock>

              <AppSectionBlock title="4) Blocos de configuração · agenda" subtitle="Visão de compromissos e conflitos do dia.">
                <p className="text-sm text-[var(--text-secondary)]">Use a agenda para ajustar janelas, confirmar horários e evitar sobreposição de atendimento.</p>
                <div className="mt-3"><Button size="sm" variant="outline" onClick={() => navigate("/calendar")}>Abrir agenda</Button></div>
              </AppSectionBlock>

              <AppSectionBlock title="4) Blocos de configuração · notificações" subtitle="Defina alertas úteis para a rotina, sem excesso.">
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <label className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                    <span>Lembrete de agenda para equipe</span>
                    <input type="checkbox" checked={notifyAppointments} onChange={event => setNotifyAppointments(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                    <span>Alerta de cobrança pendente</span>
                    <input type="checkbox" checked={notifyFinance} onChange={event => setNotifyFinance(event.target.checked)} />
                  </label>
                </div>
              </AppSectionBlock>

              <AppSectionBlock title="4) Blocos de configuração · integrações" subtitle="Conexões que mantêm o sistema rodando sem retrabalho.">
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <p>WhatsApp: <strong className="text-[var(--text-primary)]">{readiness?.twilio?.configured ? "Ativo" : "Pendente"}</strong></p>
                  <p>Pagamentos: <strong className="text-[var(--text-primary)]">{readiness?.stripe?.configured ? "Ativo" : "Pendente"}</strong></p>
                </div>
              </AppSectionBlock>
            </div>

            <AppSectionBlock title="5) Feedback imediato" subtitle="Confirmação visual para evitar dúvida após ajuste.">
              <div className="flex flex-wrap gap-2">
                <AppStatusBadge label={hasUnsavedChanges ? "Alterações não salvas" : "Sem pendências para salvar"} />
                <AppStatusBadge label={notifyAppointments ? "Lembrete de agenda ativo" : "Lembrete de agenda desligado"} />
                <AppStatusBadge label={notifyFinance ? "Alerta financeiro ativo" : "Alerta financeiro desligado"} />
                {lastSavedAt ? <AppStatusBadge label={`Último salvamento às ${lastSavedAt}`} /> : null}
              </div>
            </AppSectionBlock>
          </>
        ) : null}
      </AppPageShell>
    </PageWrapper>
  );
}
