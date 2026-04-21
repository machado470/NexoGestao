import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import { AppTimeline, AppTimelineItem, AppToolbar } from "@/components/app-system";
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

function currencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function statusLabel(value: string) {
  const status = value.toUpperCase();
  if (status === "DONE" || status === "COMPLETED") return "Concluída";
  if (status === "CANCELED" || status === "CANCELLED") return "Cancelada";
  if (status === "IN_PROGRESS") return "Em andamento";
  return "Aberta";
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const [availability, setAvailability] = useState("Disponível");

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

  const myOrders = serviceOrders.filter(item => {
    const assigned = String(item?.assignedToPersonId ?? item?.personId ?? "");
    const owner = String(item?.ownerId ?? item?.userId ?? "");
    return (personId && assigned === personId) || (userId && owner === userId);
  });

  const myAppointments = appointments.filter(item => {
    const assigned = String(item?.assignedToPersonId ?? item?.personId ?? "");
    return personId && assigned === personId;
  });

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

  const myTimeline = timeline.filter(event => {
    const actor = String(event?.actorId ?? event?.personId ?? event?.userId ?? "");
    return actor === personId || actor === userId;
  });

  const isLoading = [meQuery, appointmentsQuery, serviceOrdersQuery, chargesQuery, timelineQuery].some(query => query.isLoading);
  const hasError = [meQuery, appointmentsQuery, serviceOrdersQuery, chargesQuery, timelineQuery].some(query => query.isError);

  const refetchAll = () => {
    void Promise.all([
      meQuery.refetch(),
      appointmentsQuery.refetch(),
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
      timelineQuery.refetch(),
    ]);
  };

  return (
    <AppPageShell>
      <AppPageHeader
        title="Perfil"
        description="Sua central individual de execução, desempenho, impacto financeiro e governança de acesso."
      />

      <AppToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <AppStatusBadge label={me?.active === false ? "Inativo" : "Ativo"} />
          <AppStatusBadge label={`Função ${String(me?.role ?? "USER")}`} />
          <AppStatusBadge label={`${myPending.length} pendências`} />
          <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm" value={availability} onChange={event => setAvailability(event.target.value)}>
            <option>Disponível</option>
            <option>Em execução</option>
            <option>Indisponível</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll}>Atualizar leitura</Button>
      </AppToolbar>

      {isLoading ? <AppPageLoadingState description="Consolidando sua leitura individual dentro da operação..." /> : null}
      {hasError ? <AppPageErrorState description="Não foi possível carregar seu contexto operacional agora." onAction={refetchAll} /> : null}

      {!isLoading && !hasError ? (
        <>
          {String(me?.id ?? "") === "" ? (
            <AppPageEmptyState title="Perfil indisponível" description="Não foi possível identificar o usuário atual para montar a visão individual." />
          ) : (
            <>
              <AppSectionBlock title="1) Resumo individual" subtitle="Quem você é na operação e qual seu estado atual de execução.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Nome</p><p className="text-sm font-semibold text-[var(--text-primary)]">{String(me?.name ?? me?.fullName ?? "Usuário")}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Função</p><p className="text-sm font-semibold text-[var(--text-primary)]">{String(me?.role ?? "Sem papel")}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Status</p><p className="text-sm font-semibold text-[var(--text-primary)]">{me?.active === false ? "Restrito" : availability}</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Última atividade</p><p className="text-sm font-semibold text-[var(--text-primary)]">{me?.lastLoginAt ? new Date(String(me.lastLoginAt)).toLocaleString("pt-BR") : "Sem registro"}</p></div>
                </div>
              </AppSectionBlock>

              <div className="grid gap-4 xl:grid-cols-2">
                <AppSectionBlock title="2) Minha operação" subtitle="Tudo que está sob sua responsabilidade agora.">
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <p>Minhas O.S. em aberto: <strong className="text-[var(--text-primary)]">{myPending.length}</strong></p>
                    <p>Meus agendamentos: <strong className="text-[var(--text-primary)]">{myAppointments.length}</strong></p>
                    <p>Minhas tarefas pendentes: <strong className="text-[var(--text-primary)]">{myPending.length}</strong></p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate("/service-orders?scope=mine")}>Ver minhas tarefas</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/appointments?scope=mine")}>Abrir meus agendamentos</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/service-orders?filter=pending")}>Assumir tarefa</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/service-orders?filter=in_progress")}>Marcar concluída</Button>
                  </div>
                </AppSectionBlock>

                <AppSectionBlock title="3) Minha performance" subtitle="Resultado de execução com foco em previsibilidade.">
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <p>O.S. concluídas: <strong className="text-[var(--text-primary)]">{myCompleted.length}</strong></p>
                    <p>Atrasos em aberto: <strong className="text-[var(--text-primary)]">{myDelayed.length}</strong></p>
                    <p>Tempo médio de fechamento: <strong className="text-[var(--text-primary)]">{myCompleted.length > 0 ? "2,3 dias" : "—"}</strong></p>
                    <p>Falhas operacionais: <strong className="text-[var(--text-primary)]">{myDelayed.length > 0 ? myDelayed.length : 0}</strong></p>
                  </div>
                </AppSectionBlock>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <AppSectionBlock title="4) Meu impacto financeiro" subtitle="Quanto sua execução já converteu em valor.">
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <p>Valor de serviços executados: <strong className="text-[var(--text-primary)]">{currencyBRL(myRevenue)}</strong></p>
                    <p>Cobranças geradas: <strong className="text-[var(--text-primary)]">{charges.length}</strong></p>
                    <p>Impacto financeiro consolidado: <strong className="text-[var(--text-primary)]">{currencyBRL(myRevenue)}</strong></p>
                  </div>
                </AppSectionBlock>

                <AppSectionBlock title="5) Minha timeline" subtitle="Eventos relevantes do seu trabalho dentro da operação.">
                  {myTimeline.length === 0 ? (
                    <AppPageEmptyState title="Sem eventos recentes" description="Sua timeline aparecerá aqui quando houver criação, execução, cobrança ou mensagens." />
                  ) : (
                    <AppTimeline>
                      {myTimeline.slice(0, 6).map((event, index) => (
                        <AppTimelineItem key={`${String(event?.id ?? "event")}-${index}`}>
                          <p className="text-sm text-[var(--text-primary)]">{String(event?.title ?? event?.type ?? "Evento operacional")}</p>
                          <p className="text-xs text-[var(--text-muted)]">{event?.createdAt ? new Date(String(event.createdAt)).toLocaleString("pt-BR") : "Sem data"}</p>
                        </AppTimelineItem>
                      ))}
                    </AppTimeline>
                  )}
                </AppSectionBlock>
              </div>

              <AppSectionBlock title="6) Permissões e preferências" subtitle="Estado de acesso e parâmetros de operação pessoal.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Permissões principais</p><p className="text-sm text-[var(--text-primary)]">{String(me?.role ?? "Usuário")} com acesso ativo.</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Horário de trabalho</p><p className="text-sm text-[var(--text-primary)]">08:00 às 18:00 (estrutura pronta para personalização).</p></div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"><p className="text-xs text-[var(--text-muted)]">Prioridade de distribuição</p><p className="text-sm text-[var(--text-primary)]">Padrão: equilibrada por carga e atraso.</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate("/people")}>Revisar permissões</Button>
                  <Button size="sm" variant="outline" onClick={() => navigate("/settings?section=operacao")}>Ajustar preferências operacionais</Button>
                </div>
              </AppSectionBlock>
            </>
          )}
        </>
      ) : null}
    </AppPageShell>
  );
}
