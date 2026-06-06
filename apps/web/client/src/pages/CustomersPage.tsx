import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import EditCustomerModal from "@/components/EditCustomerModal";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { Button } from "@/components/design-system";
import {
  AppDataTable,
  AppOperationalStatusBadge,
  AppPageShell,
  AppPriorityBadge,
  AppRowActionsDropdown,
  AppSectionCard,
  AppStatCard,
  AppStatusBadge,
  type AppOperationalStatus,
  type AppPriorityLevel,
} from "@/components/app-system";
import {
  AppFiltersBar,
  AppActionBar,
  AppContextWorkspace,
  AppEmbeddedTimeline,
  AppOperationalKpiGrid,
  AppOperationalStatusSummary,
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPagination,
  AppSectionBlock,
  AppNextBestActionBlock,
} from "@/components/internal-page-system";
import { cn } from "@/lib/utils";
import { operationalCopy } from "@/lib/operational-semantics";
import { aggregateOperationalHealth } from "@/lib/operational-health";
import { detectOperationalInterventions, getPrimaryOperationalIntervention, getOperationalInterventionImpact, getOperationalInterventionReason } from "@/lib/operational-interventions";
import {
  compareOperationalPriority,
  getDominantOperationalAction,
  getOperationalAttentionReason,
} from "@/lib/operational-prioritization";
import {
  getAttentionSummary,
  getVisibleAttentionItems,
  type OperationalAttentionItem,
} from "@/lib/operational-attention";

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

type CustomerProfile = {
  customer: Customer;
  customerId: string;
  appointments: Appointment[];
  serviceOrders: ServiceOrder[];
  charges: Charge[];
  overdue: number;
  pending: number;
  pendingCents: number;
  lastInteractionAt: Date | null;
  daysWithoutContact: number;
  hasOpenServiceOrder: boolean;
  status: "Em risco" | "Com pendência" | "Saudável";
  riskSignal: string;
  nextActionLabel: string;
  nextActionPath: string;
  lastService?: ServiceOrder;
  nextAppointment?: Appointment;
  contact: string;
  pendingChargeId: string | null;
};

type AttentionItem = {
  key: string;
  title: string;
  context: string;
  status: string;
  actionLabel: string;
  actionPath: string;
  customer?: Customer;
  chargeId?: string | null;
};

type CustomerOperationalEventType =
  | "CUSTOMER_APPOINTMENT_CREATED"
  | "CUSTOMER_SERVICE_ORDER_CREATED"
  | "CUSTOMER_WHATSAPP_MESSAGE_SENT"
  | "CUSTOMER_CHARGE_CONTEXT_UPDATED";

const pageSize = 8;
const openServiceOrderStatuses = ["OPEN", "ASSIGNED", "IN_PROGRESS"];
const pendingChargeStatuses = ["OVERDUE", "PENDING"];

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

function daysBetween(date: Date | null) {
  if (!date) return 999;
  const now = new Date();
  return Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  );
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
  ) {
    return "Com pendência";
  }
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

function getCustomerContact(customer: Customer) {
  const phone = String(customer.phone ?? "").trim();
  const email = String(customer.email ?? "").trim();
  if (phone && email) return `${phone} · ${email}`;
  return phone || email || "Sem contato cadastrado";
}

function isChargePending(charge: Charge) {
  return pendingChargeStatuses.includes(
    String(charge.status ?? "").toUpperCase()
  );
}

function isServiceOrderOpen(order: ServiceOrder) {
  return openServiceOrderStatuses.includes(
    String(order.status ?? "").toUpperCase()
  );
}

function resolveRiskSignal(
  profile: Pick<
    CustomerProfile,
    "overdue" | "pending" | "hasOpenServiceOrder" | "daysWithoutContact"
  >
) {
  if (profile.overdue > 0) return `${profile.overdue} cobrança(s) vencida(s)`;
  if (profile.daysWithoutContact >= 30)
    return `Sem contato há ${profile.daysWithoutContact} dias`;
  if (profile.hasOpenServiceOrder) return "O.S. aberta exige acompanhamento";
  if (profile.pending > 0) return `${profile.pending} cobrança(s) pendente(s)`;
  if (profile.daysWithoutContact >= 15)
    return `Follow-up pendente há ${profile.daysWithoutContact} dias`;
  return "Sem bloqueio operacional detectado";
}

