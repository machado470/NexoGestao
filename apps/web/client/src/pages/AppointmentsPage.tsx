import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { getAppointmentSeverity, getOperationalSeverityLabel } from "@/lib/operations/operational-intelligence";
import {
  AppDataTable,
  AppKpiRow,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppRowActions,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

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

  const scheduled = appointments.filter((item) => String(item?.status ?? "").toUpperCase() === "SCHEDULED").length;
  const confirmed = appointments.filter((item) => String(item?.status ?? "").toUpperCase() === "CONFIRMED").length;

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
          { label: "Total", value: String(appointments.length), trend: 0, context: "dados reais" },
          { label: "Agendados", value: String(scheduled), trend: 0, context: "aguardando confirmação" },
          { label: "Confirmados", value: String(confirmed), trend: 0, context: "prontos para execução" },
          { label: "Clientes", value: String(customers.length), trend: 0, context: "base disponível" },
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
                {appointments.map((appointment) => (
                  <tr key={String(appointment?.id)} className="border-t border-[var(--border-subtle)]">
                    <td className="p-3">{new Date(String(appointment?.startsAt)).toLocaleString("pt-BR")}</td>
                    <td>{String(appointment?.customer?.name ?? "Cliente")}</td>
                    <td><AppStatusBadge label={getOperationalSeverityLabel(getAppointmentSeverity(appointment))} /></td>
                    <td>{appointment?.endsAt ? new Date(String(appointment.endsAt)).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3">
                      <AppRowActions
                        actions={[
                          { label: "Criar O.S.", onClick: () => navigate(`/service-orders?customerId=${appointment.customerId}&appointmentId=${appointment.id}`) },
                          { label: "Enviar WhatsApp", onClick: () => navigate(`/whatsapp?customerId=${appointment.customerId}`) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
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
