import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { useAuth } from "@/contexts/AuthContext";

function currencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function formatDateTime(value: unknown, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
      const start = new Date(String(item?.startedAt ?? item?.createdAt ?? "")).getTime();
      const end = new Date(String(item?.completedAt ?? item?.updatedAt ?? "")).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return Math.round((end - start) / 60000);
    })
    .filter((value): value is number => typeof value === "number");
  if (!durations.length) return "—";
  const avg = Math.round(durations.reduce((total, item) => total + item, 0) / durations.length);
  return avg < 60 ? `${avg} min` : `${Math.floor(avg / 60)}h ${avg % 60}min`;
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [availability, setAvailability] = useOperationalMemoryState("nexo.profile.availability.v4", "Disponível");
  const [notifications, setNotifications] = useOperationalMemoryState("nexo.profile.notifications.v1", "Alertas críticos");
  const [workPreference, setWorkPreference] = useOperationalMemoryState("nexo.profile.work-preference.v1", "O.S. urgentes primeiro");

  const meQuery = trpc.nexo.me.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 120 }, { enabled: isAuthenticated, retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 120 }, { enabled: isAuthenticated, retry: false });
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery({ limit: 80 }, { enabled: isAuthenticated, retry: false });

  const me = useMemo(() => normalizeObjectPayload<any>(meQuery.data) ?? {}, [meQuery.data]);
  const appointments = useMemo(() => normalizeArrayPayload<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  const serviceOrdersPayload = useMemo(() => normalizeObjectPayload<any>(serviceOrdersQuery.data) ?? {}, [serviceOrdersQuery.data]);
  const chargesPayload = useMemo(() => normalizeObjectPayload<any>(chargesQuery.data) ?? {}, [chargesQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersPayload.data ?? serviceOrdersPayload.items ?? serviceOrdersQuery.data), [serviceOrdersPayload, serviceOrdersQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesPayload.data ?? chargesPayload.items ?? chargesQuery.data), [chargesPayload, chargesQuery.data]);
  const timeline = useMemo(() => normalizeArrayPayload<any>(timelineQuery.data), [timelineQuery.data]);

  const personId = String(me.personId ?? me.person?.id ?? "");
  const userId = String(me.id ?? me.userId ?? "");
  const name = String(me.name ?? me.person?.name ?? me.email ?? "Usuário");
  const role = String(me.role ?? me.person?.role ?? "Operador");
  const lastActivity = me.lastActivityAt ?? me.updatedAt ?? timeline[0]?.createdAt;

  const owns = (item: any) => {
    const refs = [item?.assignedToPersonId, item?.personId, item?.ownerId, item?.userId, item?.createdById].map(value => String(value ?? ""));
    return (personId && refs.includes(personId)) || (userId && refs.includes(userId));
  };

  const myOrders = serviceOrders.filter(owns);
  const myAppointments = appointments.filter(owns);
  const myTimeline = timeline.filter(item => owns(item) || String(item?.actorId ?? item?.userId ?? "") === userId).slice(0, 10);
  const pendingOrders = myOrders.filter(item => !["DONE", "COMPLETED", "CANCELED", "CANCELLED"].includes(String(item?.status ?? "").toUpperCase()));
  const completedOrders = myOrders.filter(item => ["DONE", "COMPLETED"].includes(String(item?.status ?? "").toUpperCase()));
  const delayedOrders = pendingOrders.filter(item => {
    if (!item?.dueDate) return false;
    const due = new Date(String(item.dueDate)).getTime();
    return Number.isFinite(due) && due < Date.now();
  });
  const failedOrders = myOrders.filter(item => ["FAILED", "CANCELED", "CANCELLED"].includes(String(item?.status ?? "").toUpperCase()));
  const paidCharges = charges.filter(item => String(item?.status ?? "").toUpperCase() === "PAID" && owns(item));
  const revenueCents = paidCharges.reduce((total, item) => total + Number(item?.amountCents ?? item?.amount ?? 0), 0);

  const operationRows = [
    { label: "Minhas O.S.", value: String(myOrders.length), detail: `${pendingOrders.length} pendente(s)`, path: "/service-orders?scope=mine" },
    { label: "Meus agendamentos", value: String(myAppointments.length), detail: "Compromissos atribuídos a mim", path: "/appointments?scope=mine" },
    { label: "Minhas pendências", value: String(pendingOrders.length), detail: delayedOrders.length ? `${delayedOrders.length} atraso(s)` : "Sem atraso crítico", path: "/service-orders?scope=mine&status=open" },
  ];

  return (
    <PageWrapper title="Perfil" subtitle="Central individual de execução, performance e preferências operacionais.">
      <AppPageShell>
        <AppOperationalHeader
          title={name}
          description="Use este perfil para decidir o que executar agora, acompanhar sua performance e ajustar sua forma de trabalho."
          primaryAction={<Button onClick={() => navigate("/service-orders?scope=mine")}>Abrir minha fila</Button>}
          secondaryActions={<Button variant="outline" onClick={() => void Promise.all([meQuery.refetch(), appointmentsQuery.refetch(), serviceOrdersQuery.refetch(), chargesQuery.refetch(), timelineQuery.refetch()])}>Atualizar perfil</Button>}
          contextChips={<><AppStatusBadge label={role} /><AppStatusBadge label={String(availability)} /><AppStatusBadge label={`Última atividade ${formatDateTime(lastActivity)}`} /></>}
        />

        <AppFiltersBar>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-3">
            <span><strong>Função:</strong> {role}</span>
            <span><strong>Status:</strong> {availability}</span>
            <span><strong>Última atividade:</strong> {formatDateTime(lastActivity)}</span>
          </div>
        </AppFiltersBar>

        <AppSectionBlock title="Minha operação" subtitle="O.S., agendamentos e pendências que dependem diretamente de mim.">
          <AppKpiRow items={operationRows.map(item => ({ title: item.label, value: item.value, hint: item.detail, onClick: () => navigate(item.path) }))} gridClassName="xl:grid-cols-3" />
        </AppSectionBlock>

        <AppSectionBlock title="Minha performance" subtitle="Conclusões, atrasos, falhas e tempo médio de execução.">
          <AppKpiRow items={[{ title: "Concluídas", value: String(completedOrders.length), hint: "O.S. finalizadas por mim." }, { title: "Atrasos", value: String(delayedOrders.length), hint: "Pendências vencidas." }, { title: "Falhas", value: String(failedOrders.length), hint: "Canceladas ou marcadas como falha." }, { title: "Tempo médio", value: averageMinutes(completedOrders), hint: "Média entre início e conclusão." }]} />
        </AppSectionBlock>

        <AppSectionBlock title="Impacto financeiro" subtitle="Serviços executados e valor movimentado ligado à minha execução.">
          <AppKpiRow items={[{ title: "Serviços executados", value: String(completedOrders.length), hint: "Base de O.S. concluídas." }, { title: "Valor movimentado", value: currencyBRL(revenueCents), hint: "Cobranças pagas atribuídas a mim." }]} gridClassName="xl:grid-cols-2" />
        </AppSectionBlock>

        <AppSectionBlock title="Minha timeline" subtitle="Tudo que eu executei ou que foi registrado com meu vínculo operacional.">
          <AppDataTable className="min-w-[760px]"><thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Evento</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Contexto</th></tr></thead><tbody>{myTimeline.length ? myTimeline.map((item: any, index: number) => <tr key={String(item?.id ?? index)} className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3">{formatDateTime(item?.createdAt ?? item?.occurredAt)}</td><td className="px-3 py-3 text-[var(--text-primary)]">{String(item?.title ?? item?.event ?? item?.type ?? "Execução registrada")}</td><td className="px-3 py-3"><AppStatusBadge label={String(item?.status ?? item?.severity ?? "Registrado")} /></td><td className="px-3 py-3 text-[var(--text-secondary)]">{String(item?.description ?? item?.message ?? "Evento associado ao meu trabalho.")}</td></tr>) : <tr><td colSpan={4} className="px-3 py-4 text-[var(--text-muted)]">Ainda não há eventos atribuídos a mim nesta fonte.</td></tr>}</tbody></AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock title="Preferências operacionais" subtitle="Disponibilidade, notificações e preferências de trabalho usadas para orientar a rotina.">
          <AppDataTable className="min-w-[720px]"><thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-3 py-2">Preferência</th><th className="px-3 py-2">Valor atual</th><th className="px-3 py-2">O que muda na operação?</th><th className="px-3 py-2 text-right">Ação</th></tr></thead><tbody>{[{ key: "availability", label: "Disponibilidade", value: availability, impact: "Define se novas pendências podem ser direcionadas para mim.", action: () => setAvailability(availability === "Disponível" ? "Focado" : "Disponível") }, { key: "notifications", label: "Notificações", value: notifications, impact: "Controla quais alertas interrompem minha execução.", action: () => setNotifications(notifications === "Alertas críticos" ? "Tudo da minha fila" : "Alertas críticos") }, { key: "work", label: "Preferência de trabalho", value: workPreference, impact: "Ordena minha fila por urgência, prazo ou tipo de serviço.", action: () => setWorkPreference(workPreference === "O.S. urgentes primeiro" ? "Prazo mais próximo" : "O.S. urgentes primeiro") }].map(item => <tr key={item.key} className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 font-medium text-[var(--text-primary)]">{item.label}</td><td className="px-3 py-3"><AppStatusBadge label={String(item.value)} /></td><td className="px-3 py-3 text-[var(--text-secondary)]">{item.impact}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={item.action}>Alternar</Button></td></tr>)}</tbody></AppDataTable>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
