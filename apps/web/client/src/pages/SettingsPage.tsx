// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";

type Section = {
  title: string;
  description: string;
  impact: string;
  status: string;
  action: string;
  path?: string;
};

function configured(readiness: Record<string, any>, key: string) {
  return readiness?.[key]?.configured === true || readiness?.integrations?.[key] === "configured" || readiness?.integrations?.[key]?.configured === true;
}

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const settingsQuery = trpc.nexo.settings.get.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const membersQuery = trpc.nexo.invites.members.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const utils = trpc.useUtils();

  const settings = useMemo(() => normalizeObjectPayload<any>(settingsQuery.data) ?? {}, [settingsQuery.data]);
  const members = useMemo(() => normalizeArrayPayload<any>(membersQuery.data), [membersQuery.data]);
  const readiness = useMemo(() => normalizeObjectPayload<any>(readinessQuery.data) ?? {}, [readinessQuery.data]);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setName(String(settings.name ?? ""));
    setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
  }, [settings.name, settings.timezone]);

  const updateMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Configurações da empresa salvas.");
      await Promise.all([settingsQuery.refetch(), utils.nexo.settings.get.invalidate()]);
    },
    onError: error => toast.error(error.message || "Não foi possível salvar as configurações."),
  });

  const hasCompany = name.trim().length > 0;
  const stripeReady = configured(readiness, "stripe");
  const whatsappReady = configured(readiness, "twilio") || configured(readiness, "whatsapp");
  const unsaved = name !== String(settings.name ?? "") || timezone !== String(settings.timezone ?? "America/Sao_Paulo");

  const sections: Section[] = [
    { title: "Empresa", description: "Nome, fuso horário e identidade operacional.", impact: "Agenda, prazos, comunicações e relatórios passam a usar a mesma referência.", status: hasCompany ? "Configurado" : "Pendente", action: "Salvar dados da empresa" },
    { title: "Usuários e permissões", description: "Pessoas que podem executar, aprovar e administrar rotinas.", impact: "Define responsabilidade, segurança e rastreabilidade por pessoa.", status: members.length ? `${members.length} usuário(s)` : "Sem equipe", action: "Gerenciar equipe", path: "/people" },
    { title: "Operação", description: "Regras de execução para O.S., agenda e pendências.", impact: "Muda como a fila diária é priorizada e acompanhada.", status: "Operacional", action: "Abrir operação", path: "/service-orders" },
    { title: "Financeiro", description: "Parâmetros de cobrança, recorrência e recebimento.", impact: "Afeta previsibilidade de caixa e bloqueios por inadimplência.", status: stripeReady ? "Pagamentos conectados" : "Pagamento pendente", action: "Abrir financeiro", path: "/finances" },
    { title: "WhatsApp", description: "Canal de confirmação, cobrança e relacionamento com clientes.", impact: "Muda o alcance das notificações e reduz retrabalho manual.", status: whatsappReady ? "Canal conectado" : "Canal pendente", action: "Abrir WhatsApp", path: "/whatsapp" },
    { title: "Automações", description: "Rotinas automáticas acionadas por evento operacional.", impact: "Padroniza lembretes, follow-ups e alertas sem depender de ação manual.", status: "Pronto para regras", action: "Revisar governança", path: "/governance" },
    { title: "Governança", description: "Critérios que indicam risco, restrição e recomendação.", impact: "Muda quando o sistema recomenda intervenção antes do problema escalar.", status: "Monitorado", action: "Abrir governança", path: "/governance" },
    { title: "Integrações", description: "Conexões externas essenciais para operação e cobrança.", impact: "Evita ruptura de comunicação, pagamento e auditoria.", status: stripeReady && whatsappReady ? "Integrações ativas" : "Ação necessária", action: "Ver integrações" },
    { title: "Sistema", description: "Preferências globais de estabilidade, ambiente e suporte.", impact: "Mantém comportamento previsível para o piloto e para o time.", status: "Estável", action: "Atualizar leitura" },
  ];

  const pendingCount = sections.filter(section => section.status.toLowerCase().includes("pendente") || section.status === "Ação necessária" || section.status === "Sem equipe").length;

  return (
    <PageWrapper title="Configurações" subtitle="Centro de controle operacional com impacto explicado em linguagem de negócio.">
      <AppPageShell>
        <AppOperationalHeader
          title="Configurações operacionais"
          description="Cada bloco mostra o que muda na operação antes de pedir uma ação. Evita painel técnico e decisões sem contexto."
          primaryAction={<Button disabled={!unsaved || updateMutation.isPending} onClick={() => updateMutation.mutate({ name, timezone })}>{updateMutation.isPending ? "Salvando..." : "Salvar empresa"}</Button>}
          secondaryActions={<Button variant="outline" onClick={() => void Promise.all([settingsQuery.refetch(), membersQuery.refetch(), readinessQuery.refetch()])}>Atualizar leitura</Button>}
          contextChips={<><AppStatusBadge label={unsaved ? "Alterações não salvas" : "Sem alterações"} /><AppStatusBadge label={`${pendingCount} pendência(s)`} /></>}
        />

        <AppSectionBlock title="Empresa" subtitle="Dados base usados por agenda, prazos e relatórios." compact>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Empresa<input className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]" value={name} onChange={event => setName(event.target.value)} placeholder="Nome da empresa" /></label>
            <label className="text-xs font-medium text-[var(--text-secondary)]">Fuso horário<input className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]" value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="America/Sao_Paulo" /></label>
          </div>
        </AppSectionBlock>

        <AppKpiRow items={[{ title: "Blocos de controle", value: String(sections.length), hint: "Áreas organizadas por impacto operacional." }, { title: "Equipe", value: String(members.length), hint: "Usuários e permissões atuais." }, { title: "Integrações", value: stripeReady && whatsappReady ? "Ativas" : "Pendentes", hint: "Pagamentos e comunicação." }, { title: "Pendências", value: String(pendingCount), hint: "Itens que podem afetar piloto." }]} />

        <AppSectionBlock title="Centro de controle" subtitle="Áreas em cards: impacto visível antes da ação." compact>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {sections.map(section => (
              <article key={section.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{section.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{section.description}</p>
                  </div>
                  <AppStatusBadge label={section.status} />
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{section.impact}</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => section.path ? navigate(section.path) : void Promise.all([settingsQuery.refetch(), readinessQuery.refetch()])}>{section.action}</Button>
              </article>
            ))}
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="Usuários e permissões" subtitle="Leitura rápida de quem pode agir no sistema.">
          <AppDataTable className="min-w-[720px]"><thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-3 py-2">Usuário</th><th className="px-3 py-2">Função</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Impacto</th></tr></thead><tbody>{members.length ? members.slice(0, 8).map((member: any, index: number) => <tr key={String(member?.id ?? index)} className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 text-[var(--text-primary)]">{String(member?.name ?? member?.email ?? "Usuário")}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{String(member?.role ?? "Sem função")}</td><td className="px-3 py-3"><AppStatusBadge label={member?.active === false ? "Inativo" : "Ativo"} /></td><td className="px-3 py-3 text-[var(--text-secondary)]">Define o que essa pessoa pode executar ou aprovar.</td></tr>) : <tr><td colSpan={4} className="px-3 py-4 text-[var(--text-muted)]">Nenhum usuário retornado pela fonte de permissões.</td></tr>}</tbody></AppDataTable>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