function buildCustomerProfiles(input: {
  customers: Customer[];
  appointments: Appointment[];
  serviceOrders: ServiceOrder[];
  charges: Charge[];
}) {
  const map = new Map<
    string,
    Omit<
      CustomerProfile,
      | "daysWithoutContact"
      | "status"
      | "riskSignal"
      | "nextActionLabel"
      | "nextActionPath"
      | "lastService"
      | "nextAppointment"
      | "contact"
      | "pendingChargeId"
      | "hasOpenServiceOrder"
    >
  >();

  for (const customer of input.customers) {
    const customerId = String(customer.id ?? "");
    if (!customerId) continue;
    map.set(customerId, {
      customer,
      customerId,
      appointments: [],
      serviceOrders: [],
      charges: [],
      overdue: 0,
      pending: 0,
      pendingCents: 0,
      lastInteractionAt: toDate(customer.updatedAt ?? customer.createdAt),
    });
  }

  const updateInteraction = (
    current: { lastInteractionAt: Date | null },
    value: unknown
  ) => {
    const touchDate = toDate(value);
    if (
      touchDate &&
      (!current.lastInteractionAt || touchDate > current.lastInteractionAt)
    ) {
      current.lastInteractionAt = touchDate;
    }
  };

  for (const item of input.appointments) {
    const current = map.get(String(item.customerId ?? ""));
    if (!current) continue;
    current.appointments.push(item);
    updateInteraction(
      current,
      item.updatedAt ?? item.startsAt ?? item.createdAt
    );
  }

  for (const item of input.serviceOrders) {
    const current = map.get(String(item.customerId ?? ""));
    if (!current) continue;
    current.serviceOrders.push(item);
    updateInteraction(
      current,
      item.updatedAt ?? item.createdAt ?? item.scheduledFor
    );
  }

  for (const item of input.charges) {
    const current = map.get(String(item.customerId ?? ""));
    if (!current) continue;
    current.charges.push(item);
    const status = String(item.status ?? "").toUpperCase();
    const cents = Number(item.amountCents ?? item.amount ?? 0);
    if (status === "OVERDUE") {
      current.overdue += 1;
      current.pendingCents += cents;
    }
    if (status === "PENDING") {
      current.pending += 1;
      current.pendingCents += cents;
    }
    updateInteraction(
      current,
      item.updatedAt ?? item.createdAt ?? item.dueDate
    );
  }

  return Array.from(map.values()).map(profile => {
    const appointments = [...profile.appointments].sort(
      (a, b) =>
        new Date(String(a.startsAt ?? a.createdAt ?? 0)).getTime() -
        new Date(String(b.startsAt ?? b.createdAt ?? 0)).getTime()
    );
    const serviceOrders = [...profile.serviceOrders].sort(
      (a, b) =>
        new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime() -
        new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime()
    );
    const charges = [...profile.charges].sort(
      (a, b) =>
        new Date(String(a.dueDate ?? a.createdAt ?? 0)).getTime() -
        new Date(String(b.dueDate ?? b.createdAt ?? 0)).getTime()
    );
    const hasOpenServiceOrder = serviceOrders.some(isServiceOrderOpen);
    const daysWithoutContact = daysBetween(profile.lastInteractionAt);
    const status = customerStatus({
      overdue: profile.overdue,
      pending: profile.pending,
      hasOpenServiceOrder,
      daysWithoutContact,
    });
    const nextAppointment = appointments.find(item => {
      const startsAt = toDate(item.startsAt);
      return startsAt && startsAt.getTime() >= Date.now();
    });
    const pendingChargeId =
      String(charges.find(isChargePending)?.id ?? "").trim() || null;
    const nextActionLabel =
      profile.overdue > 0
        ? "Cobrar agora"
        : hasOpenServiceOrder
          ? "Acompanhar O.S."
          : nextAppointment
            ? "Confirmar agenda"
            : daysWithoutContact >= 15
              ? "Retomar contato"
              : "Criar próxima ação";
    const nextActionPath =
      profile.overdue > 0
        ? `/finances?customerId=${profile.customerId}`
        : hasOpenServiceOrder
          ? `/service-orders?customerId=${profile.customerId}`
          : nextAppointment
            ? `/appointments?customerId=${profile.customerId}`
            : `/whatsapp?customerId=${profile.customerId}`;

    return {
      ...profile,
      appointments,
      serviceOrders,
      charges,
      daysWithoutContact,
      hasOpenServiceOrder,
      status,
      riskSignal: resolveRiskSignal({
        overdue: profile.overdue,
        pending: profile.pending,
        hasOpenServiceOrder,
        daysWithoutContact,
      }),
      nextActionLabel,
      nextActionPath,
      lastService: serviceOrders[0],
      nextAppointment,
      contact: getCustomerContact(profile.customer),
      pendingChargeId,
    } satisfies CustomerProfile;
  });
}

function getCustomerOperationalStatus(profile: CustomerProfile): AppOperationalStatus {
  if (profile.overdue > 0 || profile.daysWithoutContact >= 30) return "RISCO";
  if (profile.pending > 0 || profile.hasOpenServiceOrder || profile.daysWithoutContact >= 15) return "ATENÇÃO";
  return "NORMAL";
}

function getCustomersOperationalStatus(profiles: CustomerProfile[]): AppOperationalStatus {
  const risk = profiles.filter(profile => getCustomerOperationalStatus(profile) === "RISCO").length;
  const attention = profiles.filter(profile => getCustomerOperationalStatus(profile) === "ATENÇÃO").length;
  if (risk >= 5) return "CRÍTICO";
  if (risk > 0) return "RISCO";
  if (attention > 0) return "ATENÇÃO";
  return "NORMAL";
}

function getCustomerPriority(profile: CustomerProfile): AppPriorityLevel {
  if (profile.overdue > 0 || profile.daysWithoutContact >= 30) return "P0";
  if (profile.hasOpenServiceOrder || profile.pending > 0) return "P1";
  if (profile.nextAppointment || profile.daysWithoutContact >= 15) return "P2";
  return "P3";
}

