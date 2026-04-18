import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { normalizeObjectPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppKpiRow,
  AppListBlock,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
  Input,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";

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
      <PageWrapper title="Perfil" subtitle="Dados pessoais e segurança da conta.">
        <AppSectionBlock title="Carregando" subtitle="Sincronizando perfil" compact>
          <AppPageLoadingState description="Buscando dados do usuário..." />
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Perfil" subtitle="Conta pessoal no sistema com leitura clara e confiável.">
      <OperationalTopCard
        contextLabel="Conta pessoal"
        title={String(me.name ?? me.fullName ?? "Usuário")}
        description="Identidade, segurança e preferências individuais em uma única superfície."
        chips={
          <>
            <AppStatusBadge label={me.emailVerifiedAt ? "E-mail verificado" : "E-mail pendente"} />
            <AppStatusBadge label={String(me.role ?? "Usuário")} />
          </>
        }
        primaryAction={
          <Button
            onClick={() => updateSettings.mutate({ timezone })}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? "Salvando..." : "Salvar preferências"}
          </Button>
        }
      />

      <AppKpiRow
        items={[
          { title: "Nome", value: String(me.name ?? me.fullName ?? "Usuário"), hint: "identidade da sessão" },
          { title: "E-mail", value: String(me.email ?? "—"), hint: "conta principal" },
          { title: "Função", value: String(me.role ?? "Usuário"), hint: "nível de acesso" },
          { title: "Timezone", value: timezone, hint: "preferência de horário" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock title="Dados do usuário" subtitle="Informações básicas da conta" compact>
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={String(me.name ?? me.fullName ?? "")} readOnly />
            <Input value={String(me.email ?? "")} readOnly />
            <Input value={String(me.role ?? "USER")} readOnly />
            <Input
              placeholder="Ex.: America/Sao_Paulo"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="Segurança e acesso" subtitle="Estado atual da conta" compact>
          <AppListBlock
            compact
            minItems={3}
            items={[
              {
                title: me.emailVerifiedAt ? "E-mail validado" : "Validação pendente",
                subtitle: me.emailVerifiedAt ? "Conta apta para recuperação segura." : "Valide o e-mail para reduzir risco de acesso.",
                right: <AppStatusBadge label={me.emailVerifiedAt ? "Concluído" : "Pendente"} />,
                action: <Button variant="outline" size="sm" disabled>Validar</Button>,
              },
              {
                title: "Senha",
                subtitle: "Fluxo de alteração disponível na política de segurança.",
                action: <Button variant="outline" size="sm" disabled>Alterar senha</Button>,
              },
              {
                title: "Último login",
                subtitle: me.lastLoginAt ? new Date(String(me.lastLoginAt)).toLocaleString("pt-BR") : "Sem registro",
                action: <Button variant="outline" size="sm" disabled>Ver sessões</Button>,
              },
            ]}
          />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Atividade recente" subtitle="Contexto da conta no sistema" compact>
        <AppListBlock
          compact
          items={[
            { title: "Acesso", subtitle: me.lastLoginAt ? `Último login em ${new Date(String(me.lastLoginAt)).toLocaleString("pt-BR")}` : "Sem registro recente" },
            { title: "Segurança", subtitle: me.emailVerifiedAt ? "E-mail verificado com sucesso" : "Validação de e-mail pendente" },
            { title: "Preferência", subtitle: `Timezone atual: ${String(settings.timezone ?? timezone)}` },
          ]}
        />
      </AppSectionBlock>
    </PageWrapper>
  );
}
