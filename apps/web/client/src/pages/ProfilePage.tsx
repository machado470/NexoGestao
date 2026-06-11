import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalFlowStageState,
  type OperationalStateLevel,
} from "@/components/app/OperationalCommandLayer";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppFiltersBar,
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
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { useAuth } from "@/contexts/AuthContext";

function currencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatDateTime(value: unknown, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value: unknown) {
  const status = String(value ?? "OPEN").toUpperCase();
  if (["DONE", "COMPLETED"].includes(status)) return "Concluída";
  if (["CANCELED", "CANCELLED"].includes(status)) return "Cancelada";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (status === "ASSIGNED") return "Atribuída";
  return "Aberta";
}

function averageMinutes(items: any[]) {
  const durations = items
    .map(item => {
      const start = new Date(
        String(item?.startedAt ?? item?.createdAt ?? "")
      ).getTime();
      const end = new Date(
        String(item?.completedAt ?? item?.updatedAt ?? "")
      ).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        return null;
      return Math.round((end - start) / 60000);
    })
    .filter((value): value is number => typeof value === "number");
  if (!durations.length) return "—";
  const avg = Math.round(
    durations.reduce((total, item) => total + item, 0) / durations.length
  );
  return avg < 60 ? `${avg} min` : `${Math.floor(avg / 60)}h ${avg % 60}min`;
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [availability, setAvailability] = useOperationalMemoryState(
    "nexo.profile.availability.v4",
    "Disponível"
  );
  const [notifications, setNotifications] = useOperationalMemoryState(
    "nexo.profile.notifications.v1",
    "Alertas críticos"
  );
  const [workPreference, setWorkPreference] = useOperationalMemoryState(
    "nexo.profile.work-preference.v1",
    "O.S. urgentes primeiro"
  );

  const meQuery = trpc.nexo.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 120 },
    { enabled: isAuthenticated, retry: false }
  );
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 120 },
    { enabled: isAuthenticated, retry: false }
  );
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery(
    { limit: 80 },
    { enabled: isAuthenticated, retry: false }
  );

  const me = useMemo(
    () => normalizeObjectPayload<any>(meQuery.data) ?? {},
    [meQuery.data]
  );
  const appointments = useMemo(
    () => normalizeArrayPayload<any>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const serviceOrdersPayload = useMemo(
    () => normalizeObjectPayload<any>(serviceOrdersQuery.data) ?? {},
    [serviceOrdersQuery.data]
  );
  const chargesPayload = useMemo(
    () => normalizeObjectPayload<any>(chargesQuery.data) ?? {},
    [chargesQuery.data]
  );
  const serviceOrders = useMemo(
    () =>
      normalizeArrayPayload<any>(
        serviceOrdersPayload.data ??
          serviceOrdersPayload.items ??
          serviceOrdersQuery.data
      ),
    [serviceOrdersPayload, serviceOrdersQuery.data]
  );
  const charges = useMemo(
    () =>
      normalizeArrayPayload<any>(
        chargesPayload.data ?? chargesPayload.items ?? chargesQuery.data
      ),
    [chargesPayload, chargesQuery.data]
  );
  const timeline = useMemo(
    () => normalizeArrayPayload<any>(timelineQuery.data),
    [timelineQuery.data]
  );

  const personId = String(me.personId ?? me.person?.id ?? "");
  const userId = String(me.id ?? me.userId ?? "");
  const name = String(me.name ?? me.person?.name ?? me.email ?? "Usuário");
  const email = String(me.email ?? me.person?.email ?? "E-mail não informado");
  const role = String(
    me.role ?? me.person?.role ?? me.person?.function ?? "Operador"
  );
  const organization = String(
    me.organization?.name ??
      me.org?.name ??
      me.organizationName ??
      "Organização atual"
  );
  const permissions = normalizeArrayPayload<any>(
    me.permissions ?? me.permissionKeys ?? me.roles ?? me.claims
  );
  const permissionCount = permissions.length || (role ? 1 : 0);
  const lastActivity =
    me.lastActivityAt ?? me.updatedAt ?? timeline[0]?.createdAt;
  const hasRecentActivity = lastActivity
    ? Date.now() - new Date(String(lastActivity)).getTime() <=
      1000 * 60 * 60 * 24 * 7
    : false;

  const owns = (item: any) => {
    const refs = [
      item?.assignedToPersonId,
      item?.assigneePersonId,
      item?.technicianId,
      item?.responsiblePersonId,
      item?.personId,
      item?.ownerId,
      item?.userId,
      item?.createdById,
      item?.actorId,
    ].map(value => String(value ?? ""));
    return (
      (personId && refs.includes(personId)) || (userId && refs.includes(userId))
    );
  };

  const myOrders = serviceOrders.filter(owns);
  const myAppointments = appointments.filter(owns);
  const myTimeline = timeline
    .filter(
      item =>
        owns(item) || String(item?.actorId ?? item?.userId ?? "") === userId
    )
    .slice(0, 10);
  const pendingOrders = myOrders.filter(
    item =>
      !["DONE", "COMPLETED", "CANCELED", "CANCELLED"].includes(
        String(item?.status ?? "").toUpperCase()
      )
  );
  const completedOrders = myOrders.filter(item =>
    ["DONE", "COMPLETED"].includes(String(item?.status ?? "").toUpperCase())
  );
  const delayedOrders = pendingOrders.filter(item => {
    const rawDueDate =
      item?.dueDate ?? item?.scheduledEndAt ?? item?.deadlineAt;
    if (!rawDueDate) return false;
    const due = new Date(String(rawDueDate)).getTime();
    return Number.isFinite(due) && due < Date.now();
  });
  const failedOrders = myOrders.filter(item =>
    ["FAILED", "CANCELED", "CANCELLED"].includes(
      String(item?.status ?? "").toUpperCase()
    )
  );
  const pendingAppointments = myAppointments.filter(
    item =>
      !["DONE", "COMPLETED", "CANCELED", "CANCELLED", "NO_SHOW"].includes(
        String(item?.status ?? "").toUpperCase()
      )
  );
  const overdueAppointments = pendingAppointments.filter(item => {
    const rawDate = item?.scheduledAt ?? item?.startAt ?? item?.date;
    if (!rawDate) return false;
    const scheduledAt = new Date(String(rawDate)).getTime();
    return Number.isFinite(scheduledAt) && scheduledAt < Date.now();
  });
  const paidCharges = charges.filter(
    item => String(item?.status ?? "").toUpperCase() === "PAID" && owns(item)
  );
  const revenueCents = paidCharges.reduce(
    (total, item) => total + Number(item?.amountCents ?? item?.amount ?? 0),
    0
  );
  const assignedWorkload = pendingOrders.length + pendingAppointments.length;
  const isOverloaded =
    assignedWorkload >= 12 ||
    pendingOrders.length >= 8 ||
    pendingAppointments.length >= 8;
  const hasLowActivityWithWork = assignedWorkload > 0 && !hasRecentActivity;
  const hasInsufficientPermissionSignal = Boolean(
    me.permissionsRequired && permissionCount === 0
  );

  const operationRows = [
    {
      label: "Minhas O.S.",
      value: String(myOrders.length),
      detail: `${pendingOrders.length} pendente(s)`,
      path: "/service-orders?scope=mine",
    },
    {
      label: "Meus agendamentos",
      value: String(myAppointments.length),
      detail: `${pendingAppointments.length} pendente(s)`,
      path: "/appointments?scope=mine",
    },
    {
      label: "Minhas pendências",
      value: String(assignedWorkload),
      detail:
        delayedOrders.length || overdueAppointments.length
          ? `${delayedOrders.length + overdueAppointments.length} atraso(s)`
          : "Sem atraso crítico",
      path: "/service-orders?scope=mine&status=open",
    },
  ];

  const operationalState = useMemo((): {
    level: OperationalStateLevel;
    reason: string;
    impact: string;
    detailsLabel: string;
    detailsPath: string;
  } => {
    if (
      String(me.status ?? me.person?.status ?? "").toUpperCase() === "SUSPENDED"
    ) {
      return {
        level: "SUSPENDED",
        reason:
          "O usuário veio com status real de suspensão no cadastro carregado.",
        impact:
          "Evita atribuir execução individual sem validação de responsabilidade e permissões.",
        detailsLabel: "Revisar permissões",
        detailsPath: "/settings",
      };
    }
    if (delayedOrders.length || overdueAppointments.length || isOverloaded) {
      return {
        level: "RESTRICTED",
        reason: delayedOrders.length
          ? `${delayedOrders.length} O.S. atribuída(s) a mim estão atrasadas.`
          : isOverloaded
            ? `${assignedWorkload} item(ns) ativos indicam sobrecarga pessoal.`
            : `${overdueAppointments.length} agendamento(s) atribuídos a mim estão pendentes no passado.`,
        impact:
          "Execução, agenda e governança podem depender de intervenção antes de receber novas prioridades.",
        detailsLabel: delayedOrders.length
          ? "Destravar O.S."
          : "Revisar prioridades",
        detailsPath: delayedOrders.length
          ? "/service-orders?scope=mine&status=open"
          : "/appointments?scope=mine",
      };
    }
    if (
      pendingOrders.length ||
      pendingAppointments.length ||
      hasLowActivityWithWork ||
      hasInsufficientPermissionSignal
    ) {
      return {
        level: "WARNING",
        reason: hasLowActivityWithWork
          ? "Há itens atribuídos a mim sem atividade recente disponível na leitura."
          : `${pendingOrders.length} O.S. e ${pendingAppointments.length} agendamento(s) exigem acompanhamento.`,
        impact:
          "A fila individual deve ser revisada para manter prazos, evidência e continuidade operacional.",
        detailsLabel: "Abrir minha fila",
        detailsPath: "/service-orders?scope=mine",
      };
    }
    return {
      level: "NORMAL",
      reason:
        "Não há pendência relevante atribuída a mim no recorte carregado.",
      impact:
        "A operação individual está apta para revisão preventiva, acompanhamento de Timeline e novas prioridades.",
      detailsLabel: "Revisar operação",
      detailsPath: "/timeline?scope=mine",
    };
  }, [
    assignedWorkload,
    delayedOrders.length,
    hasInsufficientPermissionSignal,
    hasLowActivityWithWork,
    isOverloaded,
    me.person?.status,
    me.status,
    overdueAppointments.length,
    pendingAppointments.length,
    pendingOrders.length,
  ]);

  const riskReading = useMemo(() => {
    if (delayedOrders.length) {
      return {
        title: "O.S. atrasadas sob minha responsabilidade",
        reason: `${delayedOrders.length} de ${pendingOrders.length} O.S. pendente(s) atribuídas a mim estão vencidas no recorte atual.`,
        impact:
          "Pode travar execução, comprometer agenda futura e acionar governança sobre responsabilidade individual.",
        ctaLabel: "Abrir O.S. atrasadas",
        path: "/service-orders?scope=mine&status=open",
      };
    }
    if (overdueAppointments.length) {
      return {
        title: "Agenda individual pendente no passado",
        reason: `${overdueAppointments.length} agendamento(s) atribuídos a mim seguem pendentes com data anterior a agora.`,
        impact:
          "Pode gerar O.S. sem entrada validada, perda de prova de atendimento e retrabalho operacional.",
        ctaLabel: "Revisar agenda",
        path: "/appointments?scope=mine",
      };
    }
    if (isOverloaded) {
      return {
        title: "Sobrecarga pessoal detectada",
        reason: `${assignedWorkload} item(ns) ativos estão vinculados a mim entre O.S. e agendamentos.`,
        impact:
          "A priorização fica vulnerável e pode afetar execução, SLA, financeiro decorrente e governança.",
        ctaLabel: "Revisar prioridades",
        path: "/service-orders?scope=mine",
      };
    }
    if (hasLowActivityWithWork) {
      return {
        title: "Baixa atividade com itens atribuídos",
        reason:
          "Há trabalho vinculado a mim, mas a página não recebeu atividade recente do usuário.",
        impact:
          "A Timeline pode ficar sem prova suficiente sobre andamento, decisão e responsabilidade.",
        ctaLabel: "Atualizar andamento",
        path: "/timeline?scope=mine",
      };
    }
    if (hasInsufficientPermissionSignal) {
      return {
        title: "Permissão insuficiente para ação crítica",
        reason:
          "O payload informa necessidade de permissão, mas não retornou permissão acionável para este usuário.",
        impact:
          "A execução pode depender de apoio de governança ou de um responsável com alçada adequada.",
        ctaLabel: "Solicitar apoio",
        path: "/governance",
      };
    }
    return {
      title: "Sem risco individual dominante",
      reason:
        "Não há O.S. atrasada, agendamento vencido, sobrecarga ou silêncio operacional relevante no recorte carregado.",
      impact:
        "A leitura permanece preventiva; continue acompanhando fila, Timeline e permissões sem criar risco genérico.",
      ctaLabel: "Abrir Timeline",
      path: "/timeline?scope=mine",
    };
  }, [
    assignedWorkload,
    delayedOrders.length,
    hasInsufficientPermissionSignal,
    hasLowActivityWithWork,
    isOverloaded,
    overdueAppointments.length,
    pendingOrders.length,
  ]);

  const nextBestAction = useMemo(() => {
    if (delayedOrders.length) {
      return {
        title: "Destravar minhas O.S.",
        entity: `${delayedOrders.length} O.S. atrasada(s)`,
        reason: "O atraso é o sinal mais crítico ligado à minha execução.",
        impact: "Reduz bloqueio de entrega, retrabalho e risco de intervenção.",
        primaryActionLabel: "Abrir minhas O.S.",
        primaryPath: "/service-orders?scope=mine&status=open",
        secondaryActionLabel: "Ver prova",
        secondaryPath: "/timeline?scope=mine",
      };
    }
    if (pendingAppointments.length) {
      return {
        title: "Revisar minha agenda",
        entity: `${pendingAppointments.length} agendamento(s) pendente(s)`,
        reason:
          "A agenda é a entrada operacional que pode gerar ou destravar execução.",
        impact: "Confirma prioridades do dia e evita O.S. sem contexto.",
        primaryActionLabel: "Abrir agenda",
        primaryPath: "/appointments?scope=mine",
        secondaryActionLabel: "Abrir O.S.",
        secondaryPath: "/service-orders?scope=mine",
      };
    }
    if (isOverloaded) {
      return {
        title: "Revisar prioridades",
        entity: `${assignedWorkload} item(ns) ativos`,
        reason: "A carga pessoal ultrapassa o limite seguro desta leitura.",
        impact:
          "Organiza sequência de execução e reduz risco de atraso encadeado.",
        primaryActionLabel: "Abrir fila",
        primaryPath: "/service-orders?scope=mine",
        secondaryActionLabel: "Ver governança",
        secondaryPath: "/governance",
      };
    }
    if (hasLowActivityWithWork) {
      return {
        title: "Atualizar andamento",
        entity: "Minha Timeline operacional",
        reason: "Há itens comigo sem atividade recente disponível.",
        impact: "Melhora prova oficial e reduz dúvida sobre responsabilidade.",
        primaryActionLabel: "Abrir Timeline",
        primaryPath: "/timeline?scope=mine",
        secondaryActionLabel: "Abrir fila",
        secondaryPath: "/service-orders?scope=mine",
      };
    }
    if (hasInsufficientPermissionSignal) {
      return {
        title: "Solicitar apoio",
        entity: "Permissões do usuário",
        reason:
          "A leitura indica possível alçada insuficiente para uma ação crítica.",
        impact:
          "Evita tentativa de execução sem autorização e direciona para suporte operacional.",
        primaryActionLabel: "Abrir governança",
        primaryPath: "/governance",
        secondaryActionLabel: "Ver permissões",
        secondaryPath: "/settings",
      };
    }
    return {
      title: "Revisar minha operação",
      entity: name,
      reason: "Não há pendência crítica no recorte carregado.",
      impact:
        "Mantém a fila individual auditável e pronta para novas prioridades.",
      primaryActionLabel: "Abrir Timeline",
      primaryPath: "/timeline?scope=mine",
      secondaryActionLabel: "Abrir minha fila",
      secondaryPath: "/service-orders?scope=mine",
    };
  }, [
    assignedWorkload,
    delayedOrders.length,
    hasInsufficientPermissionSignal,
    hasLowActivityWithWork,
    isOverloaded,
    name,
    pendingAppointments.length,
  ]);

  const flowStages = useMemo<
    Array<{
      id: string;
      label: string;
      summary: string;
      state: OperationalFlowStageState;
      countOrValue?: string;
      hrefLabel?: string;
      onClick?: () => void;
    }>
  >(() => {
    const orderState: OperationalFlowStageState = delayedOrders.length
      ? "blocked"
      : pendingOrders.length
        ? "warning"
        : completedOrders.length
          ? "done"
          : "idle";
    const riskState: OperationalFlowStageState =
      operationalState.level === "RESTRICTED"
        ? "warning"
        : operationalState.level === "SUSPENDED"
          ? "blocked"
          : "done";
    return [
      {
        id: "profile",
        label: "Perfil",
        countOrValue: name,
        summary: `Função ${role} em ${organization}.`,
        state: meQuery.isLoading ? "idle" : "done",
        hrefLabel: "Atualizar",
        onClick: () => void meQuery.refetch(),
      },
      {
        id: "tasks",
        label: "Minhas tarefas",
        countOrValue: String(assignedWorkload),
        summary: assignedWorkload
          ? "Pendências pessoais em O.S. e agenda."
          : "Sem tarefa atribuída no recorte.",
        state: assignedWorkload
          ? delayedOrders.length || overdueAppointments.length
            ? "warning"
            : "active"
          : "idle",
        hrefLabel: "Abrir fila",
        onClick: () => navigate("/service-orders?scope=mine"),
      },
      {
        id: "appointments",
        label: "Agendamentos",
        countOrValue: String(myAppointments.length),
        summary: pendingAppointments.length
          ? `${pendingAppointments.length} compromisso(s) pendente(s).`
          : "Sem agenda pendente retornada.",
        state: pendingAppointments.length
          ? overdueAppointments.length
            ? "warning"
            : "active"
          : "idle",
        hrefLabel: "Abrir agenda",
        onClick: () => navigate("/appointments?scope=mine"),
      },
      {
        id: "orders",
        label: "O.S.",
        countOrValue: String(myOrders.length),
        summary: delayedOrders.length
          ? "Há O.S. atrasada comigo."
          : pendingOrders.length
            ? "Execução aberta sob minha responsabilidade."
            : completedOrders.length
              ? "Execução concluída no recorte."
              : "Sem O.S. atribuída retornada.",
        state: orderState,
        hrefLabel: "Abrir O.S.",
        onClick: () => navigate("/service-orders?scope=mine"),
      },
      {
        id: "finance",
        label: "Financeiro",
        countOrValue: revenueCents ? currencyBRL(revenueCents) : undefined,
        summary: revenueCents
          ? "Receita paga vinculada à minha execução."
          : "Sem dado financeiro atribuído ao usuário.",
        state: revenueCents ? "active" : "idle",
        hrefLabel: "Abrir financeiro",
        onClick: () => navigate("/finances"),
      },
      {
        id: "timeline",
        label: "Timeline",
        countOrValue: String(myTimeline.length),
        summary: myTimeline.length
          ? "Prova oficial vinculada a mim."
          : "Sem evento oficial individual retornado.",
        state: myTimeline.length ? "done" : "idle",
        hrefLabel: "Abrir Timeline",
        onClick: () => navigate("/timeline?scope=mine"),
      },
      {
        id: "risk",
        label: "Risco/Gov.",
        countOrValue: operationalState.level,
        summary:
          operationalState.level === "NORMAL"
            ? "Leitura saudável no recorte."
            : "Risco individual exige atenção.",
        state: riskState,
        hrefLabel: "Abrir governança",
        onClick: () => navigate("/governance"),
      },
    ];
  }, [
    assignedWorkload,
    completedOrders.length,
    delayedOrders.length,
    meQuery,
    myAppointments.length,
    myOrders.length,
    myTimeline.length,
    navigate,
    operationalState.level,
    organization,
    overdueAppointments.length,
    pendingAppointments.length,
    pendingOrders.length,
    revenueCents,
    role,
    name,
  ]);

  const timelineEvents = useMemo(() => {
    const officialEvents = myTimeline
      .slice(0, 4)
      .map((item: any, index: number) => ({
        id: String(item?.id ?? `timeline-${index}`),
        type: String(
          item?.status ?? item?.severity ?? item?.type ?? "Registrado"
        ),
        occurredAt: formatDateTime(item?.createdAt ?? item?.occurredAt),
        entity: String(
          item?.title ?? item?.event ?? item?.action ?? "Evento operacional"
        ),
        actor: String(item?.actorName ?? item?.personName ?? name),
        summary: String(
          item?.description ??
            item?.message ??
            "Evento oficial associado ao meu trabalho."
        ),
      }));
    if (officialEvents.length) return officialEvents;
    return [
      ...myOrders.slice(0, 2).map((item: any, index: number) => ({
        id: `order-${String(item?.id ?? index)}`,
        type: "O.S. atribuída",
        occurredAt: formatDateTime(item?.updatedAt ?? item?.createdAt),
        entity: String(
          item?.title ?? item?.code ?? item?.id ?? "Ordem de serviço"
        ),
        actor: name,
        summary: `Sinal contextual derivado de O.S. real com status ${statusLabel(item?.status)}. Não substitui a Timeline oficial.`,
      })),
      ...myAppointments.slice(0, 2).map((item: any, index: number) => ({
        id: `appointment-${String(item?.id ?? index)}`,
        type: "Agendamento",
        occurredAt: formatDateTime(
          item?.scheduledAt ?? item?.startAt ?? item?.createdAt
        ),
        entity: String(
          item?.title ?? item?.serviceName ?? item?.id ?? "Agendamento"
        ),
        actor: name,
        summary:
          "Sinal contextual derivado de agendamento real atribuído ao usuário. Não substitui a Timeline oficial.",
      })),
    ].slice(0, 4);
  }, [myAppointments, myOrders, myTimeline, name]);

  const permissionLabels = permissions
    .slice(0, 8)
    .map(permission =>
      String(permission?.name ?? permission?.key ?? permission)
    );

  return (
    <PageWrapper
      title="Perfil"
      subtitle="Central individual de execução, performance e preferências operacionais."
    >
      <AppPageShell>
        <AppOperationalHeader
          title={name}
          description="Use este perfil para decidir o que executar agora, acompanhar sua performance e ajustar sua forma de trabalho."
          primaryAction={
            <Button onClick={() => navigate("/service-orders?scope=mine")}>
              Abrir minha fila
            </Button>
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() =>
                void Promise.all([
                  meQuery.refetch(),
                  appointmentsQuery.refetch(),
                  serviceOrdersQuery.refetch(),
                  chargesQuery.refetch(),
                  timelineQuery.refetch(),
                ])
              }
            >
              Atualizar perfil
            </Button>
          }
          contextChips={
            <>
              <AppStatusBadge label={role} />
              <AppStatusBadge label={String(availability)} />
              <AppStatusBadge
                label={`Última atividade ${formatDateTime(lastActivity)}`}
              />
            </>
          }
        />

        <AppFiltersBar>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-4">
            <span>
              <strong>Função:</strong> {role}
            </span>
            <span>
              <strong>Organização:</strong> {organization}
            </span>
            <span>
              <strong>Status:</strong> {availability}
            </span>
            <span>
              <strong>Última atividade:</strong> {formatDateTime(lastActivity)}
            </span>
          </div>
        </AppFiltersBar>

        <section className="grid gap-4 xl:grid-cols-3">
          <OperationalStateCard
            title="Estado operacional individual"
            level={operationalState.level}
            reason={operationalState.reason}
            impact={operationalState.impact}
            detailsLabel={operationalState.detailsLabel}
            onDetails={() => navigate(operationalState.detailsPath)}
          />
          <OperationalRiskCard
            title={riskReading.title}
            reason={riskReading.reason}
            impact={riskReading.impact}
            ctaLabel={riskReading.ctaLabel}
            onClick={() => navigate(riskReading.path)}
          />
          <NextBestActionCard
            title={nextBestAction.title}
            entity={nextBestAction.entity}
            reason={nextBestAction.reason}
            impact={nextBestAction.impact}
            safetyNote="Esta ação apenas orienta e navega para módulos existentes. Nenhuma O.S., agenda, permissão, governança ou comunicação é executada automaticamente."
            primaryActionLabel={nextBestAction.primaryActionLabel}
            onPrimaryAction={() => navigate(nextBestAction.primaryPath)}
            secondaryActionLabel={nextBestAction.secondaryActionLabel}
            onSecondaryAction={() => navigate(nextBestAction.secondaryPath)}
          />
        </section>

        <OperationalFlowCard
          title="Fluxo individual de execução"
          subtitle="Perfil → Minhas tarefas → Agendamentos → O.S. → Financeiro → Timeline → Risco/Governança"
          stages={flowStages}
        />

        <EntityTimelineCard
          title="Minha Timeline operacional"
          subtitle="Prova operacional do usuário. Sinais contextuais derivados de dados reais aparecem apenas quando a Timeline oficial individual não retorna eventos."
          events={timelineEvents}
          fullTimelineLabel="Abrir Timeline oficial"
          onFullTimeline={() => navigate("/timeline?scope=mine")}
        />

        <AppSectionBlock
          title="Minha operação"
          subtitle="O.S., agendamentos e pendências que dependem diretamente de mim."
        >
          <AppKpiRow
            items={operationRows.map(item => ({
              title: item.label,
              value: item.value,
              hint: item.detail,
              onClick: () => navigate(item.path),
            }))}
            gridClassName="xl:grid-cols-3"
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Minha performance"
          subtitle="Conclusões, atrasos, falhas e tempo médio de execução."
        >
          <AppKpiRow
            items={[
              {
                title: "Concluídas",
                value: String(completedOrders.length),
                hint: "O.S. finalizadas por mim.",
              },
              {
                title: "Atrasos",
                value: String(delayedOrders.length),
                hint: "Pendências vencidas.",
              },
              {
                title: "Falhas",
                value: String(failedOrders.length),
                hint: "Canceladas ou marcadas como falha.",
              },
              {
                title: "Tempo médio",
                value: averageMinutes(completedOrders),
                hint: "Média entre início e conclusão.",
              },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Impacto financeiro"
          subtitle="Serviços executados e valor movimentado ligado à minha execução."
        >
          <AppKpiRow
            items={[
              {
                title: "Serviços executados",
                value: String(completedOrders.length),
                hint: "Base de O.S. concluídas.",
              },
              {
                title: "Valor movimentado",
                value: currencyBRL(revenueCents),
                hint: revenueCents
                  ? "Cobranças pagas atribuídas a mim."
                  : "Sem dado financeiro atribuído ao usuário no recorte.",
              },
            ]}
            gridClassName="xl:grid-cols-2"
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Dados pessoais e permissões"
          subtitle="Identidade, papel e alçada usados pela leitura operacional individual."
        >
          <AppDataTable className="min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Campo</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Uso operacional</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  field: "Nome",
                  value: name,
                  usage: "Identifica o responsável individual da operação.",
                },
                {
                  field: "E-mail",
                  value: email,
                  usage: "Referência de autenticação já disponível no perfil.",
                },
                {
                  field: "Papel/função",
                  value: role,
                  usage: "Define a leitura de responsabilidade e alçada.",
                },
                {
                  field: "Organização",
                  value: organization,
                  usage:
                    "Contexto onde O.S., agenda e Timeline foram carregadas.",
                },
                {
                  field: "Permissões",
                  value: permissionLabels.length
                    ? permissionLabels.join(", ")
                    : "Sem lista detalhada retornada",
                  usage: `${permissionCount} sinal(is) de permissão/papel usados sem alterar auth.`,
                },
              ].map(item => (
                <tr
                  key={item.field}
                  className="border-b border-[var(--border-subtle)]/60"
                >
                  <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                    {item.field}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">
                    {item.value}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">
                    {item.usage}
                  </td>
                </tr>
              ))}
            </tbody>
          </AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock
          title="Preferências operacionais"
          subtitle="Disponibilidade, notificações e preferências de trabalho usadas para orientar a rotina."
        >
          <AppDataTable className="min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Preferência</th>
                <th className="px-3 py-2">Valor atual</th>
                <th className="px-3 py-2">O que muda na operação?</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  key: "availability",
                  label: "Disponibilidade",
                  value: availability,
                  impact:
                    "Define se novas pendências podem ser direcionadas para mim.",
                  action: () =>
                    setAvailability(
                      availability === "Disponível" ? "Focado" : "Disponível"
                    ),
                },
                {
                  key: "notifications",
                  label: "Notificações",
                  value: notifications,
                  impact: "Controla quais alertas interrompem minha execução.",
                  action: () =>
                    setNotifications(
                      notifications === "Alertas críticos"
                        ? "Tudo da minha fila"
                        : "Alertas críticos"
                    ),
                },
                {
                  key: "work",
                  label: "Preferência de trabalho",
                  value: workPreference,
                  impact:
                    "Ordena minha fila por urgência, prazo ou tipo de serviço.",
                  action: () =>
                    setWorkPreference(
                      workPreference === "O.S. urgentes primeiro"
                        ? "Prazo mais próximo"
                        : "O.S. urgentes primeiro"
                    ),
                },
              ].map(item => (
                <tr
                  key={item.key}
                  className="border-b border-[var(--border-subtle)]/60"
                >
                  <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                    {item.label}
                  </td>
                  <td className="px-3 py-3">
                    <AppStatusBadge label={String(item.value)} />
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">
                    {item.impact}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={item.action}>
                      Alternar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </AppDataTable>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