export default function CustomersPage() {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
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
  const [pendingEditCustomerId, setPendingEditCustomerId] = useState<
    string | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [createAppointmentOpen, setCreateAppointmentOpen] = useState(false);
  const [createServiceOrderOpen, setCreateServiceOrderOpen] = useState(false);
  const [showInlineCharges, setShowInlineCharges] = useState(false);
  const [whatsAppQuickMessage, setWhatsAppQuickMessage] = useState("");
  const timelineAnchorRef = useRef<HTMLElement | null>(null);

  const customersQuery = trpc.nexo.customers.list.useQuery(
    { page: 1, limit: 300 },
    { enabled: isAuthenticated, retry: false }
  );
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    { page: 1, limit: 500 },
    { enabled: isAuthenticated, retry: false }
  );
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 500 },
    { enabled: isAuthenticated, retry: false }
  );
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 500 },
    { enabled: isAuthenticated, retry: false }
  );
  const peopleQuery = trpc.people.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const trpcUtils = trpc.useUtils();
  const sendInlineWhatsApp = trpc.nexo.whatsapp.send.useMutation();
  const [isRefreshingWorkspace, setIsRefreshingWorkspace] = useState(false);

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

  const profiles = useMemo(
    () =>
      buildCustomerProfiles({
        customers,
        appointments,
        serviceOrders,
        charges,
      }),
    [appointments, charges, customers, serviceOrders]
  );
  const profileById = useMemo(
    () => new Map(profiles.map(profile => [profile.customerId, profile])),
    [profiles]
  );

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: activeCustomerId ?? "" },
    { enabled: isAuthenticated && Boolean(activeCustomerId), retry: false }
  );

  const workspace = useMemo(
    () => normalizeWorkspace(workspaceQuery.data),
    [workspaceQuery.data]
  );


  const primaryIntervention = useMemo(() => getPrimaryOperationalIntervention(detectOperationalInterventions({
    customers: workspace.customer ? [workspace.customer] : [],
    appointments: workspace.appointments,
    serviceOrders: workspace.serviceOrders,
    charges: workspace.charges,
    people: normalizeArrayPayload(peopleQuery.data),
  })), [workspace, peopleQuery.data]);
  const filteredProfiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return profiles.filter(profile => {
      if (
        activeFilter === "pending" &&
        !(profile.pending > 0 || profile.overdue > 0)
      ) {
        return false;
      }
      if (activeFilter === "open_os" && !profile.hasOpenServiceOrder) {
        return false;
      }
      if (
        activeFilter === "no_recent_contact" &&
        profile.daysWithoutContact < 15
      ) {
        return false;
      }
      if (activeFilter === "risk" && profile.status !== "Em risco") {
        return false;
      }

      if (!query) return true;
      return [
        profile.customer.name,
        profile.customer.phone,
        profile.customer.email,
      ]
        .map(value => String(value ?? "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [activeFilter, profiles, searchTerm]);

  const isLoading = customersQuery.isLoading && customers.length === 0;
  const hasBlockingError =
    Boolean(customersQuery.error) && customers.length === 0;
  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProfiles.slice(start, start + pageSize);
  }, [currentPage, filteredProfiles]);

  const rawAttentionItems = useMemo<OperationalAttentionItem[]>(() => {
    const items: OperationalAttentionItem[] = [];
    for (const profile of profiles) {
      if (profile.overdue > 0) {
        items.push({
          severity: "WARNING",
          domain: "finances",
          type: "overdue_charge",
          dueDate: profile.charges.find(charge => String(charge.status ?? "").toUpperCase() === "OVERDUE")?.dueDate,
          amountCents: profile.pendingCents,
          key: `${profile.customerId}-overdue`,
          title: String(profile.customer.name ?? "Cliente sem nome"),
          context: `${formatCurrency(profile.pendingCents)} em cobrança vencida ou pendente.`,
          status: "Urgente",
          actionLabel: "Cobrar",
          actionPath: `/finances?customerId=${profile.customerId}`,
          customer: profile.customer,
          chargeId: profile.pendingChargeId,
        });
        continue;
      }
      if (profile.hasOpenServiceOrder) {
        items.push({
          severity: "ATTENTION",
          domain: "service_orders",
          type: "overdue_service_order",
          isBlocked: true,
          key: `${profile.customerId}-open-os`,
          title: String(profile.customer.name ?? "Cliente sem nome"),
          context: profile.lastService
            ? `O.S. ${String(profile.lastService.title ?? profile.lastService.id ?? "aberta")} em ${String(profile.lastService.status ?? "andamento")}.`
            : "O.S. aberta exige acompanhamento.",
          status: "Atenção",
          actionLabel: "Ver O.S.",
          actionPath: `/service-orders?customerId=${profile.customerId}`,
        });
        continue;
      }
      if (profile.daysWithoutContact >= 15) {
        items.push({
          severity: profile.daysWithoutContact >= 30 ? "CRITICAL" : "ATTENTION",
          domain: "customers",
          type: "no_recent_contact",
          customerNoResponse: true,
          key: `${profile.customerId}-silent`,
          title: String(profile.customer.name ?? "Cliente sem nome"),
          context: `Sem interação registrada há ${profile.daysWithoutContact} dias.`,
          status: profile.daysWithoutContact >= 30 ? "Em risco" : "Monitorar",
          actionLabel: "Retomar contato",
          actionPath: `/whatsapp?customerId=${profile.customerId}`,
          customer: profile.customer,
        });
      }
    }
    return [...items]
      .sort((a, b) =>
        compareOperationalPriority(
          { severity: a.severity, dueDate: a.dueDate, amountCents: a.amountCents, isBlocked: a.isBlocked, customerNoResponse: a.customerNoResponse },
          { severity: b.severity, dueDate: b.dueDate, amountCents: b.amountCents, isBlocked: b.isBlocked, customerNoResponse: b.customerNoResponse }
        )
      )
      .map(item => ({
        ...item,
        context: `${String(item.context ?? "")} · ${getOperationalAttentionReason({ severity: item.severity, dueDate: item.dueDate, amountCents: item.amountCents, isBlocked: item.isBlocked, customerNoResponse: item.customerNoResponse })}`,
      }) as AttentionItem)
  }, [profiles]);

  const attentionItems = useMemo<AttentionItem[]>(
    () => getVisibleAttentionItems(rawAttentionItems, 4) as AttentionItem[],
    [rawAttentionItems]
  );

  const attentionSummary = useMemo(
    () => getAttentionSummary(rawAttentionItems),
    [rawAttentionItems]
  );

  const selectedProfile = activeCustomerId
    ? (profileById.get(String(activeCustomerId)) ?? null)
    : null;

  const selectedDominantAction = useMemo(() => {
    if (!selectedProfile) return null;
    const candidates = [
      ...(selectedProfile.overdue > 0 ? [{ severity: "WARNING", dueDate: selectedProfile.charges.find(c => String(c.status ?? "").toUpperCase() === "OVERDUE")?.dueDate, amountCents: selectedProfile.pendingCents }] : []),
      ...(selectedProfile.nextAppointment ? [{ severity: "ATTENTION", scheduledAt: selectedProfile.nextAppointment.startsAt ?? selectedProfile.nextAppointment.scheduledAt }] : []),
      ...(selectedProfile.hasOpenServiceOrder ? [{ severity: "ATTENTION", isBlocked: true }] : []),
      ...(selectedProfile.daysWithoutContact >= 15 ? [{ severity: selectedProfile.daysWithoutContact >= 30 ? "CRITICAL" : "ATTENTION", customerNoResponse: true }] : []),
    ];
    return getDominantOperationalAction(candidates);
  }, [selectedProfile]);
  const selectedCustomer = selectedProfile?.customer ?? null;
  const people = useMemo(
    () =>
      normalizeArrayPayload<any>(peopleQuery.data).map(person => ({
        id: String(person.id ?? ""),
        name: String(person.name ?? "Colaborador"),
      })),
    [peopleQuery.data]
  );

  const workspaceCharges = (workspace.charges ?? selectedProfile?.charges ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(String(a.dueDate ?? a.createdAt ?? 0)).getTime() -
        new Date(String(b.dueDate ?? b.createdAt ?? 0)).getTime()
    );
  const workspaceServiceOrders =
    workspace.serviceOrders ?? selectedProfile?.serviceOrders ?? [];
  const workspaceAppointments =
    workspace.appointments ?? selectedProfile?.appointments ?? [];
  const customerOperationalHealth = useMemo(
    () =>
      aggregateOperationalHealth({
        customers: selectedCustomer ? [selectedCustomer] : [],
        appointments: workspaceAppointments,
        serviceOrders: workspaceServiceOrders,
        charges: workspaceCharges,
        timelineEvents: workspace.timeline ?? [],
      }),
    [selectedCustomer, workspaceAppointments, workspaceServiceOrders, workspaceCharges, workspace.timeline]
  );

  const workspacePendingCents = workspaceCharges.reduce((total, charge) => {
    if (!isChargePending(charge)) return total;
    return total + Number(charge.amountCents ?? charge.amount ?? 0);
  }, 0);
  const workspaceOverdueCharges = workspaceCharges.filter(
    charge => String(charge.status ?? "").toUpperCase() === "OVERDUE"
  );
  const workspaceLastPayment = workspaceCharges
    .filter(charge =>
      ["PAID", "SETTLED"].includes(String(charge.status ?? "").toUpperCase())
    )
    .sort(
      (a, b) =>
        new Date(String(b.paidAt ?? b.updatedAt ?? b.createdAt ?? 0)).getTime() -
        new Date(String(a.paidAt ?? a.updatedAt ?? a.createdAt ?? 0)).getTime()
    )[0];
  const workspaceNextAppointment = workspaceAppointments
    .filter(item => {
      const startsAt = toDate(item.startsAt ?? item.scheduledAt);
      return startsAt && startsAt.getTime() >= Date.now();
    })
    .sort(
      (a, b) =>
        new Date(String(a.startsAt ?? a.scheduledAt ?? a.createdAt ?? 0)).getTime() -
        new Date(String(b.startsAt ?? b.scheduledAt ?? b.createdAt ?? 0)).getTime()
    )[0];
  const workspaceOpenServiceOrder = workspaceServiceOrders
    .filter(isServiceOrderOpen)
    .sort(
      (a, b) =>
        new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime() -
        new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime()
    )[0];
  const workspaceLastCompletedServiceOrder = workspaceServiceOrders
    .filter(order => String(order.status ?? "").toUpperCase() === "COMPLETED")
    .sort(
      (a, b) =>
        new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime() -
        new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime()
    )[0];

  async function refreshCustomerWorkspace(
    customerId: string,
    options?: { includeTimeline?: boolean }
  ) {
    if (!customerId) return;
    setIsRefreshingWorkspace(true);
    try {
      const includeTimeline = options?.includeTimeline ?? false;
      const operations: Promise<unknown>[] = [
        trpcUtils.nexo.customers.list.invalidate(),
        trpcUtils.nexo.customers.workspace.invalidate({ id: customerId }),
        trpcUtils.nexo.appointments.list.invalidate(),
        trpcUtils.nexo.serviceOrders.list.invalidate(),
        trpcUtils.finance.charges.list.invalidate(),
      ];
      if (includeTimeline) {
        operations.push(trpcUtils.nexo.customers.workspace.refetch({ id: customerId }));
      }
      await Promise.all(operations);
    } finally {
      setIsRefreshingWorkspace(false);
    }
  }

  async function propagateCustomerOperationalChange(
    customerId: string,
    eventType: CustomerOperationalEventType,
    options?: { includeTimeline?: boolean }
  ) {
    if (!customerId) return;
    setIsRefreshingWorkspace(true);
    try {
      const includeTimeline = options?.includeTimeline ?? false;
      const dashboardUtils = (trpcUtils as any).dashboard;
      const whatsappUtils = (trpcUtils as any).whatsapp;
      const peopleUtils = (trpcUtils as any).people;
      const nexoUtils = (trpcUtils as any).nexo;
      const operations: Promise<unknown>[] = [];
      const safePush = (candidate: unknown) => {
        if (
          candidate &&
          typeof (candidate as Promise<unknown>).then === "function"
        ) {
          operations.push(candidate as Promise<unknown>);
        }
      };

      safePush(trpcUtils.nexo.customers.list.invalidate());
      safePush(trpcUtils.nexo.customers.workspace.invalidate({ id: customerId }));

      switch (eventType) {
        case "CUSTOMER_APPOINTMENT_CREATED":
          safePush(trpcUtils.nexo.appointments.list.invalidate());
          safePush(dashboardUtils?.kpis?.invalidate?.());
          safePush(dashboardUtils?.alerts?.invalidate?.());
          safePush(nexoUtils?.timeline?.customer?.invalidate?.({ customerId }));
          safePush(nexoUtils?.timeline?.org?.invalidate?.());
          break;
        case "CUSTOMER_SERVICE_ORDER_CREATED":
          safePush(trpcUtils.nexo.serviceOrders.list.invalidate());
          safePush(trpcUtils.nexo.appointments.list.invalidate());
          safePush(dashboardUtils?.kpis?.invalidate?.());
          safePush(dashboardUtils?.alerts?.invalidate?.());
          safePush(nexoUtils?.timeline?.customer?.invalidate?.({ customerId }));
          safePush(nexoUtils?.timeline?.org?.invalidate?.());
          safePush(peopleUtils?.stats?.invalidate?.());
          safePush(peopleUtils?.workload?.invalidate?.());
          break;
        case "CUSTOMER_WHATSAPP_MESSAGE_SENT":
          safePush(whatsappUtils?.conversations?.invalidate?.());
          safePush(whatsappUtils?.messages?.invalidate?.());
          safePush(whatsappUtils?.context?.invalidate?.({ customerId }));
          safePush(nexoUtils?.timeline?.customer?.invalidate?.({ customerId }));
          safePush(nexoUtils?.timeline?.org?.invalidate?.());
          safePush(dashboardUtils?.alerts?.invalidate?.());
          safePush(nexoUtils?.nextBestAction?.invalidate?.({ customerId }));
          break;
        case "CUSTOMER_CHARGE_CONTEXT_UPDATED":
          safePush(trpcUtils.finance.charges.list.invalidate());
          break;
      }

      if (includeTimeline) {
        safePush(trpcUtils.nexo.customers.workspace.refetch({ id: customerId }));
      }
      await Promise.all(operations);
    } finally {
      setIsRefreshingWorkspace(false);
    }
  }

  function openCustomerWhatsApp(customer: Customer, chargeId?: string | null) {
    const customerId = String(customer?.id ?? "");
    if (!customerId) {
      return toast.error("Cliente sem identificador para abrir WhatsApp.");
    }
    if (!String(customer?.phone ?? "").trim()) {
      return toast.error("Cliente sem telefone/WhatsApp cadastrado.");
    }
    navigate(
      `/whatsapp?customerId=${customerId}${chargeId ? `&chargeId=${chargeId}` : ""}`
    );
  }

  function runAttentionAction(item: AttentionItem) {
    if (item.actionLabel.includes("Cobrar") && item.customer) {
      openCustomerWhatsApp(item.customer, item.chargeId);
      return;
    }
    if (item.actionLabel.includes("contato") && item.customer) {
      openCustomerWhatsApp(item.customer, item.chargeId);
      return;
    }
    navigate(item.actionPath);
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredProfiles.length / pageSize)
    );
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, filteredProfiles.length]);

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
    if (!activeCustomerId && filteredProfiles.length > 0) {
      setActiveCustomerId(filteredProfiles[0].customerId);
    }
  }, [activeCustomerId, filteredProfiles, location, setActiveCustomerId]);

  const customersOperationalStatus = getCustomersOperationalStatus(profiles);

  return (
    <AppPageShell className="space-y-4">
        <AppOperationalHeader
          title="Clientes"
          description="Centro de contexto operacional, financeiro e comunicação de cada relacionamento ativo."
          density="compact"
          primaryAction={
            <Button onClick={() => setCreateOpen(true)}>Novo cliente</Button>
          }
          contextChips={
            <>
              <AppOperationalStatusBadge status={customersOperationalStatus} />
              <AppStatusBadge label={`${customers.length} clientes na carteira`} tone="neutral" />
              <AppStatusBadge
                label={`${profiles.filter(profile => profile.status === "Em risco").length} em risco`}
                tone="warning"
              />
              <AppStatusBadge
                label={`${profiles.filter(profile => profile.hasOpenServiceOrder).length} com O.S. aberta`}
                tone="info"
              />
            </>
          }
        >
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-3">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--dashboard-success)]" />
              Cada cliente mostra contexto e próxima ação.
            </span>
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-[var(--dashboard-warning)]" />
              Prioridade combina financeiro, O.S. e contato.
            </span>
            <span className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-[var(--dashboard-info)]" />
              Ações reais vêm antes da navegação.
            </span>
          </div>
        </AppOperationalHeader>

        <AppSectionCard className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="nexo-overline">Próxima decisão da carteira</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                {attentionItems[0] ? attentionItems[0].title : "Carteira sem bloqueio imediato"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {attentionItems[0]
                  ? attentionItems[0].context
                  : "Os dados retornados não apontam dívida vencida, O.S. aberta ou silêncio prolongado."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AppStatusBadge label="Financeiro" tone="info" />
                <AppStatusBadge label="Execução" tone="accent" />
                <AppStatusBadge label="Comunicação" tone="neutral" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AppOperationalStatusBadge status={customersOperationalStatus} />
              {attentionItems[0] ? <AppPriorityBadge priority="P0" /> : null}
              {attentionItems[0] ? (
                <Button size="sm" onClick={() => runAttentionAction(attentionItems[0])}>
                  {attentionItems[0].actionLabel}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  Novo cliente
                </Button>
              )}
            </div>
          </div>
        </AppSectionCard>

        <AppSectionBlock
          title="Resumo do cliente"
          subtitle="Memória operacional consolidada da carteira."
          compact
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <AppStatCard
              label="Saldo em atenção"
              value={formatCurrency(
                profiles.reduce(
                  (total, profile) => total + profile.pendingCents,
                  0
                )
              )}
              helper="Soma segura das cobranças pendentes/vencidas retornadas."
              delta={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveFilter("pending")}
                >
                  Filtrar pendências
                </Button>
              }
            />
            <AppStatCard
              label="Risco de relacionamento"
              value={
                profiles.filter(profile => profile.status === "Em risco").length
              }
              helper="Clientes com dívida vencida ou longo período sem contato."
              delta={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveFilter("risk")}
                >
                  Ver risco
                </Button>
              }
            />
            <AppStatCard
              label="Execução aberta"
              value={
                profiles.filter(profile => profile.hasOpenServiceOrder).length
              }
              helper="Clientes com O.S. aberta que ainda pede acompanhamento."
              delta={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveFilter("open_os")}
                >
                  Ver O.S.
                </Button>
              }
            />
          </div>
        </AppSectionBlock>


        <AppNextBestActionBlock
          title="Intervenção operacional recomendada"
          subtitle="Sugestão contextual para destravar fluxo sem execução automática."
          compact
        >
          {primaryIntervention ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{primaryIntervention.label}</p>
              <p className="text-xs text-[var(--text-secondary)]">Motivo: {getOperationalInterventionReason(primaryIntervention)}</p>
              <p className="text-xs text-[var(--text-secondary)]">Impacto: {getOperationalInterventionImpact(primaryIntervention)}</p>
              <p className="text-xs text-[var(--text-secondary)]">Responsável sugerido: {primaryIntervention.recommendedOwner}</p>
            </div>
          ) : <AppPageEmptyState title="Sem intervenção dominante" description="Contexto insuficiente para recomendar intervenção segura." />}
        </AppNextBestActionBlock>
        <AppSectionBlock
          title={operationalCopy.immediateAttention}
          subtitle={`Clientes que podem travar caixa, execução ou resposta no turno. ${attentionSummary.hidden > 0 ? attentionSummary.hiddenMessage : ""}`}
          compact
        >
          {isLoading ? (
            <AppPageLoadingState description="Carregando sinais dos clientes..." />
          ) : attentionItems.length === 0 ? (
            <AppPageEmptyState
              title="Nenhum cliente em atenção imediata"
              description="A carteira não retornou dívida, O.S. aberta ou longo silêncio nos dados disponíveis."
            />
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {attentionItems.map(item => (
                <article
                  key={item.key}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AppStatusBadge label={item.status} />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                        {item.context}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => runAttentionAction(item)}>
                      {item.actionLabel}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AppSectionBlock>

        <AppFiltersBar className="shrink-0 gap-3 border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-3">
          <div className="min-w-[220px] flex-1">
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                className={cn(
                  "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                  activeFilter === item.key
                    ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                onClick={() => setActiveFilter(item.key as CustomerFilter)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
            {filteredProfiles.length} resultado(s)
          </span>
        </AppFiltersBar>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <AppSectionBlock
            title="Carteira operacional"
            subtitle="Lista priorizada por contexto, pendência e próxima ação possível."
            className="xl:col-span-7"
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
                  description="Cadastre o primeiro cliente para iniciar a memória operacional de relacionamento."
                />
                <div className="flex justify-center">
                  <Button onClick={() => setCreateOpen(true)}>
                    Criar primeiro cliente
                  </Button>
                </div>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <AppPageEmptyState
                title="Busca sem resultado"
                description="Nenhum cliente corresponde aos filtros ativos e termo pesquisado."
              />
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <AppDataTable className="min-w-[860px]">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Saúde e prioridade</th>
                        <th>Contexto operacional</th>
                        <th>Financeiro</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProfiles.map(profile => (
                        <tr
                          key={profile.customerId}
                          className={cn(
                            "cursor-pointer align-top transition-colors hover:bg-[var(--surface-subtle)]/60",
                            profile.customerId === activeCustomerId
                              ? "bg-[var(--accent-soft)]/35"
                              : undefined
                          )}
                          onClick={() => setActiveCustomerId(profile.customerId)}
                        >
                          <td>
                            <div className="min-w-[220px] space-y-1">
                              <p className="font-semibold text-[var(--text-primary)]">
                                {String(profile.customer.name ?? "Sem nome")}
                              </p>
                              <p className="max-w-[280px] truncate text-xs text-[var(--text-secondary)]">
                                {profile.contact}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                Última interação: {formatDateTime(profile.lastInteractionAt)}
                              </p>
                            </div>
                          </td>
                          <td>
                            <div className="flex min-w-[170px] flex-col items-start gap-2">
                              <AppOperationalStatusBadge
                                status={getCustomerOperationalStatus(profile)}
                                label={profile.status}
                              />
                              <AppPriorityBadge
                                priority={getCustomerPriority(profile)}
                                label={profile.nextActionLabel}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="min-w-[250px] space-y-1 text-xs text-[var(--text-secondary)]">
                              <p>{profile.riskSignal}</p>
                              <p>
                                Última O.S.: {profile.lastService
                                  ? `${String(profile.lastService.title ?? "O.S.")} · ${String(profile.lastService.status ?? "-")}`
                                  : "Sem O.S. registrada"}
                              </p>
                              <p>
                                Próximo agendamento: {profile.nextAppointment
                                  ? formatDateTime(profile.nextAppointment.startsAt)
                                  : "Sem agenda futura"}
                              </p>
                            </div>
                          </td>
                          <td>
                            <div className="min-w-[150px] space-y-2">
                              <p className="font-medium text-[var(--text-primary)]">
                                {formatCurrency(profile.pendingCents)}
                              </p>
                              {profile.pendingCents === 0 ? (
                                <AppStatusBadge
                                  label="Sem pendência retornada"
                                  tone="neutral"
                                />
                              ) : (
                                <AppStatusBadge label="Saldo em atenção" tone="warning" />
                              )}
                            </div>
                          </td>
                          <td onClick={event => event.stopPropagation()}>
                            <div className="flex min-w-[150px] items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (profile.nextActionLabel.includes("Cobrar")) {
                                    openCustomerWhatsApp(
                                      profile.customer,
                                      profile.pendingChargeId
                                    );
                                    return;
                                  }
                                  navigate(profile.nextActionPath);
                                }}
                              >
                                {profile.nextActionLabel}
                              </Button>
                              <AppRowActionsDropdown
                                triggerLabel="Mais ações"
                                contentClassName="min-w-[220px]"
                                items={[
                                  {
                                    label: "Abrir cliente",
                                    tone: "primary",
                                    onSelect: () =>
                                      setActiveCustomerId(profile.customerId),
                                  },
                                  {
                                    label: "Agendar",
                                    onSelect: () =>
                                      navigate(
                                        `/appointments?customerId=${profile.customerId}`
                                      ),
                                  },
                                  {
                                    label: "Nova O.S.",
                                    onSelect: () =>
                                      navigate(
                                        `/service-orders?customerId=${profile.customerId}`
                                      ),
                                  },
                                  {
                                    label: "Cobrar",
                                    onSelect: () =>
                                      navigate(
                                        `/finances?customerId=${profile.customerId}`
                                      ),
                                  },
                                  {
                                    label: "WhatsApp",
                                    onSelect: () =>
                                      openCustomerWhatsApp(
                                        profile.customer,
                                        profile.pendingChargeId
                                      ),
                                  },
                                  {
                                    type: "separator",
                                    label: "Cadastro",
                                  },
                                  {
                                    label:
                                      pendingEditCustomerId === profile.customerId
                                        ? "Editando..."
                                        : "Editar dados",
                                    onSelect: () => {
                                      setPendingEditCustomerId(profile.customerId);
                                      setEditingCustomerId(profile.customerId);
                                      toast.success("Editor de cliente aberto.");
                                    },
                                    disabled:
                                      pendingEditCustomerId === profile.customerId,
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AppDataTable>
                </div>
                <AppPagination
                  currentPage={currentPage}
                  totalItems={filteredProfiles.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </AppSectionBlock>

          <AppContextWorkspace
            title="Detalhe do cliente"
            subtitle="Resumo, ações principais, financeiro, O.S., agenda, comunicação e histórico disponível."
            className="xl:col-span-5"
          >
            {!activeCustomerId || !selectedCustomer || !selectedProfile ? (
              <AppPageEmptyState
                title="Selecione um cliente"
                description="Escolha um cliente na carteira para abrir o centro contextual."
              />
            ) : workspaceQuery.isLoading && !workspaceQuery.data ? (
              <AppPageLoadingState description="Carregando detalhe do cliente..." />
            ) : workspaceQuery.error ? (
              <AppPageErrorState
                description={workspaceQuery.error.message}
                actionLabel="Tentar novamente"
                onAction={() => void workspaceQuery.refetch()}
              />
            ) : (
              <div className="space-y-3">
                <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/35 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {String(selectedCustomer.name ?? "Cliente")}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {selectedProfile.contact}
                      </p>
                    </div>
                    <AppStatusBadge label={selectedProfile.status} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                    {selectedProfile.riskSignal}. Próxima ação sugerida: {selectedDominantAction?.label ?? selectedProfile.nextActionLabel}.
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    Saúde operacional: <span className="font-medium">{customerOperationalHealth.label}</span> · {customerOperationalHealth.summary}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Foco: {customerOperationalHealth.recommendedFocus}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Observações:{" "}
                    {String(
                      selectedCustomer.notes ?? "Sem observações registradas"
                    )}
                  </p>
                </article>

                <AppActionBar className="gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-2">
                  <Button size="sm" variant="outline" onClick={() => setCreateServiceOrderOpen(true)}>
                    <Wrench className="mr-1.5 h-3.5 w-3.5" />
                    Abrir O.S.
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCreateAppointmentOpen(true)}>
                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                    Agendar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowInlineCharges(value => !value)}>
                    <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                    {showInlineCharges ? "Ocultar cobranças" : "Cobrar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!String(selectedCustomer.phone ?? "").trim()}
                    title={!String(selectedCustomer.phone ?? "").trim() ? "Cliente sem telefone/WhatsApp cadastrado." : undefined}
                    onClick={() =>
                      openCustomerWhatsApp(
                        selectedCustomer,
                        String(workspaceCharges.find(isChargePending)?.id ?? "") || null
                      )
                    }
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                    WhatsApp rápido
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/finances?customerId=${activeCustomerId}`)}>
                    Ver financeiro
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/governance?customerId=${activeCustomerId}&source=customers`)}>
                    <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                    Ver risco
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(workspace.timeline ?? []).length === 0}
                    title={(workspace.timeline ?? []).length === 0 ? "Sem eventos de timeline disponíveis para este cliente." : undefined}
                    onClick={() =>
                      timelineAnchorRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  >
                    Ver timeline
                  </Button>
                </AppActionBar>
                {isRefreshingWorkspace ? (
                  <p className="text-xs text-[var(--text-muted)]">Atualizando dados do cliente...</p>
                ) : null}
                {showInlineCharges ? (
                  <article className="rounded-xl border border-[var(--border-subtle)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Cobranças pendentes/vencidas
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (activeCustomerId) {
                            void propagateCustomerOperationalChange(
                              activeCustomerId,
                              "CUSTOMER_CHARGE_CONTEXT_UPDATED"
                            );
                          }
                          navigate(`/finances?customerId=${activeCustomerId}`);
                        }}
                      >
                        Abrir financeiro
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {workspaceCharges.filter(isChargePending).slice(0, 5).map((charge, index) => (
                        <div key={`${String(charge.id ?? "charge")}-${index}`} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/30 p-2">
                          <p className="text-xs font-medium text-[var(--text-primary)]">
                            {formatCurrency(Number(charge.amountCents ?? charge.amount ?? 0))} · {String(charge.status ?? "PENDING")}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            Vencimento: {formatDateTime(charge.dueDate, "Não informado")}
                          </p>
                        </div>
                      ))}
                      {workspaceCharges.filter(isChargePending).length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">Nenhuma cobrança pendente/vencida retornada para este cliente.</p>
                      ) : null}
                    </div>
                  </article>
                ) : null}
                <article className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">WhatsApp inline</p>
                  <textarea
                    value={whatsAppQuickMessage}
                    onChange={event => setWhatsAppQuickMessage(event.target.value)}
                    placeholder="Mensagem rápida para este cliente"
                    className="mt-2 min-h-[70px] w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !String(selectedCustomer.phone ?? "").trim() ||
                        whatsAppQuickMessage.trim().length === 0 ||
                        sendInlineWhatsApp.isPending
                      }
                      title={!String(selectedCustomer.phone ?? "").trim() ? "Cliente sem telefone/WhatsApp cadastrado." : undefined}
                      onClick={async () => {
                        if (!activeCustomerId || !whatsAppQuickMessage.trim()) return;
                        try {
                          const content = whatsAppQuickMessage.trim();
                          await sendInlineWhatsApp.mutateAsync({
                            customerId: activeCustomerId,
                            content,
                            entityType: "CUSTOMER",
                            entityId: activeCustomerId,
                            messageType: "MANUAL",
                          });
                          setWhatsAppQuickMessage("");
                          toast.success("Mensagem enviada.");
                          await propagateCustomerOperationalChange(
                            activeCustomerId,
                            "CUSTOMER_WHATSAPP_MESSAGE_SENT",
                            {
                            includeTimeline: true,
                            }
                          );
                        } catch (error) {
                          toast.error("Não foi possível enviar a mensagem. Tente novamente.");
                        }
                      }}
                    >
                      {sendInlineWhatsApp.isPending ? "Enviando..." : "Enviar inline"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openCustomerWhatsApp(selectedCustomer, String(workspaceCharges.find(isChargePending)?.id ?? "") || null)}>
                      Abrir WhatsApp completo
                    </Button>
                  </div>
                </article>

                <AppOperationalKpiGrid className="xl:grid-cols-2">
                  <AppStatCard label="Saldo em aberto" value={formatCurrency(workspacePendingCents || selectedProfile.pendingCents)} helper="Somatório real de cobranças pendentes/vencidas." />
                  <AppStatCard label="Cobranças vencidas" value={workspaceOverdueCharges.length} helper={workspaceOverdueCharges.length > 0 ? "Priorizar ação de cobrança." : "Sem cobrança vencida retornada."} />
                  <AppStatCard label="Próximo agendamento" value={workspaceNextAppointment ? formatDateTime(workspaceNextAppointment.startsAt ?? workspaceNextAppointment.scheduledAt) : "Sem agenda futura"} helper={workspaceNextAppointment ? String(workspaceNextAppointment.status ?? "Status não informado") : "Nenhum agendamento futuro disponível."} />
                  <AppStatCard label="Comunicação" value={String(selectedCustomer.phone ?? "Sem telefone")} helper={selectedProfile.lastInteractionAt ? `Última interação em ${formatDateTime(selectedProfile.lastInteractionAt)}` : "Sem interação registrada."} />
                </AppOperationalKpiGrid>

                <AppOperationalStatusSummary
                  items={[
                    {
                      label: "O.S. aberta mais relevante",
                      value: workspaceOpenServiceOrder ? String(workspaceOpenServiceOrder.title ?? workspaceOpenServiceOrder.id ?? "O.S.") : "Sem O.S. aberta",
                      helper: workspaceOpenServiceOrder ? `${String(workspaceOpenServiceOrder.status ?? "-")} · ${formatDateTime(workspaceOpenServiceOrder.updatedAt ?? workspaceOpenServiceOrder.createdAt)}` : "Nada em execução no momento.",
                    },
                    {
                      label: "Última O.S. concluída",
                      value: workspaceLastCompletedServiceOrder ? String(workspaceLastCompletedServiceOrder.title ?? workspaceLastCompletedServiceOrder.id ?? "O.S.") : "Sem O.S. concluída",
                      helper: workspaceLastCompletedServiceOrder ? formatDateTime(workspaceLastCompletedServiceOrder.updatedAt ?? workspaceLastCompletedServiceOrder.createdAt) : "Histórico sem conclusão retornada.",
                    },
                    {
                      label: "Último pagamento",
                      value: workspaceLastPayment ? formatCurrency(Number(workspaceLastPayment.amountCents ?? workspaceLastPayment.amount ?? 0)) : "Não encontrado",
                      helper: workspaceLastPayment ? formatDateTime(workspaceLastPayment.paidAt ?? workspaceLastPayment.updatedAt ?? workspaceLastPayment.createdAt) : "Sem pagamento nos dados disponíveis.",
                    },
                    {
                      label: "Governança/Risco",
                      value: selectedProfile.status,
                      helper: "Detalhe completo disponível em Governança.",
                    },
                  ]}
                />

                <article ref={timelineAnchorRef} className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    O.S. relacionadas
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {workspaceServiceOrders.slice(0, 3).map((order, index) => (
                      <div
                        key={`${String(order.id ?? "order")}-${index}`}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/30 p-2"
                      >
                        <p className="text-xs font-medium text-[var(--text-primary)]">
                          {String(order.title ?? order.description ?? "O.S.")}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {String(order.status ?? "Status não informado")} ·{" "}
                          {formatDateTime(order.updatedAt ?? order.createdAt)}
                        </p>
                      </div>
                    ))}
                    {workspaceServiceOrders.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        Nenhuma O.S. relacionada retornada.
                      </p>
                    ) : null}
                  </div>
                </article>

                <article className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Agendamentos relacionados
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {workspaceAppointments
                      .slice(0, 3)
                      .map((appointment, index) => (
                        <div
                          key={`${String(appointment.id ?? "appointment")}-${index}`}
                          className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/30 p-2"
                        >
                          <p className="text-xs font-medium text-[var(--text-primary)]">
                            {String(
                              appointment.title ??
                                appointment.description ??
                                "Agendamento"
                            )}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {formatDateTime(
                              appointment.startsAt ?? appointment.createdAt
                            )}{" "}
                            ·{" "}
                            {String(
                              appointment.status ?? "Status não informado"
                            )}
                          </p>
                        </div>
                      ))}
                    {workspaceAppointments.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        Nenhum agendamento relacionado retornado.
                      </p>
                    ) : null}
                  </div>
                </article>

                <article className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    <AlertTriangle className="h-3.5 w-3.5" /> Timeline recente
                  </p>
                  <div className="mt-2">
                    <AppEmbeddedTimeline
                      items={(workspace.timeline ?? []).slice(0, 5).map((event, index) => ({
                        id: String(event.id ?? `event-${index}`),
                        type: String(event.type ?? event.category ?? "Evento"),
                        summary: String(event.summary ?? event.description ?? event.title ?? "Evento sem resumo"),
                        entity: String(event.entity ?? event.entityType ?? event.target ?? "Cliente"),
                        actor: String(event.actor ?? event.author ?? event.createdBy ?? "Sistema"),
                        happenedAt: formatDateTime(event.occurredAt ?? event.createdAt),
                        action: event.link ? (
                          <Button size="sm" variant="ghost" onClick={() => navigate(String(event.link))}>
                            Ver detalhe
                          </Button>
                        ) : null,
                      }))}
                      emptyMessage="Sem timeline retornada para este cliente."
                    />
                  </div>
                </article>
              </div>
            )}
          </AppContextWorkspace>
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
            if (created?.id) {
              setActiveCustomerId(created.id);
              await refreshCustomerWorkspace(String(created.id));
            }
          }}
        />

        <EditCustomerModal
          open={Boolean(editingCustomerId)}
          customerId={editingCustomerId}
          onClose={() => {
            setEditingCustomerId(null);
            setPendingEditCustomerId(null);
          }}
          onSaved={async saved => {
            setEditingCustomerId(null);
            setPendingEditCustomerId(null);
            await customersQuery.refetch();
            if (saved?.id) setActiveCustomerId(String(saved.id));
            toast.success("Cliente atualizado com sucesso.");
          }}
        />
        <CreateAppointmentModal
          isOpen={createAppointmentOpen}
          onClose={() => setCreateAppointmentOpen(false)}
          onSuccess={async () => {
            setCreateAppointmentOpen(false);
            if (!activeCustomerId) return;
            await propagateCustomerOperationalChange(
              activeCustomerId,
              "CUSTOMER_APPOINTMENT_CREATED",
              {
              includeTimeline: true,
              }
            );
            toast.success("Agendamento criado.");
          }}
          customers={customers.map(customer => ({ id: String(customer.id ?? ""), name: String(customer.name ?? "Cliente") }))}
          initialCustomerId={activeCustomerId}
        />
        <CreateServiceOrderModal
          isOpen={createServiceOrderOpen}
          onClose={() => setCreateServiceOrderOpen(false)}
          onSuccess={async () => {
            setCreateServiceOrderOpen(false);
            if (!activeCustomerId) return;
            await propagateCustomerOperationalChange(
              activeCustomerId,
              "CUSTOMER_SERVICE_ORDER_CREATED",
              {
              includeTimeline: true,
              }
            );
            toast.success("O.S. criada.");
          }}
          customers={customers.map(customer => ({ id: String(customer.id ?? ""), name: String(customer.name ?? "Cliente") }))}
          people={people}
          initialCustomerId={activeCustomerId}
        />
    </AppPageShell>
  );
}
