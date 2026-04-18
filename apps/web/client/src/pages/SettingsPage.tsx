import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import {
  AppFiltersBar,
  AppKpiRow,
  AppListBlock,
  AppPageLoadingState,
  AppSecondaryTabs,
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
  const [activeTab, setActiveTab] = useState<"organizacao" | "usuarios" | "integracoes" | "notificacoes">("organizacao");

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

  return (
    <PageWrapper title="Configurações" subtitle="Central administrativa previsível e escaneável.">
      <OperationalTopCard
        contextLabel="Direção administrativa"
        title="Parâmetros da organização"
        description="Gerencie nome, timezone, membros e integrações no padrão oficial do app."
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

      <AppKpiRow
        items={[
          { title: "Organização", value: String(organizationName || "Não definida"), hint: "identidade operacional" },
          { title: "Membros", value: String(members.length), hint: "acesso ativo" },
          { title: "Integrações", value: `${integrationsReady}/2`, hint: "Stripe + WhatsApp/Twilio" },
          { title: "Timezone", value: String(timezone), hint: "agenda e cobrança" },
        ]}
      />

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
              action: <Button size="sm" variant="outline">Executar</Button>,
            },
          ]}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Seções administrativas" subtitle="Configurações agrupadas por contexto">
        <AppSecondaryTabs
          items={[
            { value: "organizacao", label: "Geral" },
            { value: "usuarios", label: "Permissões" },
            { value: "integracoes", label: "Integrações" },
            { value: "notificacoes", label: "Notificações" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          className="mb-3"
        />

          {activeTab === "organizacao" ? (
            <div className="space-y-3 pt-1">
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
            </div>
          ) : null}

          {activeTab === "usuarios" ? (
            <div className="pt-1">
            <AppListBlock
              compact
              items={members.slice(0, 6).map((member: any, index) => ({
                title: String(member?.name ?? member?.email ?? `Membro ${index + 1}`),
                subtitle: String(member?.role ?? "Sem papel definido"),
                right: <AppStatusBadge label={member?.active === false ? "Inativo" : "Ativo"} />,
                action: <Button size="sm" variant="outline">Gerenciar</Button>,
              }))}
            />
            </div>
          ) : null}

          {activeTab === "integracoes" ? (
            <div className="pt-1">
            <AppListBlock
              compact
              items={[
                { title: "Stripe", subtitle: "Cobrança e assinatura", right: <AppStatusBadge label={readiness?.stripe?.configured ? "Concluído" : "Pendente"} />, action: <Button size="sm" variant="outline">Abrir</Button> },
                { title: "WhatsApp/Twilio", subtitle: "Comunicação com clientes", right: <AppStatusBadge label={readiness?.twilio?.configured ? "Concluído" : "Pendente"} />, action: <Button size="sm" variant="outline">Abrir</Button> },
              ]}
            />
            </div>
          ) : null}

          {activeTab === "notificacoes" ? (
            <div className="pt-1">
            <p className="text-sm text-[var(--text-secondary)]">
              Alertas de risco, atraso e cobrança seguem a política definida em Governança.
            </p>
            </div>
          ) : null}
      </AppSectionBlock>
    </PageWrapper>
  );
}
