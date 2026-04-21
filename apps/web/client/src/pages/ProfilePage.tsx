import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents ?? 0) / 100);
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").toUpperCase();
  if (status === "DONE" || status === "COMPLETED") return "Concluída";
  if (status === "CANCELED" || status === "CANCELLED") return "Cancelada";
  if (status === "IN_PROGRESS") return "Em execução";
  if (status === "OPEN" || status === "SCHEDULED") return "Aberta";
  return status || "Sem status";
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const meQuery = trpc.nexo.me.useQuery(undefined, { retry: false });
  const settingsQuery = trpc.nexo.settings.get.useQuery(undefined, { retry: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery({ limit: 30 }, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });

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
  const appointments = useMemo(() => normalizeArrayPayload<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const timelineEvents = useMemo(() => normalizeArrayPayload<any>(timelineQuery.data), [timelineQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);

  const [timezone, setTimezone] = useState<string>("America/Sao_Paulo");

  useEffect(() => {
    setTimezone(String(settings.timezone ?? "America/Sao_Paulo"));
  }, [settings.timezone]);

  const personId = String(me.personId ?? me.person?.id ?? "");
  const userId = String(me.id ?? me.userId ?? "");

  const myServiceOrders = useMemo(
    () =>
      serviceOrders.filter((item) => {
        const assigned = String(item?.assignedToPersonId ?? item?.personId ?? "");
        const owner = String(item?.ownerId ?? item?.userId ?? "");
        return (personId && assigned === personId) || (userId && owner === userId);
      }),
    [personId, serviceOrders, userId]
  );

  const myAppointments = useMemo(
    () =>
      appointments.filter((item) => {
        const assigned = String(item?.assignedToPersonId ?? item?.personId ?? "");
        const owner = String(item?.ownerId ?? item?.userId ?? "");
        return (personId && assigned === personId) || (userId && owner === userId);
      }),
    [appointments, personId, userId]
  );

  const pendingTasks = useMemo(
    () =>
      myServiceOrders.filter((item) => {
        const status = String(item?.status ?? "").toUpperCase();
        return status === "OPEN" || status === "ASSIGNED" || status === "IN_PROGRESS";
      }),
    [myServiceOrders]
  );

  const completedOrders = myServiceOrders.filter((item) => {
    const status = String(item?.status ?? "").toUpperCase();
    return status === "DONE" || status === "COMPLETED";
  });

  const personalRevenueCents = charges
    .filter((item) => {
      const status = String(item?.status ?? "").toUpperCase();
      const owner = String(item?.ownerId ?? item?.userId ?? item?.assignedToPersonId ?? "");
      return status === "PAID" && ((personId && owner === personId) || (userId && owner === userId));
    })
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);

  const myTimeline = timelineEvents.filter((event) => {
    const actorId = String(event?.actorId ?? event?.personId ?? event?.userId ?? "");
    return (personId && actorId === personId) || (userId && actorId === userId);
  });

  const hasDataLoading =
    meQuery.isLoading ||
    settingsQuery.isLoading ||
    appointmentsQuery.isLoading ||
    serviceOrdersQuery.isLoading;

  if (hasDataLoading) {
    return (
      <PageWrapper title="Perfil" subtitle="Operação pessoal dentro do NexoGestão.">
        <AppSectionBlock title="Carregando" subtitle="Sincronizando leitura do perfil" compact>
          <AppPageLoadingState description="Buscando visão operacional do usuário..." />
        </AppSectionBlock>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Perfil" subtitle="Quem você é na operação, no que está atuando e qual impacto está gerando.">
      <OperationalTopCard
        contextLabel="Identidade operacional"
        title={String(me.name ?? me.fullName ?? "Usuário")}
        description="Visão executiva do seu papel, entregas em curso e decisões pessoais no sistema."
        chips={
          <>
            <AppStatusBadge label={me.emailVerifiedAt ? "E-mail verificado" : "E-mail pendente"} />
            <AppStatusBadge label={`Papel ${String(me.role ?? "USER")}`} />
            <AppStatusBadge label={`${pendingTasks.length} tarefa(s) pendente(s)`} />
          </>
        }
        primaryAction={
          <Button onClick={() => updateSettings.mutate({ timezone })} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Salvando..." : "Salvar preferências"}
          </Button>
        }
      />

      <AppKpiRow
        items={[
          { title: "Minha operação", value: `${myServiceOrders.length} O.S.`, hint: "escopo atribuído" },
          { title: "Meus agendamentos", value: String(myAppointments.length), hint: "agenda sob responsabilidade" },
          { title: "Pendências", value: String(pendingTasks.length), hint: "itens exigindo ação" },
          { title: "Impacto financeiro", value: formatCurrency(personalRevenueCents), hint: "valor recebido associado" },
        ]}
        gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock title="Resumo do usuário" subtitle="Dados principais de identificação" compact>
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={String(me.name ?? me.fullName ?? "")} readOnly />
            <Input value={String(me.email ?? "")} readOnly />
            <Input value={String(me.role ?? "USER")} readOnly />
            <Input value={String(me.phone ?? "Não informado")} readOnly />
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="Permissões e acesso" subtitle="Estado atual de segurança e habilitações" compact>
          <AppListBlock
            compact
            minItems={3}
            items={[
              {
                title: me.emailVerifiedAt ? "E-mail validado" : "Validação pendente",
                subtitle: me.emailVerifiedAt ? "Conta apta para recuperação segura." : "Finalize a validação do e-mail para reduzir risco.",
                right: <AppStatusBadge label={me.emailVerifiedAt ? "Concluído" : "Pendente"} />,
                action: <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>Abrir configurações</Button>,
              },
              {
                title: "Função operacional",
                subtitle: `Perfil atual: ${String(me.role ?? "Usuário")}`,
                action: <Button variant="outline" size="sm" onClick={() => navigate("/people")}>Revisar acesso</Button>,
              },
              {
                title: "Sessões e atividade",
                subtitle: me.lastLoginAt ? `Último login em ${new Date(String(me.lastLoginAt)).toLocaleString("pt-BR")}` : "Sem registro de login recente",
                action: <Button variant="outline" size="sm" onClick={() => navigate("/timeline")}>Ver timeline</Button>,
              },
            ]}
          />
        </AppSectionBlock>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock title="Minhas O.S." subtitle="Execuções sob minha responsabilidade" compact>
          <AppListBlock
            compact
            minItems={4}
            items={
              myServiceOrders.slice(0, 6).map((item, index) => ({
                title: String(item?.title ?? `O.S. ${index + 1}`),
                subtitle: normalizeStatus(item?.status),
                right: <AppStatusBadge label={normalizeStatus(item?.status)} />,
                action: <Button size="sm" variant="outline" onClick={() => navigate(`/service-orders?id=${String(item?.id ?? "")}`)}>Abrir O.S.</Button>,
              }))
            }
          />
        </AppSectionBlock>

        <AppSectionBlock title="Meus agendamentos" subtitle="Compromissos vinculados à minha rotina" compact>
          <AppListBlock
            compact
            minItems={4}
            items={
              myAppointments.slice(0, 6).map((item, index) => ({
                title: item?.startsAt ? new Date(String(item.startsAt)).toLocaleString("pt-BR") : `Agendamento ${index + 1}`,
                subtitle: `${normalizeStatus(item?.status)} · ${String(item?.notes ?? "Sem observação")}`,
                action: <Button size="sm" variant="outline" onClick={() => navigate(`/appointments?id=${String(item?.id ?? "")}`)}>Abrir agenda</Button>,
              }))
            }
          />
        </AppSectionBlock>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock title="Minhas tarefas pendentes" subtitle="Ações que ainda precisam de fechamento" compact>
          <AppListBlock
            compact
            minItems={4}
            items={
              pendingTasks.slice(0, 6).map((item, index) => ({
                title: String(item?.title ?? `Tarefa ${index + 1}`),
                subtitle: `Status: ${normalizeStatus(item?.status)}`,
                action: <Button size="sm" variant="outline" onClick={() => navigate(`/service-orders?id=${String(item?.id ?? "")}`)}>Resolver</Button>,
              }))
            }
          />
        </AppSectionBlock>

        <AppSectionBlock title="Desempenho pessoal" subtitle="Leitura de produção e conclusão" compact>
          <AppListBlock
            compact
            items={[
              { title: "Ordens concluídas", subtitle: `${completedOrders.length} finalizadas no período carregado.` },
              { title: "Taxa de conclusão", subtitle: myServiceOrders.length > 0 ? `${Math.round((completedOrders.length / myServiceOrders.length) * 100)}% das O.S. atribuídas.` : "Sem O.S. atribuídas para medir." },
              { title: "Consistência de agenda", subtitle: `${myAppointments.length} agendamento(s) associado(s).` },
            ]}
          />
        </AppSectionBlock>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock title="Impacto financeiro gerado" subtitle="Recebimentos associados à sua atuação" compact>
          <AppListBlock
            compact
            items={[
              { title: "Receita recebida", subtitle: formatCurrency(personalRevenueCents) },
              { title: "Cobranças pagas associadas", subtitle: `${charges.filter((item) => String(item?.status ?? "").toUpperCase() === "PAID").length} item(ns) pagos no lote carregado.` },
              { title: "Ação sugerida", subtitle: "Se houver valores pendentes, acompanhe em Finanças para acelerar caixa.", action: <Button size="sm" variant="outline" onClick={() => navigate("/finances")}>Abrir financeiro</Button> },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock title="Minha timeline" subtitle="Eventos e decisões vinculados ao seu usuário" compact>
          <AppListBlock
            compact
            minItems={4}
            items={
              myTimeline.slice(0, 6).map((event, index) => ({
                title: String(event?.action ?? event?.type ?? `Evento ${index + 1}`),
                subtitle: event?.createdAt ? new Date(String(event.createdAt)).toLocaleString("pt-BR") : "Sem data",
                action: <Button size="sm" variant="outline" onClick={() => navigate("/timeline")}>Ver evento</Button>,
              }))
            }
          />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Preferências pessoais e operacionais" subtitle="Ajustes que adaptam o sistema ao seu contexto" compact>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            placeholder="Ex.: America/Sao_Paulo"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
          <Button variant="outline" onClick={() => setTimezone(String(settings.timezone ?? "America/Sao_Paulo"))}>
            Reverter
          </Button>
          <Button onClick={() => updateSettings.mutate({ timezone })} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </AppSectionBlock>
    </PageWrapper>
  );
}
