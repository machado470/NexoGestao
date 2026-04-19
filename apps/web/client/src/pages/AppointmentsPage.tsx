import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { getAppointmentSeverity, getOperationalSeverityLabel } from "@/lib/operations/operational-intelligence";
import {
  AppDataTable,
  AppKpiRow,
  AppListBlock,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
  AppPriorityBadge,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { formatDelta, getDayWindow, getWindow, inRange, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";

export default function AppointmentsPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const appointments = useMemo(() => normalizeArrayPayload<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  const hasData = appointments.length > 0;
  const showInitialLoading = appointmentsQuery.isLoading && !hasData;
  const showErrorState = appointmentsQuery.error && !hasData;
  usePageDiagnostics({
    page: "appointments",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty: !showInitialLoading && !showErrorState && appointments.length === 0,
    dataCount: appointments.length,
  });

  const scheduled = appointments.filter((item) => String(item?.status ?? "").toUpperCase() === "SCHEDULED").length;
  const confirmed = appointments.filter((item) => String(item?.status ?? "").toUpperCase() === "CONFIRMED").length;
  const todayWindow = getDayWindow(0);
  const yesterdayWindow = getDayWindow(1);
  const todayTotal = appointments.filter(item => inRange(safeDate(item?.startsAt), todayWindow.start, todayWindow.end)).length;
  const yesterdayTotal = appointments.filter(item => inRange(safeDate(item?.startsAt), yesterdayWindow.start, yesterdayWindow.end)).length;
  const current7 = getWindow(7, 0);
  const previous7 = getWindow(7, 1);
  const current7Appointments = appointments.filter(item => inRange(safeDate(item?.startsAt), current7.start, current7.end));
  const previous7Appointments = appointments.filter(item => inRange(safeDate(item?.startsAt), previous7.start, previous7.end));
  const confirmationRateCurrent = current7Appointments.length === 0 ? 0 : (current7Appointments.filter(item => String(item?.status ?? "").toUpperCase() === "CONFIRMED").length / current7Appointments.length) * 100;
  const confirmationRatePrevious = previous7Appointments.length === 0 ? 0 : (previous7Appointments.filter(item => String(item?.status ?? "").toUpperCase() === "CONFIRMED").length / previous7Appointments.length) * 100;
  const appointmentsBySlot = appointments.reduce<Record<string, number>>((acc, item) => {
    const slot = safeDate(item?.startsAt)?.toISOString().slice(0, 16) ?? "";
    if (!slot) return acc;
    acc[slot] = (acc[slot] ?? 0) + 1;
    return acc;
  }, {});
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const agendaDoDia = appointments
    .filter((item) => inRange(safeDate(item?.startsAt), dayStart, dayEnd))
    .sort((a, b) => (safeDate(a?.startsAt)?.getTime() ?? 0) - (safeDate(b?.startsAt)?.getTime() ?? 0))
    .slice(0, 6);
  const atrasados = appointments.filter((item) => {
    const start = safeDate(item?.startsAt);
    const status = String(item?.status ?? "").toUpperCase();
    return Boolean(start && start < now && ["SCHEDULED", "CONFIRMED"].includes(status));
  });
  const semResponsavel = appointments.filter((item) => !item?.personId && !item?.assignedToPersonId);
  const gargalosAgenda = [
    ...atrasados.slice(0, 3).map((item) => ({
      title: `${String(item?.customer?.name ?? "Cliente")} atrasado`,
      subtitle: `Início ${safeDate(item?.startsAt)?.toLocaleString("pt-BR") ?? "sem horário"} · ${String(item?.status ?? "").toUpperCase()}`,
      action: <button className="nexo-cta-secondary" onClick={() => navigate(`/whatsapp?customerId=${item?.customerId}`)}>Avisar</button>,
    })),
    ...semResponsavel.slice(0, 3).map((item) => ({
      title: `${String(item?.customer?.name ?? "Cliente")} sem responsável`,
      subtitle: `Agendamento ${safeDate(item?.startsAt)?.toLocaleString("pt-BR") ?? "sem horário"}`,
      action: <button className="nexo-cta-secondary" onClick={() => setOpenCreate(true)}>Reatribuir</button>,
    })),
  ].slice(0, 6);

  return (
    <PageWrapper title="Agendamentos" subtitle="Agenda diária com prioridade clara e próximos passos de execução.">
      <OperationalTopCard
        contextLabel="Direção de agenda"
        title="Fila de agendamentos"
        description="Agendamentos reais com atualização automática após cada criação."
        primaryAction={(
          <ActionFeedbackButton state="idle" idleLabel="Criar agendamento agora" onClick={() => setOpenCreate(true)} />
        )}
      />

      <AppKpiRow
        gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
        items={[
          {
            title: "Agendamentos hoje",
            value: String(todayTotal),
            delta: formatDelta(percentDelta(todayTotal, yesterdayTotal)),
            trend: trendFromDelta(percentDelta(todayTotal, yesterdayTotal)),
            hint: "comparativo com ontem",
          },
          { title: "Confirmados", value: String(confirmed), hint: "prontos para executar" },
          { title: "Pendentes", value: String(scheduled), hint: "aguardando confirmação" },
          {
            title: "Taxa de confirmação",
            value: `${confirmationRateCurrent.toFixed(1).replace(".", ",")}%`,
            delta: formatDelta(percentDelta(confirmationRateCurrent, confirmationRatePrevious)),
            trend: trendFromDelta(percentDelta(confirmationRateCurrent, confirmationRatePrevious)),
            hint: "últimos 7 dias",
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-12">
      <AppSectionBlock
        title="Agenda do dia"
        subtitle="Bloco principal: lista direta com ação imediata para executar sem dispersão"
        className="xl:col-span-8"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--text-muted)]">Comece por aqui: confirme, execute ou reagende e mantenha o dia fluindo.</p>
          <ActionFeedbackButton state="idle" idleLabel="Executar agenda agora" onClick={() => navigate("/service-orders")} />
        </div>
        <AppListBlock
          className="col-span-full"
          compact
          showPlaceholders={false}
          items={agendaDoDia.length > 0
            ? agendaDoDia.map((item) => ({
                title: `${safeDate(item?.startsAt)?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "--:--"} · ${String(item?.customer?.name ?? "Cliente")}`,
                subtitle: `Status ${String(item?.status ?? "").toUpperCase()} · ${String(item?.title ?? "atendimento")}`,
                action: <button className="nexo-cta-secondary" onClick={() => navigate(`/whatsapp?customerId=${item?.customerId}`)}>Executar agora</button>,
              }))
            : [{ title: "Sem agenda hoje", subtitle: "Crie novos horários para preencher a operação.", action: <button className="nexo-cta-secondary" onClick={() => setOpenCreate(true)}>Criar</button> }]}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Conflitos e próximas ações" subtitle="Lateral operacional para destravar o dia" className="xl:col-span-4" compact>
        <AppListBlock
          className="col-span-full"
          compact
          showPlaceholders={false}
          items={gargalosAgenda.length > 0
            ? gargalosAgenda
            : [{ title: "Sem gargalos críticos agora", subtitle: "Mantenha a rotina e monitore novos conflitos.", action: <button className="nexo-cta-secondary" onClick={() => navigate("/service-orders")}>Próxima etapa</button> }]}
        />
      </AppSectionBlock>
      </div>

      <AppSectionBlock title="Fila de agendamentos" subtitle="Sincronizada em tempo real com backend">
        {showInitialLoading ? (
          <AppPageLoadingState description="Carregando agendamentos..." />
        ) : showErrorState ? (
          <AppPageErrorState
            description={appointmentsQuery.error?.message ?? "Falha ao carregar agendamentos."}
            actionLabel="Tentar novamente"
            onAction={() => void appointmentsQuery.refetch()}
          />
        ) : appointments.length === 0 ? (
          <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar agendamento" />
        ) : (
          <AppDataTable>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Início</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Fim</th>
                  <th className="w-[112px] p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => {
                  const severity = getAppointmentSeverity(appointment);
                  const status = String(appointment?.status ?? "").toUpperCase();
                  const slot = safeDate(appointment?.startsAt)?.toISOString().slice(0, 16) ?? "";
                  const hasConflict = Boolean(slot && (appointmentsBySlot[slot] ?? 0) > 1);
                  const operationalState =
                    status === "DONE" ? "Concluído" :
                    status === "CONFIRMED" ? "Confirmado" :
                    hasConflict || severity === "critical" ? "Em risco" : "Pendente";
                  const nextAction = status === "SCHEDULED"
                    ? "Confirmar"
                    : status === "CONFIRMED"
                      ? "Criar O.S."
                      : "Enviar WhatsApp";
                  const priorityLabel = hasConflict || status === "SCHEDULED" ? "HIGH" : "MEDIUM";
                  const handlePrimaryAction = () => {
                    if (nextAction === "Criar O.S.") {
                      navigate(`/service-orders?customerId=${appointment.customerId}&appointmentId=${appointment.id}`);
                      return;
                    }
                    navigate(`/whatsapp?customerId=${appointment.customerId}`);
                  };
                  return (
                  <tr key={String(appointment?.id)} className="border-t border-[var(--border-subtle)]">
                    <td className="p-3">
                      {new Date(String(appointment?.startsAt)).toLocaleString("pt-BR")}
                      {hasConflict ? <p className="text-xs text-[var(--dashboard-danger)]">Conflito de horário detectado</p> : null}
                    </td>
                    <td>
                      <p>{String(appointment?.customer?.name ?? "Cliente")}</p>
                      <p className="text-xs text-[var(--text-muted)]">#{String(appointment?.customerId ?? "—")}</p>
                    </td>
                    <td><AppStatusBadge label={operationalState || getOperationalSeverityLabel(severity)} /></td>
                    <td>{appointment?.endsAt ? new Date(String(appointment.endsAt)).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <AppPriorityBadge label={priorityLabel} />
                        <AppRowActionsDropdown
                          triggerLabel="Mais ações"
                          contentClassName="min-w-[232px]"
                          items={[
                            { label: `${nextAction} · prioritário`, onSelect: handlePrimaryAction },
                            ...(nextAction !== "Confirmar"
                              ? [{ label: "Confirmar", onSelect: () => navigate(`/whatsapp?customerId=${appointment.customerId}`) }]
                              : []),
                            { label: "Criar O.S.", onSelect: () => navigate(`/service-orders?customerId=${appointment.customerId}&appointmentId=${appointment.id}`) },
                            { label: "Enviar WhatsApp", onSelect: () => navigate(`/whatsapp?customerId=${appointment.customerId}`) },
                            { label: "Reagendar", onSelect: () => setOpenCreate(true) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>

      <CreateAppointmentModal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={() => {
          void appointmentsQuery.refetch();
        }}
        customers={customers.map((item) => ({ id: String(item.id), name: String(item.name ?? "Cliente") }))}
      />
    </PageWrapper>
  );
}
