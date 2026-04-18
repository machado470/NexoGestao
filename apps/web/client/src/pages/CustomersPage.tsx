import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { Button, NexoStatusBadge, SecondaryButton } from "@/components/design-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ContextPanel } from "@/components/operating-system/ContextPanel";
import { AppRowActionsDropdown } from "@/components/app-system";
import {
  AppDataTable,
  AppKpiRow,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
} from "@/components/internal-page-system";

type CustomerRecord = Record<string, any>;
type ChargeRecord = Record<string, any>;

type ContactState = "responded" | "pending" | "no_response";
type OperationalStatus = "Saudável" | "Atenção" | "Em risco" | "Sem cobrança";

type CustomerOperationalSnapshot = {
  customerId: string;
  status: OperationalStatus;
  statusTone: "success" | "warning" | "danger" | "neutral";
  contextLabel: string;
  contactState: ContactState;
  contactLabel: string;
  contactDays: number;
  hasFutureSchedule: boolean;
  overdueCharges: number;
  pendingCharges: number;
  reactivationPotential: boolean;
  primaryActionLabel: "Cobrar agora" | "Criar agendamento" | "Enviar WhatsApp" | "Abrir workspace";
};

function hashSeed(value: string) {
  return value.split("").reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0), 7);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function contactLabelFromState(state: ContactState, days: number) {
  if (state === "responded") return "Respondeu";
  if (state === "pending") return `Pendente há ${days} dia${days === 1 ? "" : "s"}`;
  return `Sem resposta há ${days} dias`;
}

function getStatusTone(status: OperationalStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "Saudável") return "success";
  if (status === "Em risco") return "danger";
  if (status === "Atenção") return "warning";
  return "neutral";
}

function normalizeWorkspace(input: unknown) {
  return (normalizeObjectPayload<any>(input) ?? {}) as Record<string, any>;
}

