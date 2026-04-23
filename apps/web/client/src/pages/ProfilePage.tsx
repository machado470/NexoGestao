import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import { AppStatCard, AppTimeline, AppTimelineItem } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPageShell,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";

function currencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function statusLabel(value: string) {
  const status = value.toUpperCase();
  if (status === "DONE" || status === "COMPLETED") return "Concluída";
  if (status === "CANCELED" || status === "CANCELLED") return "Cancelada";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (status === "ASSIGNED") return "Atribuída";
  return "Aberta";
}

function formatDateTime(value: unknown, fallback = "—") {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: unknown, end: unknown) {
  if (!start) return "Não iniciado";
  const from = new Date(String(start));
  if (Number.isNaN(from.getTime())) return "Não iniciado";
  const to = end ? new Date(String(end)) : new Date();
  if (Number.isNaN(to.getTime())) return "—";
  const diffMin = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const [availability, setAvailability] = useOperationalMemoryState("nexo.profile.availability.v3", "Disponível");

  const meQuery = trpc.nexo.me.useQuery(undefined, { retry: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 120 }, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 120 }, { retry: false });
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery({ limit: 80 }, { retry: false });

  const me = useMemo(() => normalizeObjectPayload<any>(meQuery.data) ?? {}, [meQuery.data]);
  const appointments = useMemo(() => normalizeArrayPayload<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  const serviceOrdersPayload = useMemo(() => normalizeObjectPayload<any>(serviceOrdersQuery.data) ?? {}, [serviceOrdersQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersPayload.data ?? serviceOrdersPayload.items ?? []), [serviceOrdersPayload]);
  const chargesPayload = useMemo(() => normalizeObjectPayload<any>(chargesQuery.data) ?? {}, [chargesQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesPayload.data ?? chargesPayload.items ?? []), [chargesPayload]);
  const timeline = useMemo(() => normalizeArrayPayload<any>(timelineQuery.data), [timelineQuery.data]);

  const personId = String(me.personId ?? me.person?.id ?? "");
  const userId = String(me.id ?? me.userId ?? "");

  const myOrders = useMemo(
    () =>
      serviceOrders.filter(item => {
        const assigned = String(item?.assignedToPersonId ?? item?.personId ?? "");
        const owner = String(item?.ownerId ?? item?.userId ?? "");
        return (personId && assigned === personId) || (userId && owner === userId);
      }),
    [personId, serviceOrders, userId]
  );

  const myAppointments = useMemo(
    () =>
      appointments.filter(item => {
        const assigned = String(item?.assignedToPersonId ?? item?.personId ?? "");
        return personId && assigned === personId;
      }),
    [appointments, personId]
  );

  const myPending = myOrders.filter(item => ["OPEN", "IN_PROGRESS", "ASSIGNED"].includes(String(item?.status ?? "").toUpperCase()));
  const myCompleted = myOrders.filter(item => ["DONE", "COMPLETED"].includes(String(item?.status ?? "").toUpperCase()));
  const myDelayed = myOrders.filter(item => {
    const due = item?.dueDate ? new Date(String(item.dueDate)).getTime() : Number.POSITIVE_INFINITY;
    return due < Date.now() && ["OPEN", "IN_PROGRESS", "ASSIGNED"].includes(String(item?.status ?? "").toUpperCase());
  });

  const myRevenue = charges
    .filter(item => String(item?.status ?? "").toUpperCase() === "PAID")
    .filter(item => {
      const owner = String(item?.ownerId ?? item?.userId ?? item?.assignedToPersonId ?? "");
      return owner === personId || owner === userId;
    })
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);

  const myTimeline = useMemo(
    () =>
      timeline.filter(event => {
        const actor = String(event?.actorId ?? event?.personId ?? event?.userId ?? "");
        return actor === personId || actor === userId;
      }),
    [personId, timeline, userId]
  );

  const urgentTasks = useMemo(
    () =>
      [...myPending]
        .sort((a, b) => {
          const dueA = a?.dueDate ? new Date(String(a.dueDate)).getTime() : Number.POSITIVE_INFINITY;
          const dueB = b?.dueDate ? new Date(String(b.dueDate)).getTime() : Number.POSITIVE_INFINITY;
          return dueA - dueB;
        })
        .slice(0, 8),
    [myPending]
  );

  const immediateAlerts = useMemo(
    () => [
      {
        key: "late",
        title: "Tarefas atrasadas",
        count: myDelayed.length,
        context: "Atraso já impacta cliente e previsibilidade.",
        impact: "Risco de quebra no fluxo operacional.",
        ctaLabel: "Corrigir atrasos",
        action: () => navigate("/service-orders?scope=mine&period=overdue&source=profile"),
      },
      {
        key: "today",
        title: "Agenda de hoje",
        count: myAppointments.length,
        context: "Compromissos no seu turno atual.",
        impact: "Sequência de execução depende de confirmação.",
        ctaLabel: "Abrir agenda",
        action: () => navigate("/appointments?scope=mine&period=today&source=profile"),
      },
      {
        key: "pending",
        title: "Tarefas pendentes",
        count: myPending.length,
        context: "Fila pessoal aguardando avanço.",
        impact: "Receita só fecha com execução concluída.",
        ctaLabel: "Abrir fila",
        action: () => navigate("/service-orders?scope=mine&filter=pending&source=profile"),
      },
    ].filter(item => item.count > 0).slice(0, 3),
    [myAppointments.length, myDelayed.length, myPending.length, navigate]
  );

  const nextBestAction = useMemo(() => {
    if (myDelayed.length > 0) {
      return {
        title: "Resolver a O.S. mais atrasada",
        reason: "Existem tarefas fora do prazo sob sua responsabilidade.",
        impact: "Reduz risco de retrabalho e protege SLA do cliente.",
        ctaLabel: "Abrir atrasadas",
        action: () => navigate("/service-orders?scope=mine&period=overdue&source=profile"),
      };
    }

    if (myPending.length > 0) {
      return {
        title: "Avançar a próxima tarefa da fila",
        reason: "Você tem tarefas abertas que já podem evoluir de status.",
        impact: "Mantém cadência de execução e previsibilidade diária.",
        ctaLabel: "Continuar execução",
        action: () => navigate("/service-orders?scope=mine&filter=in_progress&source=profile"),
      };
    }

    return {
      title: "Confirmar próximos agendamentos",
      reason: "Sem bloqueio crítico na fila agora.",
      impact: "Garante continuidade operacional para o próximo turno.",
      ctaLabel: "Ver agenda",
      action: () => navigate("/appointments?scope=mine&source=profile"),
    };
  }, [myDelayed.length, myPending.length, navigate]);

  const isLoading = [meQuery, appointmentsQuery, serviceOrdersQuery, chargesQuery, timelineQuery].some(query => query.isLoading);
  const hasError = [meQuery, appointmentsQuery, serviceOrdersQuery, chargesQuery, timelineQuery].some(query => query.isError);

  const refetchAll = () => {
    void Promise.all([meQuery.refetch(), appointmentsQuery.refetch(), serviceOrdersQuery.refetch(), chargesQuery.refetch(), timelineQuery.refetch()]);
  };

  return (
    <AppPageShell>
      <PageWrapper title="Perfil" subtitle="Painel pessoal de execução: tarefas, responsabilidade e desempenho no padrão operacional V3.">
        <div className="space-y-4">
          <AppOperationalHeader
            title="Perfil operacional"
            description="Aqui você enxerga o que fazer agora, como está performando e onde precisa agir primeiro."
            primaryAction={<Button onClick={() => navigate("/service-orders?scope=mine&source=profile")}>Abrir minhas tarefas</Button>}
            secondaryActions={<Button variant="outline" onClick={refetchAll}>Atualizar leitura</Button>}
            contextChips={
              <>
                <AppStatusBadge label={me?.active === false ? "Acesso restrito" : "Acesso ativo"} />
                <AppStatusBadge label={`Função ${String(me?.role ?? "USER")}`} />
                <AppStatusBadge label={`${myPending.length} pendências`} />
                <AppPriorityBadge label={myDelayed.length > 0 ? "Alta" : myPending.length > 2 ? "Média" : "Baixa"} />
                <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={availability} onChange={event => setAvailability(event.target.value)}>
                  <option>Disponível</option>
                  <option>Em execução</option>
                  <option>Indisponível</option>
                </select>
              </>
            }
          />

          {isLoading ? <AppPageLoadingState description="Consolidando seu painel pessoal de execução..." /> : null}
          {hasError ? <AppPageErrorState description="Não foi possível carregar sua leitura operacional agora." onAction={refetchAll} /> : null}

          {!isLoading && !hasError ? (
            <>
              <AppSectionBlock title="1) Header operacional" subtitle="Seu papel, nível de prioridade e estado atual de execução pessoal.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <AppStatCard label="Responsável" value={String(me?.name ?? me?.fullName ?? me?.email ?? "Usuário logado")} helper={`Função ${String(me?.role ?? "USER")}`} />
                  <AppStatCard label="Status pessoal" value={availability} helper={me?.active === false ? "Conta com restrição de acesso." : "Conta ativa para executar tarefas."} />
                  <AppStatCard label="Prioridade do turno" value={myDelayed.length > 0 ? "Alta" : myPending.length > 2 ? "Média" : "Baixa"} helper={`${myPending.length} tarefa(s) pendente(s) no seu radar.`} />
                  <AppStatCard label="Último acesso" value={formatDateTime(me?.lastLoginAt, "Sem registro")} helper="Contexto individual para tomada de decisão rápida." />
                </div>
              </AppSectionBlock>

              <AppSectionBlock title="2) Atenção imediata" subtitle="Somente os pontos que exigem sua ação agora.">
                {immediateAlerts.length === 0 ? (
                  <AppPageEmptyState title="Sem alertas críticos" description="Sua operação pessoal está estável neste momento." />
                ) : (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {immediateAlerts.map(alert => (
                      <div key={alert.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{alert.title}</p>
                          <p className="text-base font-semibold text-[var(--text-primary)]">{alert.count}</p>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">Problema: {alert.context}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Impacto: {alert.impact}</p>
                        <Button size="sm" className="mt-3" onClick={alert.action}>{alert.ctaLabel}</Button>
                      </div>
                    ))}
                  </div>
                )}
              </AppSectionBlock>

              <AppSectionBlock title="3) Próxima melhor ação" subtitle="Uma recomendação direta para você avançar sem travar a operação.">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/40 p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{nextBestAction.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Motivo: {nextBestAction.reason}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Impacto esperado: {nextBestAction.impact}</p>
                  <Button className="mt-3" size="sm" onClick={nextBestAction.action}>{nextBestAction.ctaLabel}</Button>
                </div>
              </AppSectionBlock>

              <AppSectionBlock title="4) KPIs pessoais" subtitle="Leitura rápida do seu desempenho e da sua responsabilidade atual.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <AppStatCard label="Pendências" value={myPending.length} helper="Tarefas abertas sob sua responsabilidade." />
                  <AppStatCard label="Concluídas" value={myCompleted.length} helper="Itens finalizados no ciclo atual." />
                  <AppStatCard label="Atrasadas" value={myDelayed.length} helper={myDelayed.length > 0 ? "Priorize correção imediata." : "Sem atraso crítico no momento."} />
                  <AppStatCard label="Impacto financeiro" value={currencyBRL(myRevenue)} helper="Cobranças pagas ligadas à sua execução." />
                </div>
              </AppSectionBlock>

              <AppSectionBlock title="5) Lista de tarefas" subtitle="Visual de execução com status, tempo e ação direta.">
                {urgentTasks.length === 0 ? (
                  <AppPageEmptyState title="Sem tarefas na fila" description="Quando houver O.S. atribuídas para você, elas aparecerão aqui para execução direta." />
                ) : (
                  <AppDataTable>
                    <table className="w-full table-fixed text-sm">
                      <thead className="bg-[var(--surface-elevated)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        <tr>
                          <th className="w-[20%] px-3 py-2.5 text-left">Tarefa</th>
                          <th className="w-[14%] px-3 py-2.5 text-left">Status</th>
                          <th className="w-[20%] px-3 py-2.5 text-left">Tempo</th>
                          <th className="w-[16%] px-3 py-2.5 text-left">Prazo</th>
                          <th className="w-[30%] px-3 py-2.5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {urgentTasks.map(item => {
                          const id = String(item?.id ?? "");
                          return (
                            <tr key={id} className="border-t border-[var(--border-subtle)]">
                              <td className="px-3 py-3 align-top">
                                <p className="text-sm font-semibold text-[var(--text-primary)]">#{id}</p>
                                <p className="text-xs text-[var(--text-muted)]">{String(item?.serviceName ?? item?.title ?? "Serviço operacional")}</p>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <AppStatusBadge label={statusLabel(String(item?.status ?? "OPEN"))} />
                              </td>
                              <td className="px-3 py-3 align-top">
                                <p className="text-xs text-[var(--text-secondary)]">Início: {formatDateTime(item?.startedAt, "Sem início")}</p>
                                <p className="text-xs text-[var(--text-muted)]">Duração: {formatDuration(item?.startedAt, item?.completedAt)}</p>
                              </td>
                              <td className="px-3 py-3 align-top text-xs text-[var(--text-secondary)]">{formatDateTime(item?.dueDate, "Sem prazo")}</td>
                              <td className="px-3 py-3 align-top text-right">
                                <Button size="sm" variant="outline" onClick={() => navigate(`/service-orders?focus=${id}&scope=mine&source=profile`)}>Executar agora</Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </AppDataTable>
                )}
              </AppSectionBlock>

              <div className="grid gap-4 xl:grid-cols-2">
                <AppSectionBlock title="6) Contexto" subtitle="Eventos e compromissos que explicam sua carga atual.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">Agendamentos no radar</p>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">{myAppointments.length}</p>
                      <Button className="mt-2" variant="outline" size="sm" onClick={() => navigate("/appointments?scope=mine&source=profile")}>Abrir agenda</Button>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">Último acesso</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{formatDateTime(me?.lastLoginAt, "Sem registro")}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">Nome: {String(me?.name ?? me?.fullName ?? me?.email ?? "Usuário logado")}</p>
                    </div>
                  </div>

                  {myTimeline.length === 0 ? (
                    <AppPageEmptyState title="Sem eventos recentes" description="Sua timeline pessoal aparecerá aqui conforme houver execução e atualizações." />
                  ) : (
                    <AppTimeline className="mt-3 space-y-2">
                      {myTimeline.slice(0, 5).map((event, index) => (
                        <AppTimelineItem key={`${String(event?.id ?? "event")}-${index}`}>
                          <p className="text-sm text-[var(--text-primary)]">{String(event?.title ?? event?.type ?? "Evento operacional")}</p>
                          <p className="text-xs text-[var(--text-muted)]">{formatDateTime(event?.createdAt, "Sem data")}</p>
                        </AppTimelineItem>
                      ))}
                    </AppTimeline>
                  )}
                </AppSectionBlock>

                <AppSectionBlock title="7) Configurações (secundário)" subtitle="Preferências de apoio. Não substitui o painel de execução.">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">Disponibilidade operacional</p>
                      <p className="text-sm text-[var(--text-primary)]">Estado atual: {availability}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">Acesso e permissões</p>
                      <p className="text-sm text-[var(--text-primary)]">Função {String(me?.role ?? "USER")} com {me?.active === false ? "restrição" : "acesso ativo"}.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate("/settings?section=operacao&source=profile")}>Abrir preferências</Button>
                    <Button variant="outline" size="sm" onClick={() => navigate("/people?source=profile")}>Ver governança de acesso</Button>
                  </div>
                </AppSectionBlock>
              </div>
            </>
          ) : null}
        </div>
      </PageWrapper>
    </AppPageShell>
  );
}
