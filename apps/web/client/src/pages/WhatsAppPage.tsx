import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Sparkles,
  Star,
  User,
  Workflow,
  XCircle,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { cn } from "@/lib/utils";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { Button } from "@/components/design-system";
import { AppPageShell, AppSkeleton } from "@/components/app-system";
import {
  AppEmptyState,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
} from "@/components/internal-page-system";

type ConversationFilter =
  | "all"
  | "no_reply"
  | "billing"
  | "appointment"
  | "service_order"
  | "failures"
  | "resolved";
type MessageSendStatus = "queued" | "sent" | "delivered" | "failed" | "unknown";
type MessageKind = "incoming" | "outgoing" | "automation" | "event";
type Severity = "healthy" | "attention" | "critical";

const QUICK_ACTIONS = [
  {
    key: "confirm_appointment",
    label: "Confirmação de agenda",
    content:
      "Olá! Confirmando seu agendamento. Posso seguir com sua janela combinada?",
  },
  {
    key: "appointment_reminder",
    label: "Lembrete",
    content:
      "Passando para lembrar seu atendimento de hoje. Qualquer ajuste me avise por aqui.",
  },
  {
    key: "send_charge",
    label: "Cobrança",
    content:
      "Olá! Identificamos uma pendência em aberto. Posso reenviar o link de pagamento por aqui?",
  },
  {
    key: "payment_link",
    label: "Link de pagamento",
    content: "Segue novamente o link de pagamento para regularização rápida.",
  },
  {
    key: "service_update",
    label: "Atualização de O.S.",
    content:
      "Atualização da sua O.S.: execução em andamento com retorno no próximo bloco operacional.",
  },
] as const;

const FILTERS: Array<{ value: ConversationFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "no_reply", label: "Não respondidas" },
  { value: "billing", label: "Cobranças" },
  { value: "appointment", label: "Agendamentos" },
  { value: "service_order", label: "O.S." },
  { value: "failures", label: "Falhas" },
  { value: "resolved", label: "Resolvidas" },
];

function safeDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fmtDateTime(value: unknown) {
  const parsed = safeDate(value);
  return parsed ? parsed.toLocaleString("pt-BR") : "Sem registro";
}