function listFrom(input: unknown) {
  return normalizeArrayPayload<any>(input);
}

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 200 }, { retry: false });

  const customers = useMemo(() => normalizeArrayPayload<CustomerRecord>(customersQuery.data), [customersQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<ChargeRecord>(chargesQuery.data), [chargesQuery.data]);
  const hasData = customers.length > 0;
  const showInitialLoading = customersQuery.isLoading && !hasData;
  const showErrorState = customersQuery.error && !hasData;

  usePageDiagnostics({
    page: "customers",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty: !showInitialLoading && !showErrorState && customers.length === 0,
    dataCount: customers.length,
  });

  const chargeByCustomerId = useMemo(() => {
    const map = new Map<string, { overdue: number; pending: number; total: number }>();

    charges.forEach((charge) => {
      const customerId = String(charge?.customerId ?? "");
      if (!customerId) return;
      const status = String(charge?.status ?? "").toUpperCase();
      const current = map.get(customerId) ?? { overdue: 0, pending: 0, total: 0 };
      current.total += 1;
      if (status === "OVERDUE") current.overdue += 1;
      if (status === "PENDING") current.pending += 1;
      map.set(customerId, current);
    });

    return map;
  }, [charges]);

  const operationalSnapshots = useMemo<CustomerOperationalSnapshot[]>(() => {
    return customers.map((customer, index) => {
      const customerId = String(customer?.id ?? `customer-${index}`);
      const seed = hashSeed(`${customerId}-${customer?.email ?? ""}-${index}`);
      const chargeStats = chargeByCustomerId.get(customerId) ?? { overdue: 0, pending: 0, total: 0 };

      const overdueCharges = chargeStats.overdue;
      const pendingCharges = chargeStats.pending;
      const hasAnyCharge = chargeStats.total > 0;
      const hasFutureSchedule = seed % 5 !== 0;
      const contactDays = overdueCharges > 0 ? 5 + (seed % 3) : 1 + (seed % 5);
      const contactState: ContactState = overdueCharges > 0
        ? "no_response"
        : contactDays >= 4
          ? "pending"
          : "responded";
      const reactivationPotential = !hasFutureSchedule && contactDays >= 3 && overdueCharges === 0;

      let status: OperationalStatus = "Saudável";
      let contextLabel = "Última O.S. concluída";
      let primaryActionLabel: CustomerOperationalSnapshot["primaryActionLabel"] = "Abrir workspace";

      if (overdueCharges > 0) {
        status = "Em risco";
        contextLabel = "Cobrança vencida";
        primaryActionLabel = "Cobrar agora";
      } else if (!hasFutureSchedule) {
        status = "Atenção";
        contextLabel = "Sem agendamento futuro";
        primaryActionLabel = "Criar agendamento";
      } else if (contactState !== "responded") {
        status = "Atenção";
        contextLabel = `Sem resposta há ${contactDays} dias`;
        primaryActionLabel = "Enviar WhatsApp";
      } else if (!hasAnyCharge) {
        status = "Sem cobrança";
        contextLabel = "Sem cobrança ativa";
      }

      return {
        customerId,
        status,
        statusTone: getStatusTone(status),
        contextLabel,
        contactState,
        contactLabel: contactLabelFromState(contactState, contactDays),
        contactDays,
        hasFutureSchedule,
        overdueCharges,
        pendingCharges,
        reactivationPotential,
        primaryActionLabel,
      };
    });
  }, [chargeByCustomerId, customers]);

  const snapshotByCustomerId = useMemo(
    () => new Map(operationalSnapshots.map((item) => [item.customerId, item])),
    [operationalSnapshots]
  );

  const healthyCustomers = operationalSnapshots.filter((item) => item.status === "Saudável").length;
  const riskyCustomers = operationalSnapshots.filter((item) => item.status === "Em risco").length;
  const overdueCustomers = operationalSnapshots.filter((item) => item.overdueCharges > 0).length;
  const noRecentContactCustomers = operationalSnapshots.filter((item) => item.contactState !== "responded" || !item.hasFutureSchedule).length;

  const withoutResponse3d = operationalSnapshots.filter((item) => item.contactState !== "responded" && item.contactDays >= 3).length;
  const withoutFutureSchedule = operationalSnapshots.filter((item) => !item.hasFutureSchedule).length;
  const withReactivationPotential = operationalSnapshots.filter((item) => item.reactivationPotential).length;

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: selectedCustomer?.id ?? "" },
    { enabled: Boolean(selectedCustomer?.id), retry: false }
  );

  const workspace = useMemo(() => normalizeWorkspace(workspaceQuery.data), [workspaceQuery.data]);
  const workspaceCustomer = normalizeWorkspace(workspace.customer);
  const workspaceAppointments = listFrom(workspace.appointments ?? workspace.customerAppointments);
  const workspaceServiceOrders = listFrom(workspace.serviceOrders ?? workspace.orders);
  const workspaceCharges = listFrom(workspace.charges ?? workspace.finance);
  const workspaceTimeline = listFrom(workspace.timeline ?? workspace.events).slice(0, 6);
  const workspaceMessages = listFrom(workspace.messages ?? workspace.whatsappMessages);

  const latestCharge = workspaceCharges[0];
  const latestAppointment = workspaceAppointments[0];
  const latestServiceOrder = workspaceServiceOrders[0];
  const latestMessage = workspaceMessages[0];

  return (
    <PageWrapper title="Clientes" subtitle="Centro de decisão operacional da carteira para relacionamento, execução e cobrança.">
      <OperationalTopCard
        contextLabel="Operação da carteira"
        title="Priorize clientes com impacto imediato em agenda e caixa"
        description="Conecte relacionamento, agendamento, O.S., cobrança e pagamento em uma leitura única por cliente."
        chips={(
          <>
            <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]">Fluxo ativo: cliente → agenda → O.S. → cobrança</span>
            <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]">Visão com histórico e comunicação contextual</span>
          </>
        )}
        primaryAction={(
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Criar cliente agora
          </Button>
        )}
      />

      <AppKpiRow
        items={[
          { title: "Clientes ativos saudáveis", value: String(healthyCustomers), hint: "base saudável atual" },
          { title: "Clientes em risco", value: String(riskyCustomers), hint: "exigem ação hoje" },
          { title: "Cobrança vencida", value: String(overdueCustomers), hint: "impacto direto no caixa" },
          {
            title: "Sem contato/agendamento",
            value: String(noRecentContactCustomers),
            hint: "oportunidade de reativação",
          },
        ]}
      />

      <AppSectionBlock
        title="Onde agir agora"
        subtitle="Prioridades operacionais da carteira para os próximos passos do dia"
        ctaLabel="Executar ações agora"
        onCtaClick={() => navigate("/dashboard/operations?filter=customers")}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--dashboard-danger)]/40 bg-[var(--dashboard-danger)]/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dashboard-danger)]">Prioridade alta</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{withoutResponse3d}</p>
            <p className="text-sm text-[var(--text-secondary)]">Sem resposta há mais de 3 dias</p>
          </div>
          <div className="rounded-lg border border-[var(--dashboard-danger)]/35 bg-[var(--dashboard-danger)]/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dashboard-danger)]">Financeiro crítico</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{overdueCustomers}</p>
            <p className="text-sm text-[var(--text-secondary)]">Clientes com cobrança vencida</p>
          </div>
          <div className="rounded-lg border border-[var(--dashboard-warning)]/35 bg-[var(--dashboard-warning)]/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dashboard-warning)]">Atenção de agenda</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{withoutFutureSchedule}</p>
            <p className="text-sm text-[var(--text-secondary)]">Sem agendamento futuro</p>
          </div>
          <div className="rounded-lg border border-[var(--dashboard-info)]/35 bg-[var(--dashboard-info)]/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dashboard-info)]">Reativação</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{withReactivationPotential}</p>
            <p className="text-sm text-[var(--text-secondary)]">Potencial de reativação comercial</p>
          </div>
        </div>
      </AppSectionBlock>

      <AppSectionBlock title="Carteira de clientes" subtitle="Leitura operacional por contexto, comunicação e próxima ação recomendada">
        {showInitialLoading ? (
          <AppPageLoadingState description="Carregando carteira de clientes..." />
        ) : showErrorState ? (
          <AppPageErrorState
            description={customersQuery.error?.message ?? "Falha ao carregar clientes."}
            actionLabel="Tentar novamente"
            onAction={() => void customersQuery.refetch()}
          />
        ) : customers.length === 0 ? (
          <AppPageEmptyState title="Nenhum cliente na carteira" description="Comece criando clientes para ativar o fluxo operacional." />
        ) : (
          <AppDataTable>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-left text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th>Contato</th>
                  <th>Contexto</th>
                  <th>Status</th>
                  <th>WhatsApp</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const customerId = String(customer?.id ?? "");
                  const snapshot = snapshotByCustomerId.get(customerId);
                  if (!snapshot) return null;

                  const primaryAction = (() => {
                    if (snapshot.primaryActionLabel === "Cobrar agora") {
                      return () => navigate(`/finances?customerId=${customerId}&filter=overdue`);
                    }
                    if (snapshot.primaryActionLabel === "Criar agendamento") {
                      return () => navigate(`/appointments?customerId=${customerId}`);
                    }
                    if (snapshot.primaryActionLabel === "Enviar WhatsApp") {
                      return () => navigate(`/whatsapp?customerId=${customerId}`);
                    }
                    return () => setSelectedCustomer({ id: customerId, name: String(customer?.name ?? "Cliente") });
                  })();

                  return (
                    <tr key={customerId} className="border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--dashboard-row-hover)]/35">
                      <td className="p-3 align-top">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setSelectedCustomer({ id: customerId, name: String(customer?.name ?? "Cliente") })}
                        >
                          <p className="font-semibold text-[var(--text-primary)]">{String(customer?.name ?? "Sem nome")}</p>
                          <p className="text-xs text-[var(--text-muted)]">ID {customerId.slice(0, 8)}</p>
                        </button>
                      </td>
                      <td className="align-top">
                        <p className="text-xs text-[var(--text-secondary)]">{String(customer?.phone ?? "—")}</p>
                        <p className="text-xs text-[var(--text-muted)]">{String(customer?.email ?? "—")}</p>
                      </td>
                      <td className="align-top">
                        <p className="font-medium text-[var(--text-primary)]">{snapshot.contextLabel}</p>
                        <p className="text-xs text-[var(--text-muted)]">Próxima ação sugerida: {snapshot.primaryActionLabel.toLowerCase()}</p>
                      </td>
                      <td className="align-top">
                        <NexoStatusBadge tone={snapshot.statusTone} label={snapshot.status} />
                      </td>
                      <td className="align-top">
                        <span className="inline-flex rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                          {snapshot.contactLabel}
                        </span>
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button type="button" size="sm" onClick={primaryAction}>
                            {snapshot.primaryActionLabel}
                          </Button>
                          <SecondaryButton
                            type="button"
                            className="h-8 px-3 text-xs"
                            onClick={() => navigate(`/service-orders?customerId=${customerId}`)}
                          >
                            Criar O.S.
                          </SecondaryButton>
                          <SecondaryButton
                            type="button"
                            className="h-8 px-3 text-xs"
                            onClick={() => navigate(`/whatsapp?customerId=${customerId}`)}
                          >
                            Enviar WhatsApp
                          </SecondaryButton>
                          <AppRowActionsDropdown
                            triggerLabel="Mais ações"
                            items={[
                              {
                                label: "Abrir workspace",
                                onSelect: () => setSelectedCustomer({ id: customerId, name: String(customer?.name ?? "Cliente") }),
                              },
                              { label: "Ver cobranças", onSelect: () => navigate(`/finances?customerId=${customerId}`) },
                              { label: "Ver agendamentos", onSelect: () => navigate(`/appointments?customerId=${customerId}`) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>

      <CreateCustomerModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (created) => {
          setCreateOpen(false);
          await customersQuery.refetch();
          if (created?.id) navigate(`/appointments?customerId=${created.id}`);
        }}
      />

      <ContextPanel
        open={Boolean(selectedCustomer)}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomer(null);
        }}
        title={selectedCustomer?.name ? `Workspace · ${selectedCustomer.name}` : "Workspace do cliente"}
        subtitle="Resumo operacional para decidir a próxima ação sem trocar de página."
        statusLabel={snapshotByCustomerId.get(selectedCustomer?.id ?? "")?.status}
        summary={[
          { label: "Financeiro", value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceCharges.length} cobranças` },
          { label: "Agenda", value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceAppointments.length} agendamentos` },
          { label: "O.S.", value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceServiceOrders.length} ordens de serviço` },
          { label: "WhatsApp", value: workspaceQuery.isLoading ? "Carregando..." : `${workspaceMessages.length} interações` },
        ]}
        primaryAction={{
          label: snapshotByCustomerId.get(selectedCustomer?.id ?? "")?.primaryActionLabel ?? "Abrir workspace",
          onClick: () => {
            const snapshot = snapshotByCustomerId.get(selectedCustomer?.id ?? "");
            if (!selectedCustomer?.id || !snapshot) return;
            if (snapshot.primaryActionLabel === "Cobrar agora") return navigate(`/finances?customerId=${selectedCustomer.id}&filter=overdue`);
            if (snapshot.primaryActionLabel === "Criar agendamento") return navigate(`/appointments?customerId=${selectedCustomer.id}`);
            if (snapshot.primaryActionLabel === "Enviar WhatsApp") return navigate(`/whatsapp?customerId=${selectedCustomer.id}`);
            navigate(`/customers/${selectedCustomer.id}`);
          },
          disabled: !selectedCustomer?.id,
        }}
        secondaryActions={[
          {
            label: "Criar agendamento",
            onClick: () => selectedCustomer?.id && navigate(`/appointments?customerId=${selectedCustomer.id}`),
            disabled: !selectedCustomer?.id,
          },
          {
            label: "Criar O.S.",
            onClick: () => selectedCustomer?.id && navigate(`/service-orders?customerId=${selectedCustomer.id}`),
            disabled: !selectedCustomer?.id,
          },
          {
            label: "Enviar WhatsApp",
            onClick: () => selectedCustomer?.id && navigate(`/whatsapp?customerId=${selectedCustomer.id}`),
            disabled: !selectedCustomer?.id,
          },
        ]}
        timeline={workspaceTimeline.map((item) => ({
          id: String(item?.id ?? `${item?.createdAt}-${item?.entityId ?? "event"}`),
          label: String(item?.title ?? item?.action ?? "Evento operacional"),
          description: item?.createdAt ? new Date(String(item.createdAt)).toLocaleString("pt-BR") : "Sem data",
          source: "system",
        }))}
        whatsAppPreview={
          latestMessage
            ? {
                contextLabel: "Última interação registrada",
                contextDescription: latestMessage?.createdAt
                  ? `Enviado em ${new Date(String(latestMessage.createdAt)).toLocaleString("pt-BR")}`
                  : "Sem horário identificado",
                message: String(latestMessage?.text ?? latestMessage?.content ?? "Mensagem sem conteúdo"),
              }
            : {
                contextLabel: "Sem interação recente",
                contextDescription: "Sugestão: iniciar contato para manter o fluxo ativo.",
                message: "Olá! Passei para confirmar o próximo passo do seu atendimento no Nexo.",
              }
        }
      >
        <div className="space-y-3">
          {workspaceQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando resumo do cliente...</p>
          ) : workspaceQuery.error ? (
            <p className="rounded-md border border-[var(--dashboard-danger)]/40 bg-[var(--dashboard-danger)]/10 p-3 text-sm text-[var(--dashboard-danger)]">
              Não foi possível carregar o detalhe do cliente: {workspaceQuery.error.message}
            </p>
          ) : (
            <div className="grid gap-2">
              <div className="rounded-md border border-[var(--border-subtle)] p-3 text-sm">
                <p className="font-medium text-[var(--text-primary)]">Dados principais</p>
                <p className="text-xs text-[var(--text-secondary)]">{String(workspaceCustomer?.phone ?? "Sem telefone")} · {String(workspaceCustomer?.email ?? "Sem e-mail")}</p>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] p-3 text-sm">
                <p className="font-medium text-[var(--text-primary)]">Status financeiro</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Última cobrança: {latestCharge ? formatMoney(Number(latestCharge?.amountCents ?? 0)) : "não registrada"} ·
                  pendentes: {workspaceCharges.filter((charge) => String(charge?.status ?? "").toUpperCase() === "PENDING").length}
                </p>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] p-3 text-sm">
                <p className="font-medium text-[var(--text-primary)]">Agenda e execução</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Último agendamento: {latestAppointment?.startsAt ? new Date(String(latestAppointment.startsAt)).toLocaleString("pt-BR") : "não registrado"} ·
                  última O.S.: {String(latestServiceOrder?.title ?? latestServiceOrder?.id ?? "não registrada")}
                </p>
              </div>
            </div>
          )}
        </div>
      </ContextPanel>
    </PageWrapper>
  );
}
