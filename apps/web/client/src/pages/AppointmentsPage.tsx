import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { getAppointmentSeverity, getOperationalSeverityLabel } from "@/lib/operations/operational-intelligence";
import {
  AppDataTable,
  AppKpiRow,
  AppNextActionCard,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppRowActions,
  AppSectionBlock,
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

  return (
    <PageWrapper title="Agendamentos" subtitle="Agenda operacional com ações padronizadas e rastreáveis.">
      <OperationalTopCard
        contextLabel="Direção de agenda"
        title="Fila de agendamentos"
        description="Agendamentos reais com atualização automática após cada criação."
        primaryAction={(
          <ActionFeedbackButton state="idle" idleLabel="Criar agendamento agora" onClick={() => setOpenCreate(true)} />
        )}
      />

      <AppKpiRow
        items={[
          {
            title: "Agendamentos hoje",
            value: String(todayTotal),
            delta: formatDelta(percentDelta(todayTotal, yesterdayTotal)),
            trend: trendFromDelta(percentDelta(todayTotal, yesterdayTotal)),
            hint: "comparativo com ontem",
          },
          { title: "Confirmados", value: String(confirmed), hint: "prontos para execução" },
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
                  <th className="p-3">Ações</th>
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
                      : hasConflict
                        ? "Reagendar"
                        : "Enviar WhatsApp";
                  return (
                  <tr key={String(appointment?.id)} className="border-t border-[var(--border-subtle)]">
                    <td className="p-3">
                      {new Date(String(appointment?.startsAt)).toLocaleString("pt-BR")}
                      {hasConflict ? <p className="text-xs text-rose-300">Conflito de horário detectado</p> : null}
                    </td>
                    <td>
                      <p>{String(appointment?.customer?.name ?? "Cliente")}</p>
                      <p className="text-xs text-[var(--text-muted)]">#{String(appointment?.customerId ?? "—")}</p>
                    </td>
                    <td><AppStatusBadge label={operationalState || getOperationalSeverityLabel(severity)} /></td>
                    <td>{appointment?.endsAt ? new Date(String(appointment.endsAt)).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3">
                      <div className="space-y-2">
                        <AppNextActionCard
                          title="Próxima ação"
                          description={hasConflict ? "Resolver conflito antes da execução." : "Mantenha o fluxo de execução ativo."}
                          severity={hasConflict ? "critical" : status === "CONFIRMED" ? "medium" : "high"}
                          metadata="agendamento"
                          action={{
                            label: nextAction,
                            onClick: () => navigate(nextAction === "Criar O.S." ? `/service-orders?customerId=${appointment.customerId}&appointmentId=${appointment.id}` : `/whatsapp?customerId=${appointment.customerId}`),
                          }}
                        />
                        <AppRowActions
                          actions={[
                            { label: "Criar O.S.", onClick: () => navigate(`/service-orders?customerId=${appointment.customerId}&appointmentId=${appointment.id}`) },
                            { label: "Enviar WhatsApp", onClick: () => navigate(`/whatsapp?customerId=${appointment.customerId}`) },
                            { label: "Reagendar", onClick: () => setOpenCreate(true) },
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
