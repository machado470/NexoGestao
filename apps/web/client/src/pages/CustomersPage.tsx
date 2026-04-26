import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import EditCustomerModal from "@/components/EditCustomerModal";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { Button } from "@/components/design-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { AppDataTable, AppRowActionsDropdown } from "@/components/app-system";
import {
  AppFiltersBar,
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

type Customer = Record<string, any>;
type Appointment = Record<string, any>;
type ServiceOrder = Record<string, any>;
type Charge = Record<string, any>;

type Workspace = {
  customer?: Record<string, any>;
  appointments?: Appointment[];
  serviceOrders?: ServiceOrder[];
  charges?: Charge[];
  timeline?: Record<string, any>[];
};

type CustomerFilter =
  | "all"
  | "pending"
  | "open_os"
  | "no_recent_contact"
  | "risk";

function formatCurrency(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: unknown, fallback = "Não informado") {
  const date = toDate(value);
  return date ? date.toLocaleString("pt-BR") : fallback;
}

function customerStatus(input: {
  overdue: number;
  pending: number;
  hasOpenServiceOrder: boolean;
  daysWithoutContact: number;
}) {
  if (input.overdue > 0 || input.daysWithoutContact >= 30) return "Em risco";
  if (
    input.pending > 0 ||
    input.hasOpenServiceOrder ||
    input.daysWithoutContact >= 15
  )
    return "Com pendência";
  return "Saudável";
}

function normalizeWorkspace(input: unknown): Workspace {
  const raw = normalizeObjectPayload<any>(input) ?? {};
  return {
    customer: normalizeObjectPayload(raw.customer) ?? {},
    appointments: normalizeArrayPayload(
      raw.appointments ?? raw.customerAppointments
    ),
    serviceOrders: normalizeArrayPayload(raw.serviceOrders ?? raw.orders),
    charges: normalizeArrayPayload(raw.charges ?? raw.finance),
    timeline: normalizeArrayPayload(raw.timeline ?? raw.events),
  };
}

export default function CustomersPage() {
  const [location, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useOperationalMemoryState(
    "nexo.customers.search.v2",
    ""
  );
  const [activeFilter, setActiveFilter] =
    useOperationalMemoryState<CustomerFilter>(
      "nexo.customers.filter.v2",
      "all"
    );
  const [activeCustomerId, setActiveCustomerId] = useOperationalMemoryState<
    string | null
  >("nexo.customers.active-id.v2", null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(
    { page: 1, limit: 300 },
    { retry: false }
  );
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );

  const customers = useMemo(
    () => normalizeArrayPayload<Customer>(customersQuery.data),
    [customersQuery.data]
  );
  const appointments = useMemo(
    () => normalizeArrayPayload<Appointment>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const serviceOrders = useMemo(
    () => normalizeArrayPayload<ServiceOrder>(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );
  const charges = useMemo(
    () => normalizeArrayPayload<Charge>(chargesQuery.data),
    [chargesQuery.data]
  );

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: activeCustomerId ?? "" },
    { enabled: Boolean(activeCustomerId), retry: false }
  );

  const workspace = useMemo(
    () => normalizeWorkspace(workspaceQuery.data),
    [workspaceQuery.data]
  );

  const byCustomer = useMemo(() => {
    const map = new Map<
      string,
      {
        appointments: Appointment[];
        serviceOrders: ServiceOrder[];
        charges: Charge[];
        overdue: number;
        pending: number;
        pendingCents: number;
        lastInteractionAt: Date | null;
      }
    >();

    for (const customer of customers) {
      map.set(String(customer.id), {
        appointments: [],
        serviceOrders: [],
        charges: [],
        overdue: 0,
        pending: 0,
        pendingCents: 0,
        lastInteractionAt: toDate(customer.updatedAt ?? customer.createdAt),
      });
    }

    for (const item of appointments) {
      const customerId = String(item.customerId ?? "");
      if (!customerId || !map.has(customerId)) continue;
      const current = map.get(customerId)!;
      current.appointments.push(item);
      const touchDate = toDate(
        item.updatedAt ?? item.startsAt ?? item.createdAt
      );
      if (
        touchDate &&
        (!current.lastInteractionAt || touchDate > current.lastInteractionAt)
      ) {
        current.lastInteractionAt = touchDate;
      }
    }

    for (const item of serviceOrders) {
      const customerId = String(item.customerId ?? "");
      if (!customerId || !map.has(customerId)) continue;
      const current = map.get(customerId)!;
      current.serviceOrders.push(item);
      const touchDate = toDate(
        item.updatedAt ?? item.createdAt ?? item.scheduledFor
      );
      if (
        touchDate &&
        (!current.lastInteractionAt || touchDate > current.lastInteractionAt)
      ) {
        current.lastInteractionAt = touchDate;
      }
    }

    for (const item of charges) {
      const customerId = String(item.customerId ?? "");
      if (!customerId || !map.has(customerId)) continue;
      const current = map.get(customerId)!;
      current.charges.push(item);
      const status = String(item.status ?? "").toUpperCase();
      const cents = Number(item.amountCents ?? 0);
      if (status === "OVERDUE") {
        current.overdue += 1;
        current.pendingCents += cents;
      }
      if (status === "PENDING") {
        current.pending += 1;
        current.pendingCents += cents;
      }
      const touchDate = toDate(
        item.updatedAt ?? item.createdAt ?? item.dueDate
      );
      if (
        touchDate &&
        (!current.lastInteractionAt || touchDate > current.lastInteractionAt)
      ) {
        current.lastInteractionAt = touchDate;
      }
    }

    for (const value of map.values()) {
      value.appointments.sort(
        (a, b) =>
          new Date(String(a.startsAt ?? a.createdAt ?? 0)).getTime() -
          new Date(String(b.startsAt ?? b.createdAt ?? 0)).getTime()
      );
      value.serviceOrders.sort(
        (a, b) =>
          new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime() -
          new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime()
      );
    }

    return map;
  }, [appointments, charges, customers, serviceOrders]);

  const displayedCustomers = useMemo(() => {
    const now = new Date();
    const query = searchTerm.trim().toLowerCase();

    return customers.filter(customer => {
      const customerId = String(customer.id ?? "");
      const aggregate = byCustomer.get(customerId);
      if (!aggregate) return false;

      const lastInteraction = aggregate.lastInteractionAt;
      const daysWithoutContact = lastInteraction
        ? Math.floor(
            (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 999;
      const hasOpenServiceOrder = aggregate.serviceOrders.some(order => {
        const status = String(order.status ?? "").toUpperCase();
        return ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status);
      });
      const status = customerStatus({
        overdue: aggregate.overdue,
        pending: aggregate.pending,
        hasOpenServiceOrder,
        daysWithoutContact,
      });

      if (
        activeFilter === "pending" &&
        !(aggregate.pending > 0 || aggregate.overdue > 0)
      )
        return false;
      if (activeFilter === "open_os" && !hasOpenServiceOrder) return false;
      if (activeFilter === "no_recent_contact" && daysWithoutContact < 15)
        return false;
      if (activeFilter === "risk" && status !== "Em risco") return false;

      if (!query) return true;
      return [customer.name, customer.phone, customer.email]
        .map(value => String(value ?? "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [activeFilter, byCustomer, customers, searchTerm]);

  const isLoading = customersQuery.isLoading && customers.length === 0;
  const hasBlockingError =
    Boolean(customersQuery.error) && customers.length === 0;

  usePageDiagnostics({
    page: "customers",
    isLoading,
    hasError: hasBlockingError,
    isEmpty: !isLoading && !hasBlockingError && customers.length === 0,
    dataCount: customers.length,
  });

  useEffect(() => {
    const queryCustomerId = new URLSearchParams(
      location.split("?")[1] ?? ""
    ).get("customerId");
    if (queryCustomerId) {
      setActiveCustomerId(queryCustomerId);
      return;
    }
    if (!activeCustomerId && displayedCustomers.length > 0) {
      setActiveCustomerId(String(displayedCustomers[0].id));
    }
  }, [activeCustomerId, displayedCustomers, location, setActiveCustomerId]);

  const selectedCustomer = useMemo(
    () =>
      customers.find(item => String(item.id) === String(activeCustomerId)) ??
      null,
    [activeCustomerId, customers]
  );

  return (
    <PageWrapper
      title="Clientes"
      subtitle="Centro operacional de relacionamento e histórico por cliente."
    >
      <div className="flex h-[calc(100vh-5rem)] min-h-0 flex-col gap-3 overflow-hidden">
        <AppOperationalHeader
          title="Clientes"
          description="Central de relacionamento, execução e histórico operacional por cliente."
          primaryAction={
            <Button onClick={() => setCreateOpen(true)}>Novo cliente</Button>
          }
        >
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
            />
            <div className="flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-secondary)]">
              {customers.length} clientes reais
            </div>
          </div>
        </AppOperationalHeader>

        <AppFiltersBar className="shrink-0 gap-2 border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-3">
          {[
            { key: "all", label: "Todos" },
            { key: "pending", label: "Com pendência" },
            { key: "open_os", label: "Com O.S. aberta" },
            { key: "no_recent_contact", label: "Sem contato recente" },
            { key: "risk", label: "Em risco" },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                activeFilter === item.key
                  ? "bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                  : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
              }`}
              onClick={() => setActiveFilter(item.key as CustomerFilter)}
            >
              {item.label}
            </button>
          ))}
        </AppFiltersBar>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <AppSectionBlock
            title="Carteira operacional"
            subtitle="Visão densa com ações por cliente."
            className="flex h-full min-h-0 flex-col"
          >
            {isLoading ? (
              <AppPageLoadingState description="Carregando clientes..." />
            ) : hasBlockingError ? (
              <AppPageErrorState
                description={
                  customersQuery.error?.message ?? "Falha ao carregar clientes."
                }
                actionLabel="Tentar novamente"
                onAction={() => void customersQuery.refetch()}
              />
            ) : customers.length === 0 ? (
              <div className="space-y-3">
                <AppPageEmptyState
                  title="Nenhum cliente cadastrado"
                  description="Cadastre o primeiro cliente para iniciar o relacionamento operacional."
                />
                <div className="flex justify-center">
                  <Button onClick={() => setCreateOpen(true)}>
                    Criar primeiro cliente
                  </Button>
                </div>
              </div>
            ) : displayedCustomers.length === 0 ? (
              <AppPageEmptyState
                title="Busca sem resultado"
                description="Nenhum cliente corresponde aos filtros e termo pesquisado."
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="h-full min-h-0">
                  <AppDataTable>
                    <div className="max-h-[100%] overflow-y-auto">
                      <table className="w-full table-fixed text-sm">
                        <thead className="sticky top-0 z-10 bg-[var(--surface-elevated)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          <tr>
                            <th className="w-[20%] px-4 py-2.5">Nome</th>
                            <th className="w-[20%] px-4 py-2.5">Contato</th>
                            <th className="w-[18%] px-4 py-2.5">
                              Último serviço
                            </th>
                            <th className="w-[16%] px-4 py-2.5">
                              Próximo agendamento
                            </th>
                            <th className="w-[12%] px-4 py-2.5">
                              Saldo pendente
                            </th>
                            <th className="w-[8%] px-4 py-2.5">Status</th>
                            <th className="w-[96px] px-4 py-2.5 text-right">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedCustomers.map(customer => {
                            const customerId = String(customer.id ?? "");
                            const aggregate = byCustomer.get(customerId);
                            if (!aggregate) return null;

                            const now = new Date();
                            const lastInteraction = aggregate.lastInteractionAt;
                            const daysWithoutContact = lastInteraction
                              ? Math.floor(
                                  (now.getTime() - lastInteraction.getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )
                              : 999;
                            const hasOpenServiceOrder =
                              aggregate.serviceOrders.some(order => {
                                const status = String(
                                  order.status ?? ""
                                ).toUpperCase();
                                return [
                                  "OPEN",
                                  "ASSIGNED",
                                  "IN_PROGRESS",
                                ].includes(status);
                              });
                            const status = customerStatus({
                              overdue: aggregate.overdue,
                              pending: aggregate.pending,
                              hasOpenServiceOrder,
                              daysWithoutContact,
                            });

                            const lastService = aggregate.serviceOrders[0];
                            const nextAppointment = aggregate.appointments.find(
                              item => {
                                const startsAt = toDate(item.startsAt);
                                return (
                                  startsAt && startsAt.getTime() >= Date.now()
                                );
                              }
                            );

                            return (
                              <tr
                                key={customerId}
                                className={`border-t border-[var(--border-subtle)] hover:bg-[var(--surface-subtle)]/60 ${
                                  customerId === activeCustomerId
                                    ? "bg-[var(--accent-soft)]/40"
                                    : ""
                                }`}
                                onClick={() => setActiveCustomerId(customerId)}
                              >
                                <td className="px-4 py-3">
                                  <p className="truncate font-medium text-[var(--text-primary)]">
                                    {String(customer.name ?? "Sem nome")}
                                  </p>
                                  {(aggregate.overdue > 0 ||
                                    aggregate.pending > 0) && (
                                    <p className="mt-1 text-[11px] text-rose-500">
                                      {aggregate.overdue > 0
                                        ? `${aggregate.overdue} vencida(s)`
                                        : `${aggregate.pending} pendente(s)`}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                                  <p className="truncate">
                                    {String(customer.phone ?? "Sem telefone")}
                                  </p>
                                  <p className="truncate text-[var(--text-muted)]">
                                    {String(customer.email ?? "Sem e-mail")}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                                  {lastService
                                    ? `${String(lastService.title ?? "O.S.")} · ${String(lastService.status ?? "-")}`
                                    : "Nenhum serviço registrado"}
                                </td>
                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                                  {nextAppointment
                                    ? formatDateTime(nextAppointment.startsAt)
                                    : "Sem agendamento futuro"}
                                </td>
                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                                  {aggregate.pendingCents > 0
                                    ? formatCurrency(aggregate.pendingCents)
                                    : "Sem saldo pendente"}
                                </td>
                                <td className="px-4 py-3">
                                  <AppStatusBadge label={status} />
                                </td>
                                <td
                                  className="px-4 py-3 text-right"
                                  onClick={event => event.stopPropagation()}
                                >
                                  <AppRowActionsDropdown
                                    triggerLabel="Mais ações"
                                    contentClassName="min-w-[210px]"
                                    items={[
                                      {
                                        label: "Ver cliente",
                                        onSelect: () =>
                                          setActiveCustomerId(customerId),
                                      },
                                      {
                                        label: "Agendar",
                                        onSelect: () =>
                                          navigate(
                                            `/appointments?customerId=${customerId}`
                                          ),
                                      },
                                      {
                                        label: "Abrir O.S.",
                                        onSelect: () =>
                                          navigate(
                                            `/service-orders?customerId=${customerId}`
                                          ),
                                      },
                                      {
                                        label: "Cobrar",
                                        onSelect: () =>
                                          navigate(
                                            `/finances?customerId=${customerId}`
                                          ),
                                      },
                                      {
                                        label: "Enviar WhatsApp",
                                        onSelect: () =>
                                          navigate(
                                            `/whatsapp?customerId=${customerId}`
                                          ),
                                      },
                                      {
                                        label: "Editar",
                                        onSelect: () =>
                                          setEditingCustomerId(customerId),
                                      },
                                    ]}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </AppDataTable>
                </div>
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Detalhe do cliente"
            subtitle="Resumo, status e histórico operacional conectado ao backend."
            className="flex h-full min-h-0 flex-col"
          >
            {!activeCustomerId || !selectedCustomer ? (
              <AppPageEmptyState
                title="Selecione um cliente"
                description="Escolha um cliente na lista para abrir os detalhes operacionais."
              />
            ) : workspaceQuery.isLoading ? (
              <AppPageLoadingState description="Carregando detalhe do cliente..." />
            ) : workspaceQuery.error ? (
              <AppPageErrorState
                description={workspaceQuery.error.message}
                actionLabel="Tentar novamente"
                onAction={() => void workspaceQuery.refetch()}
              />
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/35 p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {String(selectedCustomer.name ?? "Cliente")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {String(selectedCustomer.phone ?? "Sem telefone")} ·{" "}
                    {String(selectedCustomer.email ?? "Sem e-mail")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Status:{" "}
                    {String(selectedCustomer.active ? "Ativo" : "Inativo")}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    Observações:{" "}
                    {String(selectedCustomer.notes ?? "Sem observações")}
                  </p>
                </article>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/appointments?customerId=${activeCustomerId}`)
                    }
                  >
                    Agendar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/service-orders?customerId=${activeCustomerId}`)
                    }
                  >
                    Abrir O.S.
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/finances?customerId=${activeCustomerId}`)
                    }
                  >
                    Cobrar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/whatsapp?customerId=${activeCustomerId}`)
                    }
                  >
                    Enviar WhatsApp
                  </Button>
                </div>

                <article className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Timeline recente
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-secondary)]">
                    {(workspace.timeline ?? [])
                      .slice(0, 6)
                      .map((event, index) => (
                        <li
                          key={`${String(event.id ?? "event")}-${index}`}
                          className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/30 p-2"
                        >
                          <p className="font-medium text-[var(--text-primary)]">
                            {String(
                              event.description ?? event.title ?? "Evento"
                            )}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {formatDateTime(
                              event.occurredAt ?? event.createdAt
                            )}
                          </p>
                        </li>
                      ))}
                    {(workspace.timeline ?? []).length === 0 ? (
                      <li>Sem eventos para este cliente.</li>
                    ) : null}
                  </ul>
                </article>

                <article className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Blocos conectados
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <li>
                      Agendamentos: {(workspace.appointments ?? []).length}
                    </li>
                    <li>
                      Ordens de serviço:{" "}
                      {(workspace.serviceOrders ?? []).length}
                    </li>
                    <li>
                      Financeiro (cobranças): {(workspace.charges ?? []).length}
                    </li>
                    <li>WhatsApp: disponível via navegação contextual.</li>
                  </ul>
                </article>
              </div>
            )}
          </AppSectionBlock>
        </div>

        <CreateCustomerModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={async created => {
            setCreateOpen(false);
            await customersQuery.refetch();
            await appointmentsQuery.refetch();
            await serviceOrdersQuery.refetch();
            await chargesQuery.refetch();
            if (created?.id) setActiveCustomerId(created.id);
          }}
        />

        <EditCustomerModal
          open={Boolean(editingCustomerId)}
          customerId={editingCustomerId}
          onClose={() => setEditingCustomerId(null)}
          onSaved={async saved => {
            setEditingCustomerId(null);
            await customersQuery.refetch();
            if (saved?.id) setActiveCustomerId(String(saved.id));
          }}
        />
      </div>
    </PageWrapper>
  );
}