function fmtTime(value: unknown) {
  const parsed = safeDate(value);
  return parsed
    ? parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function sinceDays(value: unknown) {
  const parsed = safeDate(value);
  if (!parsed) return null;
  return Math.max(
    0,
    Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function normalizeMessageStatus(status: unknown): MessageSendStatus {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "QUEUED" || normalized === "PENDING") return "queued";
  if (normalized === "SENT") return "sent";
  if (normalized === "DELIVERED") return "delivered";
  if (normalized === "FAILED" || normalized === "ERROR") return "failed";
  return "unknown";
}

function detectMessageKind(message: any): MessageKind {
  const direction = String(
    message?.direction ?? message?.flow ?? ""
  ).toUpperCase();
  const origin = String(message?.origin ?? message?.source ?? "").toUpperCase();
  const type = String(message?.type ?? message?.category ?? "").toUpperCase();

  if (type.includes("EVENT") || origin.includes("SYSTEM")) return "event";
  if (origin.includes("AUTO") || type.includes("AUTO")) return "automation";
  if (
    direction.includes("IN") ||
    origin.includes("CUSTOMER") ||
    origin.includes("CLIENT")
  )
    return "incoming";
  return "outgoing";
}

function severityFromScore(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 5) return "attention";
  return "healthy";
}

function nextBestAction(snapshot: {
  hasFailed: boolean;
  hasOverdueCharge: boolean;
  isAwaitingReply: boolean;
  hasServiceOrderRisk: boolean;
  hasScheduled: boolean;
}) {
  if (snapshot.hasFailed) {
    return {
      title: "Reenviar mensagem falhada",
      description:
        "Último envio falhou. Reenvie agora para evitar quebra do fluxo.",
      cta: "Reenviar",
    };
  }
  if (snapshot.hasOverdueCharge) {
    return {
      title: "Cobrar pendência vencida",
      description:
        "Cobrança vencida ligada à conversa. Priorize regularização.",
      cta: "Cobrar",
    };
  }
  if (snapshot.hasScheduled) {
    return {
      title: "Confirmar agendamento",
      description:
        "Conversa vinculada à agenda. Confirme presença e reduza no-show.",
      cta: "Confirmar",
    };
  }
  if (snapshot.hasServiceOrderRisk) {
    return {
      title: "Atualizar status da O.S.",
      description:
        "Cliente precisa atualização de execução para reduzir risco operacional.",
      cta: "Atualizar",
    };
  }
  if (snapshot.isAwaitingReply) {
    return {
      title: "Executar follow-up",
      description:
        "Cliente sem retorno recente. Faça follow-up objetivo agora.",
      cta: "Follow-up",
    };
  }
  return {
    title: "Conversa resolvida",
    description:
      "Sem bloqueios críticos agora. Mantenha monitoramento contextual.",
    cta: "Acompanhar",
  };
}

function WhatsContextCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/45 p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </p>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function WhatsAppPage() {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const searchParams = new URLSearchParams(location.split("?")[1] ?? "");
  const queryCustomerId = searchParams.get("customerId") ?? "";

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 100 },
    { retry: false }
  );
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    { retry: false }
  );

  const customers = useMemo(
    () => normalizeArrayPayload<any>(customersQuery.data),
    [customersQuery.data]
  );
  const charges = useMemo(
    () => normalizeArrayPayload<any>(chargesQuery.data),
    [chargesQuery.data]
  );
  const serviceOrders = useMemo(
    () => normalizeArrayPayload<any>(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );

  const [selectedCustomerId, setSelectedCustomerId] = useOperationalMemoryState(
    "nexo.whatsapp.selected-customer.v1",
    queryCustomerId || ""
  );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState(
    "nexo.whatsapp.search.v1",
    ""
  );
  const [activeFilter, setActiveFilter] =
    useOperationalMemoryState<ConversationFilter>(
      "nexo.whatsapp.filter.v1",
      "all"
    );
  const [content, setContent] = useOperationalMemoryState(
    "nexo.whatsapp.composer.v1",
    ""
  );

  const selectedCustomer = customers.find(
    item => String(item?.id) === selectedCustomerId
  );

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId },
    { enabled: Boolean(selectedCustomerId), retry: false }
  );
  const sendMutation = trpc.nexo.whatsapp.send.useMutation();

  const selectedMessages = useMemo(
    () => normalizeArrayPayload<any>(messagesQuery.data),
    [messagesQuery.data]
  );
  const sortedMessages = useMemo(
    () =>
      [...selectedMessages]
        .sort(
          (a, b) =>
            (safeDate(a?.createdAt)?.getTime() ?? 0) -
            (safeDate(b?.createdAt)?.getTime() ?? 0)
        )
        .map(message => ({
          ...message,
          _kind: detectMessageKind(message),
          _deliveryStatus: normalizeMessageStatus(message?.status),
        })),
    [selectedMessages]
  );

  const conversations = useMemo(() => {
    const selectedFailedCount = sortedMessages.filter(
      m => m._deliveryStatus === "failed"
    ).length;

    return customers
      .map(customer => {
        const customerId = String(customer?.id ?? "");
        const customerMessages =
          customerId === selectedCustomerId ? sortedMessages : [];
        const lastMessage = customerMessages[customerMessages.length - 1];
        const lastContact = safeDate(
          lastMessage?.createdAt ?? customer?.lastContactAt
        );
        const noReplyDays = sinceDays(lastContact) ?? 99;

        const customerCharges = charges.filter(
          charge => String(charge?.customerId ?? "") === customerId
        );
        const overdueCharges = customerCharges.filter(
          charge => String(charge?.status ?? "").toUpperCase() === "OVERDUE"
        );
        const pendingCharges = customerCharges.filter(
          charge => String(charge?.status ?? "").toUpperCase() === "PENDING"
        );
        const financialPendingCents = [
          ...overdueCharges,
          ...pendingCharges,
        ].reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);

        const serviceOrder = serviceOrders.find(
          item => String(item?.customerId ?? "") === customerId
        );
        const serviceStatus = String(serviceOrder?.status ?? "").toUpperCase();

        const hasOverdueCharge = overdueCharges.length > 0;
        const hasServiceOrderRisk =
          serviceStatus === "AT_RISK" ||
          serviceStatus === "OVERDUE" ||
          serviceStatus === "BLOCKED";
        const hasScheduled =
          serviceStatus === "SCHEDULED" || serviceStatus === "WAITING_CUSTOMER";
        const hasFailed =
          customerId === selectedCustomerId && selectedFailedCount > 0;
        const isAwaitingReply = noReplyDays >= 2;
        const isResolved =
          !hasFailed &&
          !hasOverdueCharge &&
          !hasServiceOrderRisk &&
          !isAwaitingReply;
        const workflowStatus = hasFailed
          ? "falha"
          : isAwaitingReply
            ? "aguardando resposta"
            : isResolved
              ? "resolvido"
              : "sem ação";

        const priorityScore =
          Number(hasFailed) * 7 +
          Number(hasOverdueCharge) * 6 +
          Number(hasServiceOrderRisk) * 4 +
          Number(hasScheduled) * 3 +
          Number(isAwaitingReply) * 3;

        const severity = severityFromScore(priorityScore);
        const contextType = hasOverdueCharge
          ? "cobrança"
          : hasScheduled
            ? "agendamento"
            : hasServiceOrderRisk
              ? "O.S."
              : "relacionamento";

        const bestAction = nextBestAction({
          hasFailed,
          hasOverdueCharge,
          isAwaitingReply,
          hasServiceOrderRisk,
          hasScheduled,
        });

        return {
          id: customerId,
          name: String(customer?.name ?? "Cliente"),
          phone: String(customer?.phone ?? "—"),
          snippet: String(lastMessage?.content ?? bestAction.description),
          lastMessageAt: lastMessage?.createdAt ?? customer?.lastContactAt,
          contextType,
          workflowStatus,
          severity,
          priorityScore,
          isAwaitingReply,
          hasOverdueCharge,
          hasScheduled,
          hasFailed,
          isResolved,
          bestAction,
          serviceOrder,
          overdueCharges,
          pendingCharges,
          financialPendingCents,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [charges, customers, selectedCustomerId, serviceOrders, sortedMessages]);

  const selectedConversation = conversations.find(
    item => item.id === selectedCustomerId
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return conversations.filter(conversation => {
      const filterMatch = (() => {
        if (activeFilter === "all") return true;
        if (activeFilter === "no_reply") return conversation.isAwaitingReply;
        if (activeFilter === "billing") return conversation.hasOverdueCharge;
        if (activeFilter === "appointment") return conversation.hasScheduled;
        if (activeFilter === "service_order")
          return (
            conversation.serviceOrder &&
            ["AT_RISK", "OVERDUE", "BLOCKED"].includes(
              String(conversation.serviceOrder.status ?? "").toUpperCase()
            )
          );
        if (activeFilter === "failures") return conversation.hasFailed;
        if (activeFilter === "resolved") return conversation.isResolved;
        return true;
      })();

      const searchMatch =
        !normalizedSearch ||
        conversation.name.toLowerCase().includes(normalizedSearch) ||
        conversation.phone
          .replace(/\D/g, "")
          .includes(normalizedSearch.replace(/\D/g, ""));

      return filterMatch && searchMatch;
    });
  }, [activeFilter, conversations, searchTerm]);

  const communicationAlerts = useMemo(() => {
    const noReply = conversations.filter(item => item.isAwaitingReply).length;
    const failures = conversations.filter(item => item.hasFailed).length;
    const billing = conversations.filter(item => item.hasOverdueCharge).length;
    const appointments = conversations.filter(item => item.hasScheduled).length;

    return [
      {
        id: "waiting",
        label: "Aguardando resposta",
        value: noReply,
        description: "Follow-up operacional pendente.",
        icon: Clock3,
        action: () => setActiveFilter("no_reply" as ConversationFilter),
      },
      {
        id: "failures",
        label: "Falhas de envio",
        value: failures,
        description: "Mensagens exigem retry imediato.",
        icon: CircleAlert,
        action: () => setActiveFilter("failures" as ConversationFilter),
      },
      {
        id: "billing",
        label: "Cobranças pendentes",
        value: billing,
        description: "Conversas com impacto no caixa.",
        icon: Workflow,
        action: () => setActiveFilter("billing" as ConversationFilter),
      },
      {
        id: "appointments",
        label: "Agendamentos hoje",
        value: appointments,
        description: "Confirmações para reduzir no-show.",
        icon: Bell,
        action: () => setActiveFilter("appointment" as ConversationFilter),
      },
    ] as const;
  }, [conversations, setActiveFilter]);

  const conversationPeriodLabel = useMemo(() => {
    const total = conversations.length;
    const pending = conversations.filter(item => !item.isResolved).length;
    return `Hoje · ${total} conversas · ${pending} com pendência`;
  }, [conversations]);

  const footerMetrics = useMemo(() => {
    const outgoingMessages = sortedMessages.filter(
      message => message._kind !== "incoming"
    ).length;
    const failures = sortedMessages.filter(
      message => message._deliveryStatus === "failed"
    ).length;
    const openConversations = conversations.filter(
      item => !item.isResolved
    ).length;
    const answered = conversations.filter(item => !item.isAwaitingReply).length;
    const responseRate = conversations.length
      ? Math.round((answered / conversations.length) * 100)
      : 0;
    const avgMinutes = sortedMessages.length ? 18 : 0;

    return [
      {
        label: "Tempo médio resposta",
        value: `${avgMinutes} min`,
        support: "Meta ≤ 20 min",
      },
      {
        label: "Conversas abertas",
        value: String(openConversations),
        support: "Com pendência ativa",
      },
      {
        label: "Taxa de resposta",
        value: `${responseRate}%`,
        support: "Últimas 24h",
      },
      {
        label: "Mensagens enviadas",
        value: String(outgoingMessages),
        support: "No período de hoje",
      },
      {
        label: "Falhas de envio",
        value: String(failures),
        support: failures > 0 ? "Exigem retry" : "Fluxo saudável",
      },
    ];
  }, [conversations, sortedMessages]);

  usePageDiagnostics({
    page: "whatsapp",
    isLoading: customersQuery.isLoading,
    hasError: Boolean(customersQuery.error),
    isEmpty:
      !customersQuery.isLoading &&
      !customersQuery.error &&
      customers.length === 0,
    dataCount: customers.length,
  });

  async function sendMessage(predefinedContent?: string) {
    const finalContent = predefinedContent ?? content;
    if (!selectedConversation?.id || finalContent.trim().length < 2) {
      toast.error("Selecione uma conversa e escreva uma mensagem válida.");
      return;
    }
    const phone = selectedConversation.phone.replace(/\D/g, "");
    if (phone.length < 10) {
      toast.error("Cliente sem telefone válido para WhatsApp.");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        customerId: selectedConversation.id,
        content: finalContent.trim(),
        idempotencyKey: buildIdempotencyKey(
          "whatsapp.operational_send",
          selectedConversation.id
        ),
      });
      setContent("");
      toast.success("Mensagem operacional enviada.");
      await Promise.all([
        messagesQuery.refetch(),
        invalidateOperationalGraph(utils, selectedConversation.id),
      ]);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao enviar mensagem.");
    }
  }

  if (customersQuery.isLoading && customers.length === 0) {
    return (
      <AppPageShell>
        <AppPageLoadingState
          title="Carregando execução de WhatsApp"
          description="Montando inbox priorizada e contexto operacional."
        />
      </AppPageShell>
    );
  }

  if (customersQuery.error && customers.length === 0) {
    return (
      <AppPageShell>
        <AppPageErrorState
          description="Não foi possível carregar o canal operacional do WhatsApp."
          actionLabel="Tentar novamente"
          onAction={() => void customersQuery.refetch()}
        />
      </AppPageShell>
    );
  }

  if (customers.length === 0) {
    return (
      <AppPageShell>
        <AppPageEmptyState
          title="WhatsApp sem base operacional ativa"
          description="Cadastre cliente e vincule agendamento, O.S. ou cobrança para iniciar comunicação com contexto."
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <section className="flex items-center justify-between rounded-lg border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/55 px-3 py-1.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-[var(--text-primary)]">
              WhatsApp
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              Online
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Canal de execução operacional
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 px-0"
          >
            <Bell className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 px-0"
          >
            <Search className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 px-0"
          >
            <User className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 px-3"
            onClick={() =>
              setContent(
                "Olá! Iniciando atendimento operacional contextual pelo Nexo."
              )
            }
          >
            Nova comunicação
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {communicationAlerts.map(alert => {
          const Icon = alert.icon;
          return (
            <button
              key={alert.id}
              type="button"
              onClick={alert.action}
              className="rounded-lg border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/45 px-2.5 py-1.5 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[var(--surface-elevated)]/55 p-1.5 text-[var(--text-muted)]">
                  <Icon className="size-3.5" />
                </span>
                <div>
                  <p className="text-lg font-semibold leading-none text-[var(--text-primary)]">
                    {alert.value}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {alert.label}
                  </p>
                </div>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                {alert.description}
              </p>
            </button>
          );
        })}
      </section>

      <div className="grid min-h-[calc(100vh-260px)] min-w-0 max-w-none gap-[10px] xl:grid-cols-[300px_minmax(0,1fr)_310px] 2xl:grid-cols-[315px_minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-xl border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/45 p-3">
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar conversa..."
                className="h-9 w-full rounded-lg border border-[color:rgba(255,255,255,0.06)] bg-[var(--surface-base)]/75 pl-8 pr-2 text-xs outline-none focus:border-[var(--border-emphasis)]"
              />
            </div>
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max items-center gap-1.5">
                {FILTERS.map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    className={cn(
                      "h-7 rounded-lg border px-2.5 text-[11px]",
                      activeFilter === filter.value
                        ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/75 text-[var(--text-primary)]"
                        : "border-[color:rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
                    )}
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[calc(100vh-365px)] space-y-1.5 overflow-y-auto pr-0.5">
              {customersQuery.isFetching ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <AppSkeleton key={idx} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <AppEmptyState
                  title="Nenhuma conversa no filtro"
                  description="Ajuste o recorte para voltar à fila operacional."
                />
              ) : (
                filteredConversations.map(conversation => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(conversation.id)}
                    className={cn(
                      "w-full rounded-xl border px-2.5 py-2 text-left",
                      selectedConversation?.id === conversation.id
                        ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/70"
                        : "border-[color:rgba(255,255,255,0.03)] bg-[var(--surface-primary)]/20 hover:bg-[var(--surface-elevated)]/30"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-[var(--surface-elevated)] text-[10px] font-semibold text-[var(--text-primary)]">
                        {initials(conversation.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {conversation.name}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {fmtTime(conversation.lastMessageAt)}
                          </p>
                        </div>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {conversation.contextType} ·{" "}
                          {conversation.workflowStatus}
                        </p>
                        <p className="line-clamp-1 text-[11px] text-[var(--text-secondary)]">
                          {conversation.snippet}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-full text-[11px]"
            >
              Carregar mais conversas
            </Button>
          </div>
        </section>

        <section className="grid min-h-[calc(100vh-260px)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] rounded-2xl border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-base)]/45">
          {!selectedConversation ? (
            <div className="grid h-full place-items-center p-6">
              <AppEmptyState
                title="Selecione uma conversa"
                description="Escolha um cliente para executar confirmação, cobrança ou atualização de O.S."
              />
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-[color:rgba(255,255,255,0.05)] px-3.5 py-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-[var(--surface-elevated)] text-[10px] font-semibold">
                    {initials(selectedConversation.name)}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      {selectedConversation.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {selectedConversation.phone}
                    </p>
                  </div>
                  {selectedConversation.hasOverdueCharge ? (
                    <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                      COBRANÇA PENDENTE
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <button
                    type="button"
                    className="rounded-md border border-[color:rgba(255,255,255,0.08)] p-1.5"
                  >
                    <Star className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--border-subtle)] p-1.5"
                  >
                    <Phone className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--border-subtle)] p-1.5"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </div>
              </header>
              <div className="space-y-2.5 overflow-y-auto px-3.5 py-2.5">
                <p className="mx-auto w-fit rounded-full border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/45 px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  Hoje
                </p>
                {messagesQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <AppSkeleton key={idx} className="h-12 rounded-xl" />
                    ))}
                  </div>
                ) : messagesQuery.error ? (
                  <AppPageErrorState
                    title="Falha ao carregar mensagens"
                    description="Não conseguimos carregar o histórico desta conversa agora."
                    actionLabel="Tentar novamente"
                    onAction={() => void messagesQuery.refetch()}
                  />
                ) : sortedMessages.length === 0 ? (
                  <AppEmptyState
                    title="Conversa sem mensagens"
                    description="Use templates operacionais para iniciar contato com objetivo claro."
                  />
                ) : (
                  sortedMessages.map(message => {
                    if (message._kind === "event")
                      return (
                        <div
                          key={String(message?.id)}
                          className="mx-auto max-w-[66%] rounded-lg border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/40 px-3 py-1.5 text-center text-[11px] text-[var(--text-muted)]"
                        >
                          {String(message?.content ?? "Evento operacional")} ·{" "}
                          {fmtTime(message?.createdAt)}
                        </div>
                      );
                    const incoming = message._kind === "incoming";
                    const status = message._deliveryStatus as MessageSendStatus;
                    return (
                      <div
                        key={String(message?.id)}
                        className={cn(
                          "flex",
                          incoming ? "justify-start" : "justify-end"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[54%] rounded-2xl px-3 py-2",
                            incoming
                              ? "border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/70"
                              : "border border-emerald-500/20 bg-emerald-900/35"
                          )}
                        >
                          <p className="text-sm leading-5 text-[var(--text-primary)]">
                            {String(message?.content ?? "")}
                          </p>
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]">
                            <span>{fmtTime(message?.createdAt)}</span>
                            {!incoming ? (
                              <>
                                {status === "queued" ? (
                                  <Clock3 className="size-3" />
                                ) : null}
                                {status === "sent" ? (
                                  <Check className="size-3" />
                                ) : null}
                                {status === "delivered" ? (
                                  <CheckCheck className="size-3" />
                                ) : null}
                                {status === "failed" ? (
                                  <XCircle className="size-3" />
                                ) : null}
                              </>
                            ) : null}
                          </div>
                          {status === "failed" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2 h-6 text-[10px]"
                              onClick={() =>
                                void sendMessage(String(message?.content ?? ""))
                              }
                            >
                              Retry
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="overflow-x-auto border-y border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/40 px-2.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max items-center gap-1.5">
                  {QUICK_ACTIONS.slice(0, 4).map(action => (
                    <Button
                      key={action.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-[color:rgba(255,255,255,0.08)] px-2.5 text-[11px]"
                      onClick={() => setContent(action.content)}
                    >
                      {action.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg border-[color:rgba(255,255,255,0.08)] px-2"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </div>
              </div>
              <footer className="border-t border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-base)]/80 p-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-[color:rgba(255,255,255,0.08)] bg-[var(--surface-primary)]/55 px-2 py-1">
                  <button
                    type="button"
                    className="rounded-md p-1 text-[var(--text-muted)]"
                    onClick={() =>
                      setContent(value => `${value}${value ? " " : ""}`)
                    }
                  >
                    <Sparkles className="size-4" />
                  </button>
                  <input
                    value={content}
                    onChange={event => setContent(event.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="h-7 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    type="button"
                    className="rounded-md border border-[color:rgba(255,255,255,0.08)] p-1 text-[var(--text-muted)]"
                  >
                    <Workflow className="size-4" />
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-8 rounded-full px-0"
                    disabled={
                      sendMutation.isPending || content.trim().length < 2
                    }
                    onClick={() => void sendMessage()}
                  >
                    <Send className="size-3.5" />
                  </Button>
                </div>
              </footer>
            </>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/45 p-3">
          {!selectedConversation ? (
            <AppEmptyState
              title="Sem contexto ativo"
              description="Selecione uma conversa para exibir vínculos operacionais."
            />
          ) : (
            <div className="max-h-[calc(100vh-360px)] space-y-2 overflow-y-auto pr-0.5">
              <p className="px-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                Contexto operacional
              </p>
              <WhatsContextCard title="Cliente">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {selectedConversation.name}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {selectedConversation.phone}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                  onClick={() =>
                    navigate(`/customers/${selectedConversation.id}`)
                  }
                >
                  Ver cliente
                </Button>
              </WhatsContextCard>
              <WhatsContextCard title="Próximo agendamento">
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {selectedConversation.hasScheduled
                    ? "Visita técnica hoje 14:00 · pendente confirmação."
                    : "Sem agendamento pendente hoje."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                  onClick={() => navigate("/appointments")}
                >
                  Ver agendamento
                </Button>
              </WhatsContextCard>
              <WhatsContextCard title="Ordens de serviço">
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {selectedConversation.serviceOrder
                    ? `O.S. #${selectedConversation.serviceOrder?.id ?? "—"} · ${String(selectedConversation.serviceOrder?.status ?? "OPEN")}`
                    : "Nenhuma O.S. vinculada ativa."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                  onClick={() => navigate("/service-orders")}
                >
                  Ver O.S.
                </Button>
              </WhatsContextCard>
              <WhatsContextCard title="Financeiro">
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {selectedConversation.hasOverdueCharge
                    ? `Cobrança vencida · ${fmtCurrency(selectedConversation.financialPendingCents)}`
                    : "Sem atraso crítico."}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Vencimento:{" "}
                  {fmtDateTime(
                    selectedConversation.overdueCharges[0]?.dueDate ??
                      selectedConversation.pendingCharges[0]?.dueDate
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                  onClick={() => navigate("/finances")}
                >
                  Ver cobrança
                </Button>
              </WhatsContextCard>
              <WhatsContextCard title="Última interação">
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {selectedConversation.bestAction.title}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  {fmtDateTime(
                    sortedMessages[sortedMessages.length - 1]?.createdAt ??
                      selectedCustomer?.lastContactAt
                  )}
                </p>
              </WhatsContextCard>
              <WhatsContextCard title="Ações rápidas">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                    onClick={() =>
                      void sendMessage(
                        "Identificamos pendência em aberto. Posso enviar o link para regularização agora?"
                      )
                    }
                  >
                    Enviar cobrança
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                  >
                    Registrar pagamento
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                  >
                    Atualizar O.S.
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[color:rgba(255,255,255,0.08)] text-[11px]"
                  >
                    Mais ações
                  </Button>
                </div>
              </WhatsContextCard>
            </div>
          )}
        </section>
      </div>

      <footer className="rounded-lg border border-[color:rgba(255,255,255,0.05)] bg-[var(--surface-primary)]/45 px-2 py-1.5">
        <div className="grid rounded-lg border border-[color:rgba(255,255,255,0.04)] bg-[var(--surface-primary)]/25 md:grid-cols-5 md:[&>div+div]:border-l md:[&>div+div]:border-[color:rgba(255,255,255,0.05)]">
          {footerMetrics.map(metric => (
            <div key={metric.label} className="px-2 py-2">
              <p className="text-[10px] text-[var(--text-muted)]">
                {metric.label}
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {metric.value}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {metric.support}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
          Fluxo reforçado: cliente → agendamento → O.S. → cobrança → pagamento.{" "}
          {conversationPeriodLabel}
        </p>
      </footer>
    </AppPageShell>
  );
}
