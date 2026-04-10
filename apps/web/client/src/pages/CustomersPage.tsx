import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users,
  Plus,
  RefreshCcw,
  CalendarDays,
  Briefcase,
  Wallet,
  History,
  Sparkles,
  Phone,
  Mail,
  ArrowRightLeft,
  Link2,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  BadgeDollarSign,
  WifiOff,
} from "lucide-react";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import EditCustomerModal from "@/components/EditCustomerModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildFinanceChargeUrl,
  buildWhatsAppConversationUrl,
  buildServiceOrdersDeepLink,
} from "@/lib/operations/operations.utils";
import {
  getErrorMessage,
  getQueryUiState,
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import {
  SmartPage,
  SurfaceSection,
} from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/QueryStateBoundary";
import { StatusBadge } from "@/components/StatusBadge";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";
import { useCriticalActionStore } from "@/stores/criticalActionStore";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { generateCustomerActions } from "@/lib/smartActions";
import { ActionBarWrapper } from "@/components/operating-system/ActionBar";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { NextActionCell } from "@/components/operating-system/NextActionCell";
import {
  getCustomerDecision,
  getCustomerSeverity,
  getOperationalSeverityLabel,
} from "@/lib/operations/operational-intelligence";
import { ContextPanel } from "@/components/operating-system/ContextPanel";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Appointment = {
  id: string;
  startsAt?: string;
  endsAt?: string | null;
  status?: string;
  notes?: string | null;
};

type ServiceOrder = {
  id: string;
  title?: string;
  status?: string;
  createdAt?: string;
  scheduledFor?: string | null;
  updatedAt?: string;
  amountCents?: number | null;
  financialSummary?: {
    hasCharge?: boolean;
    chargeStatus?: string;
  } | null;
};

type Charge = {
  id: string;
  amountCents?: number;
  status?: string;
  dueDate?: string | null;
  createdAt?: string;
};

type WorkspaceSuggestion = {
  id: string;
  tone: "critical" | "attention" | "healthy";
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
  urgencyLabel?: string;
};

type TimelineEvent = {
  id: string;
  action?: string;
  description?: string | null;
  createdAt?: string;
};

type CustomerWorkspace = {
  customer: Customer;
  appointments: Appointment[];
  serviceOrders: ServiceOrder[];
  charges: Charge[];
  timeline: TimelineEvent[];
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(value?: string | null, max = 48) {
  const text = (value ?? "").trim();
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatCurrency(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function getCustomerIdFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const customerId = params.get("customerId")?.trim() ?? "";

  return customerId || null;
}

function buildCustomersUrl(customerId?: string | null) {
  const params = new URLSearchParams();

  if (customerId) {
    params.set("customerId", customerId);
  }

  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

function normalizeWorkspacePayload(payload: unknown): CustomerWorkspace | null {
  const root = normalizeObjectPayload<any>(payload);
  const raw =
    root &&
    typeof root === "object" &&
    root.data &&
    typeof root.data === "object"
      ? root.data
      : root;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const customer = raw.customer;

  if (!customer || typeof customer !== "object") {
    return null;
  }

  return {
    customer: customer as Customer,
    appointments: Array.isArray(raw.appointments) ? raw.appointments : [],
    serviceOrders: Array.isArray(raw.serviceOrders) ? raw.serviceOrders : [],
    charges: Array.isArray(raw.charges)
      ? raw.charges.map((item: unknown) => {
          const charge = (item ?? {}) as Record<string, unknown>;
          const amountCentsRaw =
            typeof charge.amountCents === "number"
              ? charge.amountCents
              : typeof charge.amount === "number"
                ? charge.amount
                : undefined;

          return {
            ...charge,
            amountCents: amountCentsRaw,
          } as Charge;
        })
      : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
  };
}

function SectionCard({
  title,
  icon: Icon,
  emptyText,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  emptyText: string;
  children: ReactNode;
}) {
  const hasContent = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <div className="nexo-surface-operational">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          {title}
        </h3>
      </div>

      {hasContent ? (
        <div className="space-y-3">{children}</div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: "default" | "success" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
      : tone === "muted"
        ? "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]"
        : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {subtitle}
      </p>
    </div>
  );
}

function getChargeStatusLabel(status?: string) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "PAID":
      return "Paga";
    case "OVERDUE":
      return "Vencida";
    case "CANCELED":
      return "Cancelada";
    default:
      return status || "—";
  }
}

function getChargeStatusTone(status?: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "OVERDUE":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "CANCELED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300";
  }
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getRiskLevel(score: number) {
  if (score >= 75) return { label: "Risco alto", tone: "critical" as const };
  if (score >= 40)
    return { label: "Risco moderado", tone: "attention" as const };
  return { label: "Risco controlado", tone: "healthy" as const };
}

export default function CustomersPage() {
  const { track } = useProductAnalytics();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null
  );
  const [workspaceCustomerId, setWorkspaceCustomerId] = useState<string | null>(
    () => getCustomerIdFromUrl()
  );
  const [nextActionRouting, setNextActionRouting] = useState(false);
  const [highlightedCustomerId, setHighlightedCustomerId] = useState<
    string | null
  >(null);
  const [workspaceLastUpdatedAt, setWorkspaceLastUpdatedAt] = useState<
    string | null
  >(null);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<string | null>(
    null
  );
  const [localTimeline, setLocalTimeline] = useState<TimelineEvent[]>([]);
  const [crossTabMessage, setCrossTabMessage] = useState<string | null>(null);
  const [isDegradedMode, setIsDegradedMode] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);
  const interactionBlocked = useCriticalActionStore(state => state.isBlocked());

  const listCustomers = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const listAppointments = trpc.nexo.appointments.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const listServiceOrders = trpc.nexo.serviceOrders.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const listCharges = trpc.finance.charges.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: workspaceCustomerId ?? "" },
    {
      enabled: Boolean(workspaceCustomerId),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customers = useMemo(() => {
    return normalizeArrayPayload<Customer>(listCustomers.data);
  }, [listCustomers.data]);
  const appointments = useMemo(() => {
    return normalizeArrayPayload<any>(listAppointments.data);
  }, [listAppointments.data]);
  const serviceOrders = useMemo(() => {
    return normalizeArrayPayload<any>(listServiceOrders.data);
  }, [listServiceOrders.data]);
  const charges = useMemo(() => {
    return normalizeArrayPayload<any>(listCharges.data);
  }, [listCharges.data]);

  const workspace = useMemo(() => {
    const next = normalizeWorkspacePayload(workspaceQuery.data);
    if (!workspaceCustomerId || !next) return next;
    if (String(next.customer?.id ?? "") !== String(workspaceCustomerId))
      return null;
    return next;
  }, [workspaceCustomerId, workspaceQuery.data]);
  const [workspaceTimedOut, setWorkspaceTimedOut] = useState(false);

  useEffect(() => {
    if (!workspaceCustomerId || !workspaceQuery.isLoading) {
      setWorkspaceTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setWorkspaceTimedOut(true);
    }, 9000);

    return () => window.clearTimeout(timeoutId);
  }, [workspaceCustomerId, workspaceQuery.isLoading]);

  useEffect(() => {
    if (listCustomers.error) {
      toast.error("Erro ao carregar clientes: " + listCustomers.error.message);
    }
  }, [listCustomers.error]);

  useEffect(() => {
    if (workspaceQuery.error) {
      setIsDegradedMode(true);
      toast.error(
        "Erro ao carregar workspace do cliente: " + workspaceQuery.error.message
      );
    }
  }, [workspaceQuery.error]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      channelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const customerIdFromUrl = getCustomerIdFromUrl();
      setWorkspaceCustomerId(current => {
        if (current === customerIdFromUrl) return current;
        return customerIdFromUrl;
      });
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!highlightedCustomerId || !highlightedRowRef.current) return;
    highlightedRowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    highlightedRowRef.current.focus();
    const timer = window.setTimeout(() => setHighlightedCustomerId(null), 2800);
    return () => window.clearTimeout(timer);
  }, [highlightedCustomerId]);

  useEffect(() => {
    if (!workspace) return;
    const latestFromWorkspace = [
      workspace.customer.updatedAt,
      ...workspace.appointments.map(item => item.endsAt ?? item.startsAt),
      ...workspace.serviceOrders.map(item => item.updatedAt ?? item.createdAt),
      ...workspace.charges.map(item => item.createdAt ?? item.dueDate),
      ...workspace.timeline.map(item => item.createdAt),
    ].sort((a, b) => toTimestamp(b) - toTimestamp(a))[0];
    setWorkspaceLastUpdatedAt(latestFromWorkspace ?? new Date().toISOString());
    setIsDegradedMode(false);
    retryCountRef.current = 0;
  }, [workspace]);

  useEffect(() => {
    if (!workspaceCustomerId || typeof window === "undefined") return;

    const channelName = `nexo-workspace-${workspaceCustomerId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;
    channel.onmessage = event => {
      if (event.data?.type === "workspace-updated") {
        setCrossTabMessage(
          "Outra aba atualizou este cliente. Contexto sincronizado agora."
        );
        setWorkspaceFeedback("Workspace sincronizado entre abas.");
        void workspaceQuery.refetch();
      }
    };

    const storageKey = `nexo_workspace_touch_${workspaceCustomerId}`;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      setCrossTabMessage("Atualização detectada em outra aba.");
      void workspaceQuery.refetch();
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, [workspaceCustomerId, workspaceQuery]);

  const total = customers.length;
  const totalActive = customers.filter(c => c.active).length;
  const totalInactive = total - totalActive;
  const customerOperationalMap = useMemo(() => {
    return new Map(
      customers.map(customer => {
        const customerAppointments = appointments.filter(
          item => String(item.customerId ?? "") === customer.id
        );
        const customerOrders = serviceOrders.filter(
          item => String(item.customerId ?? "") === customer.id
        );
        const customerCharges = charges.filter(
          item => String(item.customerId ?? "") === customer.id
        );
        const pendingCharges = customerCharges.filter((item: any) => {
          const status = String(item.status ?? "").toUpperCase();
          return status === "PENDING";
        }).length;
        const overdueCharges = customerCharges.filter((item: any) => {
          const status = String(item.status ?? "").toUpperCase();
          return status === "OVERDUE";
        }).length;
        const openServiceOrders = customerOrders.filter((item: any) => {
          const status = String(item.status ?? "").toUpperCase();
          return status === "OPEN" || status === "ASSIGNED" || status === "IN_PROGRESS";
        }).length;
        const lastInteractionAt = [
          customer.updatedAt,
          ...customerAppointments.map((item: any) => item.startsAt),
          ...customerOrders.map((item: any) => item.updatedAt ?? item.createdAt),
          ...customerCharges.map((item: any) => item.createdAt ?? item.dueDate),
        ]
          .filter(Boolean)
          .sort((a, b) => toTimestamp(String(b)) - toTimestamp(String(a)))[0];

        return [
          customer.id,
          {
            openServiceOrders,
            pendingCharges,
            overdueCharges,
            lastInteractionAt: lastInteractionAt ?? null,
          },
        ] as const;
      })
    );
  }, [appointments, charges, customers, serviceOrders]);
  const stressLabEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("stress") === "1";

  const openWorkspace = (customerId: string) => {
    if (interactionBlocked) return;
    if (workspaceCustomerId === customerId) return;
    setWorkspaceCustomerId(customerId);
    navigate(buildCustomersUrl(customerId), { replace: false });
  };

  const closeWorkspace = () => {
    if (interactionBlocked) return;
    setWorkspaceCustomerId(null);
    navigate(buildCustomersUrl(null), { replace: true });
  };

  const refreshCustomerContexts = async (customerId?: string | null) => {
    await invalidateOperationalGraph(utils, customerId);

    if (
      workspaceCustomerId &&
      customerId &&
      workspaceCustomerId === customerId
    ) {
      await workspaceQuery.refetch();
    }
  };

  const announceWorkspaceUpdate = (
    customerId?: string | null,
    message?: string
  ) => {
    if (!customerId || typeof window === "undefined") return;
    const storageKey = `nexo_workspace_touch_${customerId}`;
    localStorage.setItem(storageKey, String(Date.now()));
    channelRef.current?.postMessage({
      type: "workspace-updated",
      at: Date.now(),
    });
    if (message) {
      setWorkspaceFeedback(message);
    }
  };

  const retryWorkspaceWithContext = async (reason: string) => {
    retryCountRef.current += 1;
    const backoffMs = Math.min(1200 * retryCountRef.current, 5000);
    setWorkspaceFeedback(`Tentando recuperar workspace (${reason})...`);
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      void workspaceQuery.refetch();
    }, backoffMs);
  };

  const registerWorkspaceAction = (action: string, description: string) => {
    const now = new Date().toISOString();
    setLocalTimeline(current => [
      {
        id: `local-${now}-${action}`,
        action,
        description,
        createdAt: now,
      },
      ...current,
    ]);
    setWorkspaceFeedback(description);
    setWorkspaceLastUpdatedAt(now);
    if (workspaceCustomerId)
      announceWorkspaceUpdate(workspaceCustomerId, description);
  };

  const workspaceAppointmentsCount = workspace?.appointments?.length ?? 0;
  const workspaceServiceOrdersCount = workspace?.serviceOrders?.length ?? 0;
  const workspacePendingCharges = (workspace?.charges ?? []).filter(
    item => item.status === "PENDING" || item.status === "OVERDUE"
  ).length;
  const workspaceOverdueCharges = (workspace?.charges ?? []).filter(
    item => item.status === "OVERDUE"
  ).length;
  const workspacePaidCharges = (workspace?.charges ?? []).filter(
    item => item.status === "PAID"
  ).length;
  const workspaceTotalFinancial = (workspace?.charges ?? []).reduce(
    (acc, charge) => acc + (charge.amountCents ?? 0),
    0
  );
  const workspacePendingAmount = (workspace?.charges ?? [])
    .filter(item => item.status === "PENDING" || item.status === "OVERDUE")
    .reduce((acc, charge) => acc + (charge.amountCents ?? 0), 0);
  const workspacePaidAmount = (workspace?.charges ?? [])
    .filter(item => item.status === "PAID")
    .reduce((acc, charge) => acc + (charge.amountCents ?? 0), 0);
  const workspaceOverdueAmount = (workspace?.charges ?? [])
    .filter(item => item.status === "OVERDUE")
    .reduce((acc, charge) => acc + (charge.amountCents ?? 0), 0);
  const serviceOrdersWithoutCharge = (workspace?.serviceOrders ?? []).filter(
    item =>
      item.financialSummary?.hasCharge === false ||
      item.financialSummary?.chargeStatus === "NONE"
  ).length;
  const doneServiceOrdersWithoutCharge = (
    workspace?.serviceOrders ?? []
  ).filter(
    item =>
      item.status === "DONE" &&
      (item.financialSummary?.hasCharge === false ||
        item.financialSummary?.chargeStatus === "NONE")
  ).length;
  const serviceOrdersWithoutValue = (workspace?.serviceOrders ?? []).filter(
    item => !item.amountCents || item.amountCents <= 0
  ).length;
  const delayedServiceOrders = (workspace?.serviceOrders ?? []).filter(item => {
    if (!item.scheduledFor) return false;
    if (item.status === "DONE" || item.status === "CANCELED") return false;
    return toTimestamp(item.scheduledFor) < Date.now();
  }).length;
  const workspaceTimeline = useMemo(() => {
    const server = workspace?.timeline ?? [];
    const merged = [...localTimeline, ...server];
    return merged
      .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
      .slice(0, 12);
  }, [localTimeline, workspace?.timeline]);
  const latestWorkspaceActivityAt = useMemo(() => {
    if (!workspace) return null;
    const timestamps = [
      workspace.customer.updatedAt,
      ...workspace.timeline.map(item => item.createdAt),
      ...workspace.serviceOrders.map(item => item.updatedAt ?? item.createdAt),
      ...workspace.charges.map(item => item.createdAt ?? item.dueDate),
    ]
      .map(value => toTimestamp(value))
      .filter(value => value > 0);

    if (timestamps.length === 0) return null;
    return Math.max(...timestamps);
  }, [workspace]);
  const stalledCustomerDays = latestWorkspaceActivityAt
    ? Math.max(
        0,
        Math.floor((Date.now() - latestWorkspaceActivityAt) / (1000 * 60 * 60 * 24))
      )
    : 0;
  const riskScore = useMemo(() => {
    let score = 0;
    if (!workspace) return 0;
    score += Math.min(workspacePendingCharges * 12, 40);
    score += Math.min(delayedServiceOrders * 18, 36);
    score += workspace.customer.active ? 0 : 18;
    score += Math.min(doneServiceOrdersWithoutCharge * 10, 30);
    return Math.min(score, 100);
  }, [
    delayedServiceOrders,
    doneServiceOrdersWithoutCharge,
    workspace,
    workspacePendingCharges,
  ]);
  const riskLevel = getRiskLevel(riskScore);

  const workspaceSuggestions = useMemo<WorkspaceSuggestion[]>(() => {
    if (!workspace) return [];
    const suggestions: WorkspaceSuggestion[] = [];
    if (workspace.serviceOrders.length === 0) {
      suggestions.push({
        id: "customer-no-os",
        tone: "attention",
        title: "Cliente sem O.S. ativa",
        description: "Crie a primeira O.S. para iniciar execução e receita.",
        ctaLabel: "Criar O.S.",
        ctaPath: `/service-orders?customerId=${workspace.customer.id}`,
        urgencyLabel: "Início do fluxo",
      });
    }
    if (doneServiceOrdersWithoutCharge > 0) {
      suggestions.push({
        id: "customer-done-no-charge",
        tone: "critical",
        title: "O.S. pronta sem cobrança",
        description: `${doneServiceOrdersWithoutCharge} O.S. concluídas aguardando faturamento.`,
        ctaLabel: "Gerar cobrança",
        ctaPath: `/finances?customerId=${workspace.customer.id}`,
        urgencyLabel: "Receita travada",
      });
    }
    if (workspacePendingCharges > 0) {
      suggestions.push({
        id: "finance-pending",
        tone: workspaceOverdueCharges > 0 ? "critical" : "attention",
        title:
          workspaceOverdueCharges > 0
            ? "Cobrança atrasada exige contato"
            : "Cobrança pendente sem follow-up",
        description:
          workspaceOverdueCharges > 0
            ? `${workspaceOverdueCharges} vencidas • ${formatCurrency(workspaceOverdueAmount)} em risco.`
            : `${workspacePendingCharges} pendentes • ${formatCurrency(workspacePendingAmount)} aguardando envio.`,
        ctaLabel: "Enviar WhatsApp",
        ctaPath: `/whatsapp?customerId=${workspace.customer.id}`,
        urgencyLabel: workspaceOverdueCharges > 0 ? "Urgente" : "Hoje",
      });
    }
    if (serviceOrdersWithoutCharge > 0) {
      suggestions.push({
        id: "customer-no-charge",
        tone: "attention",
        title: "Existem O.S. sem cobrança vinculada",
        description: `${serviceOrdersWithoutCharge} ordens já têm execução e precisam de financeiro.`,
        ctaLabel: "Gerar cobrança",
        ctaPath: `/finances?customerId=${workspace.customer.id}`,
      });
    }
    if (serviceOrdersWithoutValue > 0) {
      suggestions.push({
        id: "os-no-value",
        tone: "attention",
        title: "O.S. sem valor definido",
        description: `${serviceOrdersWithoutValue} ordens precisam de valor para previsibilidade.`,
        ctaLabel: "Definir valor",
        ctaPath: `/service-orders?customerId=${workspace.customer.id}`,
      });
    }
    if (delayedServiceOrders > 0) {
      suggestions.push({
        id: "os-delayed",
        tone: "critical",
        title: "O.S. atrasada",
        description: `${delayedServiceOrders} ordens em atraso exigem reação imediata.`,
        ctaLabel: "Ver O.S.",
        ctaPath: `/service-orders?customerId=${workspace.customer.id}`,
        urgencyLabel: "Urgente",
      });
    }
    if (!workspace.customer.active || stalledCustomerDays >= 14) {
      suggestions.push({
        id: "customer-stalled",
        tone: "attention",
        title: "Cliente parado",
        description:
          stalledCustomerDays >= 14
            ? `Sem avanço há ${stalledCustomerDays} dias. Reative com uma ação comercial.`
            : "Sem operação recente. Reative o relacionamento com contato direto.",
        ctaLabel: "Sugerir próxima ação",
        ctaPath: `/service-orders?customerId=${workspace.customer.id}&create=1`,
        urgencyLabel: "Reativação",
      });
    }

    const tonePriority = { critical: 0, attention: 1, healthy: 2 } as const;
    return suggestions
      .sort((a, b) => tonePriority[a.tone] - tonePriority[b.tone])
      .slice(0, 5);
  }, [
    delayedServiceOrders,
    doneServiceOrdersWithoutCharge,
    serviceOrdersWithoutCharge,
    serviceOrdersWithoutValue,
    stalledCustomerDays,
    workspace,
    workspaceOverdueAmount,
    workspaceOverdueCharges,
    workspacePendingAmount,
    workspacePendingCharges,
  ]);

  const smartPriorities = useMemo(
    () => [
      {
        id: "cust-overdue",
        type: "overdue_charges" as const,
        title: "Clientes com cobrança pendente",
        count: workspacePendingCharges,
        impactCents: workspacePendingCharges * 30000,
        ctaLabel: "Cobrar cliente",
        ctaPath: "/finances",
        helperText: "Cobrança atrasada compromete relacionamento e caixa.",
      },
      {
        id: "cust-ops",
        type: "stalled_service_orders" as const,
        title: "Clientes com execução aberta",
        count: workspaceServiceOrdersCount,
        impactCents: workspaceServiceOrdersCount * 25000,
        ctaLabel: "Acompanhar execução",
        ctaPath: "/service-orders",
        helperText: "Execução sem fechamento reduz previsibilidade de receita.",
      },
      {
        id: "cust-risk",
        type: "operational_risk" as const,
        title: "Clientes sem próxima ação",
        count: workspace ? 0 : 1,
        impactCents: 10000,
        ctaLabel: "Abrir workspace",
        ctaPath: "/customers",
        helperText: "Sem foco por cliente o time opera no escuro.",
      },
    ],
    [workspace, workspacePendingCharges, workspaceServiceOrdersCount]
  );

  const nextActionLabel = !workspace
    ? "Selecione um cliente para abrir o workspace."
    : workspaceSuggestions.length > 0
      ? workspaceSuggestions[0].title
      : workspacePendingCharges > 0
        ? "Cobrar cliente imediatamente"
        : workspaceServiceOrdersCount > 0
          ? "Acompanhar execução das ordens"
          : workspaceAppointmentsCount > 0
            ? "Preparar atendimento agendado"
            : "Iniciar relacionamento com este cliente";
  const nextActionSeverity = !workspace
    ? "attention"
    : workspaceSuggestions[0]?.tone === "critical"
      ? "critical"
      : workspaceSuggestions[0]?.tone === "attention"
        ? "attention"
        : workspacePendingCharges > 0
          ? "critical"
        : "healthy";
  const smartOperationalActions = useMemo(
    () =>
      generateCustomerActions({
        customerId: workspace?.customer.id,
        appointmentsCount: workspaceAppointmentsCount,
        onSuggestAppointment: () => {
          if (!workspace) return;
          navigate(`/appointments?customerId=${workspace.customer.id}`);
        },
      }),
    [navigate, workspace, workspaceAppointmentsCount]
  );
  const hasRenderableData =
    listCustomers.data !== undefined ||
    workspaceQuery.data !== undefined ||
    listAppointments.data !== undefined ||
    listServiceOrders.data !== undefined ||
    listCharges.data !== undefined;
  const queryState = getQueryUiState(
    [listCustomers, workspaceQuery, listAppointments, listServiceOrders, listCharges],
    hasRenderableData
  );
  const blockingErrorMessage =
    getErrorMessage(listCustomers.error, "") ||
    getErrorMessage(workspaceQuery.error, "") ||
    getErrorMessage(listAppointments.error, "") ||
    getErrorMessage(listServiceOrders.error, "") ||
    getErrorMessage(listCharges.error, "") ||
    "Não foi possível carregar clientes.";

  return (
    <PageWrapper
      title={
        <span className="inline-flex items-center gap-2">
          <Users className="h-6 w-6 text-orange-500" />
          Clientes
        </span>
      }
      subtitle="Ponto de partida do fluxo oficial: cada cliente conecta agenda, execução, cobrança, comunicação e rastreabilidade."
      breadcrumb={[{ label: "Operação" }, { label: "Clientes" }]}
    >

      <ActionBarWrapper
        secondaryActions={(
          <Button
            type="button"
            variant="outline"
            onClick={() => void listCustomers.refetch()}
            className="flex items-center gap-2"
            disabled={interactionBlocked}
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>
        )}
        primaryAction={(
          <Button
            type="button"
            onClick={() => {
              track("cta_click", {
                screen: "customers",
                ctaId: "hero_new_customer",
              });
              setIsCreateOpen(true);
            }}
            className="min-h-12 flex items-center gap-2 bg-orange-500 text-white"
            disabled={interactionBlocked}
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        )}
      />

      <SmartPage
        pageContext="customers"
        headline="Cliente nunca fica sem próximo passo"
        dominantProblem={nextActionLabel}
        dominantImpact={
          workspace
            ? `${workspacePendingCharges} pendências financeiras`
            : "Sem cliente em foco"
        }
        dominantCta={{
          label: workspace ? "Executar próxima ação" : "Novo cliente",
          onClick: () => {
            track("cta_click", {
              screen: "customers",
              ctaId: "smartpage_primary",
              hasWorkspace: Boolean(workspace),
            });
            if (workspace)
              navigate(`/service-orders?customerId=${workspace.customer.id}`);
            else setIsCreateOpen(true);
          },
          path: workspace
            ? `/service-orders?customerId=${workspace?.customer.id}`
            : "/customers",
        }}
        priorities={smartPriorities}
        operationalActions={smartOperationalActions}
      />

      {queryState.hasBackgroundUpdate ? (
        <SurfaceSection className="border-blue-500/30 bg-blue-500/10 text-sm text-blue-200">
          Atualizando clientes e workspace em segundo plano...
        </SurfaceSection>
      ) : null}

      <SurfaceSection className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
          <Sparkles className="h-3.5 w-3.5" />
          Entidade central do relacionamento operacional
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            title="Total de clientes"
            value={total}
            subtitle="Base cadastrada e visível"
          />
          <SummaryCard
            title="Clientes ativos"
            value={totalActive}
            subtitle="Prontos para operar no fluxo"
            tone="success"
          />
          <SummaryCard
            title="Clientes inativos"
            value={totalInactive}
            subtitle="Base sem operação ativa no momento"
            tone="muted"
          />
        </div>

        <SurfaceSection
          className={
            nextActionSeverity === "critical"
              ? "border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20"
              : nextActionSeverity === "healthy"
                ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                : "border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20"
          }
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-300">
                Próxima ação
              </p>
              <p className="mt-1 font-medium text-orange-900 dark:text-orange-100">
                {nextActionLabel}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {workspace
                  ? "O sistema já leu o contexto do cliente em foco e direcionou o melhor próximo passo."
                  : "Abra um workspace para condução personalizada por cliente."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  track("cta_click", {
                    screen: "customers",
                    ctaId: "next_action_primary",
                    hasWorkspace: Boolean(workspace),
                  });
                  setNextActionRouting(true);
                  if (workspace)
                    navigate(
                      `/service-orders?customerId=${workspace.customer.id}`
                    );
                  else setIsCreateOpen(true);
                  setTimeout(() => setNextActionRouting(false), 1200);
                }}
              >
                {nextActionRouting
                  ? "Ação iniciada"
                  : workspace
                    ? "Executar próxima ação"
                    : "Novo cliente"}
              </Button>
              {workspace ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate(`/whatsapp?customerId=${workspace.customer.id}`)
                  }
                >
                  WhatsApp
                </Button>
              ) : null}
            </div>
          </div>
        </SurfaceSection>

        <SurfaceSection className="nexo-data-table p-0">
          <div className="border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  Base que gera receita
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Abra um workspace para entender o contexto, o impacto e a ação
                  imediata por cliente.
                </p>
              </div>
            </div>
          </div>

          {queryState.isInitialLoading && customers.length === 0 ? (
            <SurfaceSection className="m-4">
              <TableSkeleton rows={6} columns={7} />
            </SurfaceSection>
          ) : queryState.shouldBlockForError ? (
            <SurfaceSection className="m-4 space-y-3 rounded-xl border border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20">
              <p className="text-sm text-red-700 dark:text-red-200">
                {blockingErrorMessage}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void listCustomers.refetch()}
              >
                Tentar novamente
              </Button>
            </SurfaceSection>
          ) : customers.length === 0 ? (
            <SurfaceSection className="m-4 space-y-3">
              <EmptyState
                icon={<Users className="h-7 w-7" />}
                title="Sua base de clientes ainda está vazia"
                description="Comece criando seu primeiro cliente e veja sua operação acontecer do atendimento ao recebimento."
                action={{
                  label: "Crie seu primeiro cliente",
                  onClick: () => setIsCreateOpen(true),
                }}
                secondaryAction={{
                  label: "Recarregar clientes",
                  onClick: () => void listCustomers.refetch(),
                }}
              />
              <DemoEnvironmentCta />
            </SurfaceSection>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                      Nome
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                      Situação operacional
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                      Situação financeira
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                      Última interação
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                      Próxima ação
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {customers.map(customer => {
                    const isOpen = workspaceCustomerId === customer.id;
                    const operational = customerOperationalMap.get(customer.id) ?? {
                      openServiceOrders: 0,
                      pendingCharges: 0,
                      overdueCharges: 0,
                      lastInteractionAt: customer.updatedAt,
                    };
                    const decision = getCustomerDecision({
                      active: customer.active,
                      ...operational,
                    });
                    const whatsappUrl = buildWhatsAppConversationUrl({
                      customerId: customer.id,
                      context:
                        operational.overdueCharges > 0
                          ? "charge_overdue"
                          : operational.pendingCharges > 0
                            ? "charge_pending"
                            : "general",
                    });

                    return (
                      <tr
                        key={customer.id}
                        ref={
                          highlightedCustomerId === customer.id
                            ? highlightedRowRef
                            : null
                        }
                        tabIndex={
                          highlightedCustomerId === customer.id ? -1 : undefined
                        }
                        className={`${
                          isOpen ? "bg-orange-50/60 dark:bg-orange-950/10" : ""
                        } ${highlightedCustomerId === customer.id ? "ring-2 ring-orange-400" : ""}`}
                        onClick={() => openWorkspace(customer.id)}
                      >
                        <td className="px-4 py-3 text-zinc-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{customer.name}</span>
                            {isOpen ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                Em foco
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          <p>{operational.openServiceOrders} O.S. abertas</p>
                          <p className="text-xs text-zinc-500">
                            {customer.active ? "Cliente ativo" : "Cliente inativo"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          <p>{operational.pendingCharges} pendente(s)</p>
                          <p className="text-xs text-zinc-500">
                            {operational.overdueCharges} vencida(s)
                          </p>
                        </td>

                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {formatDateTime(operational.lastInteractionAt)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            <StatusBadge
                              label={getOperationalSeverityLabel(getCustomerSeverity({
                                active: customer.active,
                                ...operational,
                              }))}
                              tone={
                                getCustomerSeverity({
                                  active: customer.active,
                                  ...operational,
                                }) === "critical"
                                  ? "danger"
                                  : getCustomerSeverity({
                                        active: customer.active,
                                        ...operational,
                                      }) === "healthy"
                                    ? "success"
                                    : "warning"
                              }
                            />
                            <NextActionCell
                              entity="customer"
                              item={{
                                active: customer.active,
                                ...operational,
                              }}
                            />
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openWorkspace(customer.id)}>
                              Ver detalhes
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/appointments?customerId=${customer.id}`)}>
                              Agendar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/finances?customerId=${customer.id}`)}>
                              Gerar cobrança
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => whatsappUrl && navigate(whatsappUrl)}
                              disabled={!whatsappUrl}
                            >
                              Enviar WhatsApp
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (decision.primaryAction.key === "create_appointment") {
                                  navigate(`/appointments?customerId=${customer.id}`);
                                  return;
                                }
                                if (decision.primaryAction.key === "open_finances") {
                                  navigate(`/finances?customerId=${customer.id}`);
                                  return;
                                }
                                if (decision.primaryAction.key === "open_whatsapp" && whatsappUrl) {
                                  navigate(whatsappUrl);
                                  return;
                                }
                                openWorkspace(customer.id);
                              }}
                            >
                              {decision.primaryAction.label}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceSection>
      </SurfaceSection>

      <Dialog
        open={false}
        onOpenChange={() => undefined}
      >
        <DialogContent className="left-auto right-0 top-0 h-screen w-full max-h-screen max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none border-l border-slate-200/80 bg-slate-50 p-0 shadow-2xl dark:border-white/10 dark:bg-[#0b1017]">
          <DialogHeader className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#111722]/95">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-orange-500">
                Workspace do cliente
              </p>
              <DialogTitle className="mt-1 text-left text-xl font-semibold text-zinc-900 dark:text-white">
                {workspace?.customer?.name ?? "Carregando..."}
              </DialogTitle>
              <DialogDescription className="mt-1 text-left text-sm text-zinc-600 dark:text-zinc-400">
                Hub lateral de contexto, histórico e próxima ação.
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Clock3 className="h-3.5 w-3.5" />
                Última atualização: {formatDateTime(workspaceLastUpdatedAt)}
                {isDegradedMode ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <WifiOff className="mr-1 h-3 w-3" />
                    Modo degradado
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Sincronizado
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 p-5">
            {workspaceQuery.isLoading && !workspace ? (
              <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <p>Carregando workspace...</p>
                {workspaceTimedOut ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    <p>
                      Este carregamento está demorando além do esperado. Você
                      pode tentar novamente agora.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void retryWorkspaceWithContext(
                          "timeout de carregamento"
                        )
                      }
                    >
                      Recarregar com retry inteligente
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : !workspace ? (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <p>Não foi possível carregar o workspace deste cliente.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void retryWorkspaceWithContext("erro de API")
                    }
                  >
                    Retry inteligente
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/customers")}
                  >
                    Fallback: voltar à lista
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closeWorkspace}
                  >
                    Fechar workspace
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {workspaceFeedback ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                    {workspaceFeedback}
                  </div>
                ) : null}
                {crossTabMessage ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                    {crossTabMessage}
                  </div>
                ) : null}

                <div className="rounded-xl border border-orange-300 bg-orange-100 p-4 dark:border-orange-900 dark:bg-orange-950/20">
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                    Próxima ação recomendada
                  </p>

                  <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                    {nextActionLabel}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    riskLevel.tone === "critical"
                      ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
                      : riskLevel.tone === "attention"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                        : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    Risk Engine do cliente
                  </p>
                  <p className="mt-1 text-sm">
                    {riskLevel.label} · Score {riskScore}/100
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    Priorização automática baseada em atraso, pendências
                    financeiras e execução sem cobrança.
                  </p>
                </div>

                {workspaceSuggestions.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      CTAs dinâmicos do workspace
                    </p>
                    {workspaceSuggestions.map(suggestion => (
                      <div
                        key={suggestion.id}
                        className={`rounded-lg border p-3 ${
                          suggestion.tone === "critical"
                            ? "border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20"
                            : suggestion.tone === "attention"
                              ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20"
                              : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {suggestion.title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {suggestion.description}
                            </p>
                          </div>
                          {suggestion.urgencyLabel ? (
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-900/60 dark:text-gray-200">
                              {suggestion.urgencyLabel}
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              registerWorkspaceAction(
                                "WORKSPACE_CTA",
                                `${suggestion.title}: ${suggestion.ctaLabel}`
                              );
                              navigate(suggestion.ctaPath);
                            }}
                          >
                            {suggestion.ctaLabel}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          registerWorkspaceAction(
                            "OPEN_APPOINTMENTS",
                            "Navegação para agenda do cliente."
                          );
                          navigate(
                            `/appointments?customerId=${workspace.customer.id}`
                          );
                        }}
                        className="gap-2"
                      >
                        <CalendarDays className="h-4 w-4" />
                        Abrir agenda do cliente
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          registerWorkspaceAction(
                            "VIEW_SERVICE_ORDERS",
                            "Visualização de O.S. do cliente."
                          );
                          navigate(
                            `/service-orders?customerId=${workspace.customer.id}`
                          );
                        }}
                        className="gap-2"
                      >
                        <Briefcase className="h-4 w-4" />
                        Ver O.S.
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          registerWorkspaceAction(
                            "CREATE_SERVICE_ORDER",
                            "Ação direta para criar nova O.S."
                          );
                          navigate(
                            `/service-orders?customerId=${workspace.customer.id}&create=1`
                          );
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Criar O.S.
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          registerWorkspaceAction(
                            "VIEW_FINANCE",
                            "Consulta de financeiro do cliente."
                          );
                          navigate(
                            `/finances?customerId=${workspace.customer.id}`
                          );
                        }}
                        className="gap-2"
                      >
                        <Wallet className="h-4 w-4" />
                        Ver cobranças
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          registerWorkspaceAction(
                            "GENERATE_CHARGE",
                            "Ação direta para gerar cobrança."
                          );
                          navigate(
                            `/finances?customerId=${workspace.customer.id}&createCharge=1`
                          );
                        }}
                        className="gap-2"
                      >
                        <BadgeDollarSign className="h-4 w-4" />
                        Gerar cobrança
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          registerWorkspaceAction(
                            "SEND_WHATSAPP",
                            "Contato no WhatsApp iniciado."
                          );
                          navigate(
                            `/whatsapp?customerId=${workspace.customer.id}`
                          );
                        }}
                        className="gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Falar com cliente
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(buildCustomersUrl(workspace.customer.id))
                        }
                        className="gap-2"
                      >
                        <Link2 className="h-4 w-4" />
                        Deep-link
                      </Button>
                    </div>

                    <p className="text-xs text-orange-800 dark:text-orange-300">
                      Use este cliente como ponto de partida para navegar pelo
                      resto do fluxo.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Phone className="h-4 w-4" />
                      Telefone
                    </p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">
                      {workspace.customer.phone ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Mail className="h-4 w-4" />
                      Email
                    </p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">
                      {workspace.customer.email ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Status
                    </p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">
                      {workspace.customer.active ? "Ativo" : "Inativo"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Criado em
                    </p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">
                      {formatDate(workspace.customer.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    title="Total financeiro"
                    value={formatCurrency(workspaceTotalFinancial)}
                    subtitle="Toda receita mapeada no cliente"
                  />
                  <SummaryCard
                    title="Pendente"
                    value={formatCurrency(workspacePendingAmount)}
                    subtitle={`${workspacePendingCharges} cobranças esperando ação`}
                  />
                  <SummaryCard
                    title="Pago"
                    value={formatCurrency(workspacePaidAmount)}
                    subtitle={`${workspacePaidCharges} cobranças já recebidas`}
                    tone="success"
                  />
                  <SummaryCard
                    title="Atrasado"
                    value={formatCurrency(workspaceOverdueAmount)}
                    subtitle={`${workspaceOverdueCharges} cobranças vencidas`}
                    tone={workspaceOverdueCharges > 0 ? "default" : "muted"}
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Observações
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {workspace.customer.notes?.trim() || "Sem observações."}
                  </p>
                </div>

                <SectionCard
                  title="Agendamentos recentes"
                  icon={CalendarDays}
                  emptyText="Sem agendamentos recentes. Programe um novo horário para manter a operação em movimento."
                >
                  {workspace.appointments.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDateTime(item.startsAt)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Status: {item.status ?? "—"}
                      </p>
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        {truncateText(item.notes, 120)}
                      </p>
                    </div>
                  ))}
                </SectionCard>

                <SectionCard
                  title="Ordens de serviço recentes"
                  icon={Briefcase}
                  emptyText="Nenhuma O.S. vinculada ainda. Crie uma ordem para iniciar execução e rastreabilidade."
                >
                  {workspace.serviceOrders.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.title ?? "Ordem de serviço"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Status: {item.status ?? "—"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Criada em: {formatDate(item.createdAt)}
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(buildServiceOrdersDeepLink(item.id))
                          }
                        >
                          <ArrowRightLeft className="mr-1 h-4 w-4" />
                          Abrir ordem
                        </Button>
                      </div>
                    </div>
                  ))}
                </SectionCard>

                <SectionCard
                  title="Cobranças recentes"
                  icon={Wallet}
                  emptyText="Sem cobranças registradas. Gere uma cobrança para acompanhar pendências e recebimentos."
                >
                  {workspace.charges.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 ${
                        item.status === "OVERDUE"
                          ? "border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20"
                          : item.status === "PENDING"
                            ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20"
                            : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(item.amountCents)}
                          </p>
                          <p className="mt-1">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getChargeStatusTone(item.status)}`}
                            >
                              {getChargeStatusLabel(item.status)}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Vencimento: {formatDate(item.dueDate)}
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(buildFinanceChargeUrl(item.id))
                          }
                        >
                          <ArrowRightLeft className="mr-1 h-4 w-4" />
                          Abrir cobrança
                        </Button>
                      </div>
                    </div>
                  ))}
                </SectionCard>

                {stressLabEnabled ? (
                  <SectionCard
                    title="Stress lab (simulação real)"
                    icon={AlertTriangle}
                    emptyText=""
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          for (let i = 0; i < 4; i += 1) {
                            window.setTimeout(() => {
                              registerWorkspaceAction(
                                "STRESS_MULTI_CLICK",
                                `Clique múltiplo simulado #${i + 1}`
                              );
                            }, i * 120);
                          }
                        }}
                      >
                        Simular múltiplos cliques
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          registerWorkspaceAction(
                            "STRESS_NAV_LOADING",
                            "Navegação durante loading simulada."
                          );
                          setWorkspaceFeedback(
                            "Latência artificial de 1.5s aplicada."
                          );
                          window.setTimeout(
                            () =>
                              navigate(
                                `/service-orders?customerId=${workspace.customer.id}`
                              ),
                            1500
                          );
                        }}
                      >
                        Navegar com latência
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          registerWorkspaceAction(
                            "STRESS_PARALLEL_ACTION",
                            "Duas ações paralelas iniciadas."
                          );
                          void Promise.allSettled([
                            workspaceQuery.refetch(),
                            listCustomers.refetch(),
                          ]);
                        }}
                      >
                        Duas ações simultâneas
                      </Button>
                    </div>
                  </SectionCard>
                ) : null}

                <SectionCard
                  title="Timeline recente"
                  icon={History}
                  emptyText="Sem eventos recentes no histórico. Novas interações aparecerão aqui automaticamente."
                >
                  {workspaceTimeline.map(item => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.action ?? "EVENT"}
                      </p>
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        {item.description?.trim() || "Sem descrição."}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  ))}
                </SectionCard>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ContextPanel
        open={Boolean(workspace)}
        onOpenChange={open => {
          if (!open) closeWorkspace();
        }}
        title={workspace?.customer?.name ?? "Contexto do cliente"}
        subtitle="Atendimento, operação e financeiro no mesmo fluxo"
        statusLabel={workspace?.customer?.active ? "Ativo" : "Inativo"}
        summary={
          workspace
            ? [
                { label: "Agendamentos", value: String(workspace.appointments.length) },
                { label: "Ordens de serviço", value: String(workspace.serviceOrders.length) },
                { label: "Cobranças", value: String(workspace.charges.length) },
                { label: "Próxima ação", value: nextActionLabel },
              ]
            : []
        }
        primaryAction={
          workspace
            ? {
                label: "Enviar WhatsApp",
                onClick: () =>
                  navigate(
                    buildWhatsAppConversationUrl({
                      customerId: workspace.customer.id,
                      context: "general",
                    }) ?? "/whatsapp"
                  ),
              }
            : undefined
        }
        secondaryActions={
          workspace
            ? [
                {
                  label: "Abrir agendamentos",
                  onClick: () => navigate(`/appointments?customerId=${workspace.customer.id}`),
                },
                {
                  label: "Abrir financeiro",
                  onClick: () => navigate(`/finances?customerId=${workspace.customer.id}`),
                },
              ]
            : []
        }
        timeline={(workspace?.timeline ?? []).slice(0, 4).map(item => ({
          id: item.id,
          label: item.action ?? "Evento",
          description: item.description ?? formatDateTime(item.createdAt),
        }))}
      />

      <CreateCustomerModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={async createdCustomer => {
          const createdId = createdCustomer?.id ?? null;

          if (createdId) {
            setWorkspaceCustomerId(createdId);
            setHighlightedCustomerId(createdId);
            navigate(buildCustomersUrl(createdId), { replace: false });
          }

          await refreshCustomerContexts(createdId);
        }}
      />

      <EditCustomerModal
        open={Boolean(editingCustomerId)}
        customerId={editingCustomerId}
        onClose={() => setEditingCustomerId(null)}
        onSaved={async savedCustomer => {
          if (savedCustomer?.id) setHighlightedCustomerId(savedCustomer.id);
          await refreshCustomerContexts(savedCustomer?.id ?? editingCustomerId);
        }}
      />
    </PageWrapper>
  );
}
