import {
  memo,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  CheckCheck,
  EllipsisVertical,
  Info,
  MessageCircleMore,
  Paperclip,
  Search,
  Send,
  Star,
  Volume2,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/design-system";
import { AppPageShell, AppSkeleton } from "@/components/app-system";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AppPageLoadingState,
} from "@/components/internal-page-system";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ConversationFilter =
  | "all"
  | "no_reply"
  | "billing"
  | "failures"
  | "charges"
  | "appointments"
  | "service_orders";

type WhatsAppConversationStatus = "OPEN" | "PENDING" | "RESOLVED" | "FAILED";
type WhatsAppPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
type ContextType = "CUSTOMER" | "CHARGE" | "APPOINTMENT" | "SERVICE_ORDER" | "PAYMENT" | "GENERAL";
type MessageDirection = "INBOUND" | "OUTBOUND";
type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
type OperationalMessageType = "GENERAL" | "APPOINTMENT_CONFIRMATION" | "APPOINTMENT_REMINDER" | "SERVICE_UPDATE" | "PAYMENT_LINK" | "PAYMENT_REMINDER" | "PAYMENT_CONFIRMATION" | "CUSTOMER_NOTIFICATION";
type Customer = { id?: string | number; name?: string; phone?: string | null; [key: string]: any };

type Conversation = {
  id: string;
  conversationId?: string | null;
  customerId?: string | null;
  name: string;
  phone?: string | null;
  title?: string | null;
  lastMessage: string;
  lastMessageAt?: string | null;
  status: WhatsAppConversationStatus;
  contextType: ContextType;
  priority: WhatsAppPriority;
  unreadCount: number;
  contextId?: string | null;
  operationalStatus?: string;
  contextHint?: string | null;
  hasPendingCharge?: boolean;
  hasUpcomingAppointment?: boolean;
  hasActiveServiceOrder?: boolean;
  hasFailedDelivery?: boolean;
  isVirtual?: boolean;
  customer?: { id?: string; name?: string; phone?: string | null } | null;
};

type ChatMessage = {
  id: string;
  direction: MessageDirection;
  content: string;
  createdAt?: string | null;
  status: MessageStatus;
  messageType?: string | null;
  errorMessage?: string | null;
};

type WhatsAppContext = {
  customer?: { id?: string; name?: string; phone?: string } | null;
  nextAppointment?: {
    id?: string;
    scheduledAt?: string;
    status?: string;
    serviceName?: string | null;
  } | null;
  activeServiceOrder?: {
    id?: string;
    number?: string | null;
    status?: string;
    technician?: string | null;
  } | null;
  openCharge?: {
    id?: string;
    amount?: number;
    dueDate?: string;
    status?: string;
    daysOverdue?: number | null;
    paymentLink?: string | null;
  } | null;
  lastInteraction?: {
    direction?: string;
    status?: string;
    createdAt?: string;
  } | null;
  suggestedAction?: {
    type?: string;
    label?: string;
    entityType?: string;
    entityId?: string | null;
  } | null;
};

const FILTERS: Array<{ value: ConversationFilter; label: string; count: string }> = [
  { value: "all", label: "Todas", count: "" },
  { value: "no_reply", label: "Não respondidas", count: "" },
  { value: "billing", label: "Pendências", count: "" },
  { value: "failures", label: "Falhas", count: "" },
];

const QUICK_COMPOSER_TEMPLATES = [
  "Cobrança pendente",
  "Lembrete de agendamento",
  "Confirmação de agendamento",
  "Atualização de O.S.",
  "Mensagem livre",
] as const;

const statusUi: Record<WhatsAppConversationStatus, { label: string; dot: string }> = {
  OPEN: { label: "Aberta", dot: "bg-amber-400" },
  PENDING: { label: "Pendente", dot: "bg-[var(--accent-primary)]" },
  RESOLVED: { label: "Resolvida", dot: "bg-emerald-400" },
  FAILED: { label: "Falha", dot: "bg-rose-400" },
};

const ROW_HEIGHT = 106;
const NO_APPOINTMENT_TEXT = "Sem agendamento futuro";
const NO_SERVICE_ORDER_TEXT = "Nenhuma O.S. ativa";
const NO_CHARGE_TEXT = "Nenhuma cobrança pendente";

function normalizeCustomersPayload(payload: unknown): Customer[] {
  const raw = payload as any;
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  if (Array.isArray(raw?.data?.data)) return raw.data.data;
  if (Array.isArray(raw?.data?.data?.items)) return raw.data.data.items;

  if (Array.isArray(raw?.result?.data)) return raw.result.data;
  if (Array.isArray(raw?.result?.data?.items)) return raw.result.data.items;
  if (Array.isArray(raw?.result?.data?.json)) return raw.result.data.json;
  if (Array.isArray(raw?.result?.data?.json?.data)) return raw.result.data.json.data;
  if (Array.isArray(raw?.result?.data?.json?.items)) return raw.result.data.json.items;
  if (Array.isArray(raw?.result?.data?.json?.data?.items)) return raw.result.data.json.data.items;

  return [];
}

function fmtDateTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapConversation(item: any): Conversation {
  const customerName = item?.customer?.name ?? item?.title ?? "Sem nome";
  const hasPendingCharge = item?.contextType === "CHARGE" && ["OPEN", "PENDING"].includes(String(item?.status ?? "OPEN"));
  const hasUpcomingAppointment = item?.contextType === "APPOINTMENT";
  const hasActiveServiceOrder = item?.contextType === "SERVICE_ORDER";
  const hasFailedDelivery = item?.status === "FAILED";
  const operationalStatus = hasFailedDelivery
    ? "Falha"
    : item?.unreadCount > 0
      ? "Aguardando resposta"
      : hasPendingCharge || hasUpcomingAppointment || hasActiveServiceOrder
        ? "Com pendência"
        : "Resolvido";
  return {
    id: String(item?.id ?? ""),
    conversationId: String(item?.id ?? ""),
    customerId: item?.customerId ?? item?.customer?.id ?? null,
    name: String(customerName),
    phone: item?.phone ?? item?.customer?.phone ?? null,
    title: item?.title ?? null,
    lastMessage: String(item?.lastMessagePreview ?? item?.title ?? "Sem mensagens"),
    lastMessageAt: item?.lastMessageAt ?? null,
    status: (item?.status ?? "OPEN") as WhatsAppConversationStatus,
    contextType: (item?.contextType ?? "GENERAL") as ContextType,
    priority: (item?.priority ?? "NORMAL") as WhatsAppPriority,
    unreadCount: Number(item?.unreadCount ?? 0),
    contextId: item?.contextId ?? null,
    operationalStatus,
    contextHint: item?.title ?? item?.lastMessagePreview ?? null,
    hasPendingCharge,
    hasUpcomingAppointment,
    hasActiveServiceOrder,
    hasFailedDelivery,
    isVirtual: false,
    customer: item?.customer
      ? {
        id: item?.customer?.id ? String(item.customer.id) : undefined,
        name: item?.customer?.name ? String(item.customer.name) : undefined,
        phone: item?.customer?.phone ? String(item.customer.phone) : undefined,
      }
      : null,
  };
}

function mapMessage(item: any): ChatMessage {
  return {
    id: String(item?.id ?? ""),
    direction: (item?.direction ?? "OUTBOUND") as MessageDirection,
    content: String(item?.renderedText ?? item?.content ?? ""),
    createdAt: item?.createdAt ?? null,
    status: (item?.status ?? "QUEUED") as MessageStatus,
    messageType: item?.messageType ?? null,
    errorMessage: item?.errorMessage ?? item?.lastError ?? null,
  };
}

function resolveMessageTypeFromContext(context?: WhatsAppContext | null): OperationalMessageType {
  if (context?.openCharge?.id && context?.openCharge?.paymentLink) return "PAYMENT_LINK";
  if (context?.openCharge?.id && (context?.openCharge?.daysOverdue ?? 0) > 0) return "PAYMENT_REMINDER";
  if (context?.openCharge?.id) return "CUSTOMER_NOTIFICATION";
  if (context?.nextAppointment?.id) return "APPOINTMENT_REMINDER";
  if (context?.activeServiceOrder?.id) return "SERVICE_UPDATE";
  return "GENERAL";
}

function resolveEntityFromContext(context?: WhatsAppContext | null) {
  if (context?.openCharge?.id) return { entityType: "CHARGE", entityId: context.openCharge.id };
  if (context?.nextAppointment?.id) return { entityType: "APPOINTMENT", entityId: context.nextAppointment.id };
  if (context?.activeServiceOrder?.id) {
    return { entityType: "SERVICE_ORDER", entityId: context.activeServiceOrder.id };
  }
  if (context?.customer?.id) return { entityType: "CUSTOMER", entityId: context.customer.id };
  return { entityType: "GENERAL", entityId: undefined };
}

function getOperationalStatus(conversation: Conversation) {
  if (conversation.conversationId) return conversation.operationalStatus ?? "Resolvido";
  return "Sem conversa ativa";
}

function priorityScore(conversation: Conversation) {
  if (!conversation.conversationId) return 700;
  if (conversation.hasFailedDelivery || conversation.status === "FAILED") return 100;
  if (conversation.unreadCount > 0) return 200;
  if (conversation.hasPendingCharge || conversation.contextType === "CHARGE") return 300;
  if (conversation.hasUpcomingAppointment || conversation.contextType === "APPOINTMENT") return 400;
  if (conversation.hasActiveServiceOrder || conversation.contextType === "SERVICE_ORDER") return 500;
  return 600;
}

function buildTemplateText(template: string, context?: WhatsAppContext | null) {
  const customerName = context?.customer?.name ?? "cliente";
  const appointmentDate = context?.nextAppointment?.scheduledAt
    ? fmtDateTime(context.nextAppointment.scheduledAt)
    : "data a confirmar";
  const chargeAmount = context?.openCharge?.amount
    ? `R$ ${(context.openCharge.amount / 100).toFixed(2).replace(".", ",")}`
    : "valor pendente";
  const chargeDueDate = context?.openCharge?.dueDate ? fmtDateTime(context.openCharge.dueDate) : "sem vencimento";

  if (template === "Confirmação de agendamento") {
    return `Olá ${customerName}, confirmando seu agendamento em ${appointmentDate}.`;
  }
  if (template === "Lembrete" || template === "Lembrete de agendamento") {
    return `Olá ${customerName}, passando para lembrar do seu atendimento/pendência.`;
  }
  if (template === "Cobrança simples") {
    return `Olá ${customerName}, identificamos uma cobrança em aberto (${chargeAmount}, vencimento ${chargeDueDate}).`;
  }
  if (template === "Cobrança pendente") {
    return `Olá ${customerName}, sua cobrança (${chargeAmount}) segue pendente. Vencimento: ${chargeDueDate}.`;
  }
  if (template === "Atualização de O.S.") {
    return `Olá ${customerName}, atualizando sua ordem de serviço: status ${context?.activeServiceOrder?.status ?? "em andamento"}.`;
  }
  if (template === "Confirmação de pagamento") {
    return `Olá ${customerName}, pagamento confirmado com sucesso.`;
  }
  if (template === "Mensagem livre") {
    return `Olá ${customerName}, tudo bem?`;
  }
  if (template === "Link de pagamento") {
    return `Olá ${customerName}, segue o link para pagamento: ${context?.openCharge?.paymentLink ?? "(link indisponível)"}`;
  }
  return template;
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  selectedId,
  onSelect,
  style,
}: {
  conversation: Conversation;
  selectedId: string;
  onSelect: (id: string) => void;
  style: CSSProperties;
}) {
  const status = statusUi[conversation.status] ?? statusUi.OPEN;
  const operational = getOperationalStatus(conversation);

  return (
    <div style={style} className="px-0.5 py-1">
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className={cn(
          "w-full rounded-xl px-3 py-2.5 text-left transition",
          selectedId === conversation.id
            ? "bg-[var(--accent-soft)]/28"
            : "bg-white/[0.015] hover:bg-white/[0.045]"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                selectedId === conversation.id
                  ? "border-[var(--accent-primary)]/55 bg-[var(--accent-soft)]/70 text-[var(--accent-primary)]"
                  : "border-white/[0.12] bg-white/[0.04] text-[var(--text-secondary)]"
              )}
            >
              {conversation.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{conversation.name}</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">{conversation.phone ?? "Telefone não informado"}</p>
              {conversation.title ? (
                <p className="truncate text-[11px] text-[var(--accent-primary)]/90">{conversation.title}</p>
              ) : null}
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{fmtTime(conversation.lastMessageAt)}</span>
        </div>
        <p className="mt-1.5 line-clamp-1 text-xs text-[var(--text-secondary)]">{conversation.contextHint ?? conversation.lastMessage}</p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            {operational}
          </span>
          {conversation.unreadCount ? (
            <span className="rounded-full border border-amber-400/35 bg-amber-500/20 px-1.5 py-0.5 text-[10px] leading-none text-amber-100">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </button>
    </div>
  );
});

function ConversationsList({
  rows,
  selectedId,
  onSelect,
  filter,
  onFilter,
  search,
  onSearch,
  isLoading,
  hasError,
  errorMessage,
  emptyStateMessage,
}: {
  rows: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: ConversationFilter;
  onFilter: (next: ConversationFilter) => void;
  search: string;
  onSearch: (next: string) => void;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  emptyStateMessage: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    setViewportHeight(node.clientHeight);
  }, []);

  const totalHeight = rows.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + 8;
  const visibleRows = rows.slice(startIndex, startIndex + visibleCount);

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white/[0.015] p-2.5">
      <div className="shrink-0 space-y-2 pb-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Inbox</p>
          <button type="button" className="rounded-lg bg-white/[0.02] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-white/[0.05]">Filtros</button>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5">
          <Search className="size-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="h-7 w-full bg-transparent text-xs outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(item => (
            <button
              key={item.value}
              type="button"
              className={cn(
                "h-7.5 rounded-full px-2.5 text-[11px]",
                filter === item.value
                  ? "bg-[var(--accent-soft)]/45 text-[var(--accent-primary)]"
                  : "bg-white/[0.02] text-[var(--text-muted)]"
              )}
              onClick={() => onFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={viewportRef}
        className="scrollbar-thin-nexo mt-2 flex-1 min-h-0 overflow-y-auto pr-1"
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <AppSkeleton key={idx} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] px-2.5 py-3">
            <div className="mb-2 h-px w-full bg-white/[0.06]" />
            <p className="text-xs text-[var(--text-secondary)]">
              {hasError
                ? (errorMessage ?? "Não foi possível carregar conversas")
                : emptyStateMessage}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {hasError
                ? "Tente novamente em instantes."
                : search.trim()
                  ? "Limpe a busca ou altere os filtros."
                  : "As conversas reais aparecerão aqui quando clientes responderem ou mensagens forem enviadas."}
            </p>
          </div>
        ) : (
          <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${startIndex * ROW_HEIGHT}px)` }}>
              {visibleRows.map(conversation => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selectedId={selectedId ?? ""}
                  onSelect={onSelect}
                  style={{ height: ROW_HEIGHT }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function ChatPanel({
  conversation,
  canCompose,
  composePlaceholder,
  messages,
  isLoading,
  sendMessage,
  content,
  setContent,
  onToggleFavorite,
  isFavorite,
  onInfo,
  onMoreActions,
  error,
  onOpenCustomer,
  onOpenFinance,
  onOpenAppointment,
  onOpenServiceOrder,
  onFillTemplate,
  canMarkAsPaid,
}: {
  conversation?: Conversation;
  canCompose: boolean;
  composePlaceholder: string;
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: () => void;
  content: string;
  setContent: (value: string) => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  onInfo: () => void;
  onMoreActions: () => void;
  error?: string | null;
  onOpenCustomer: () => void;
  onOpenFinance: () => void;
  onOpenAppointment: () => void;
  onOpenServiceOrder: () => void;
  onFillTemplate: (template: string) => void;
  canMarkAsPaid: boolean;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const hasConversation = Boolean(conversation);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [conversation?.id, messages.length]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white/[0.015]">
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-[var(--accent-primary)]/25 bg-[var(--accent-soft)]/60 text-sm font-semibold text-[var(--accent-primary)]">
            {conversation?.name?.slice(0, 1) ?? "-"}
          </div>
          <div>
            <p className="text-sm font-semibold">{conversation?.name ?? "Selecione uma conversa"}</p>
            <p className="text-xs text-[var(--text-muted)]">{conversation?.phone ?? "Nenhuma conversa ativa"}</p>
            {conversation?.conversationId ? (
              <p className="text-[10px] text-[var(--text-muted)]">{conversation.title ?? getOperationalStatus(conversation)}</p>
            ) : null}
            {!conversation?.conversationId && conversation ? (
              <span className="mt-1 inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100">
                Sem conversa ativa
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <button
            type="button"
            className="rounded-lg p-1.5 enabled:hover:bg-white/10 disabled:opacity-45"
            onClick={onToggleFavorite}
            disabled={!hasConversation}
          >
            <Star className={cn("size-4.5", isFavorite ? "fill-yellow-400 text-yellow-300" : "")} />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 enabled:hover:bg-white/10 disabled:opacity-45"
            onClick={onInfo}
            disabled={!hasConversation}
          >
            <Info className="size-4.5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 enabled:hover:bg-white/10 disabled:opacity-45"
            onClick={onMoreActions}
            disabled={!hasConversation}
          >
            <EllipsisVertical className="size-4.5" />
          </button>
        </div>
      </header>

      <div ref={messagesRef} className="scrollbar-thin-nexo flex-1 min-h-0 overflow-y-auto bg-transparent px-5 pb-1 pt-4">
        {!hasConversation ? (
          <div className="flex h-full items-center justify-center px-1 py-4 text-xs text-[var(--text-muted)]">
            Selecione um cliente ou conversa para continuar.
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <AppSkeleton key={idx} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="px-1 py-4 text-xs text-[var(--text-muted)]">Sem mensagens nesta conversa.</div>
        ) : (
          <div className="space-y-3.5">
            {messages.map(message => {
              const outgoing = message.direction === "OUTBOUND";
              return (
                <div key={message.id} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
                      outgoing
                        ? "max-w-[66%] border-emerald-400/20 bg-emerald-900/55"
                        : "max-w-[68%] border-white/[0.08] bg-white/[0.03]"
                    )}
                  >
                    <p>{message.content}</p>
                    <p className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]/85">
                      {fmtTime(message.createdAt)} · {message.status}{message.messageType ? ` · ${message.messageType}` : ""}
                      {outgoing && ["DELIVERED", "READ"].includes(message.status) ? (
                        <CheckCheck className="size-3" />
                      ) : null}
                    </p>
                    {message.status === "FAILED" ? (
                      <p className="mt-1 text-[10px] text-rose-300">{message.errorMessage ?? "Falha de entrega. Use reenviar nas ações."}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="shrink-0 mt-0 border-y border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 shrink-0 px-3 text-[11px]"
                disabled={!hasConversation}
              >
                Enviar mensagem
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <div className="space-y-1">
                {QUICK_COMPOSER_TEMPLATES.map((template) => (
                  <Button
                    key={template}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-full justify-start px-2 text-[11px]"
                    onClick={() => onFillTemplate(template)}
                  >
                    {template}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 shrink-0 px-3 text-[11px]"
                disabled={!hasConversation}
              >
                Mais ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={onOpenCustomer}>Abrir cliente</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenFinance}>Abrir financeiro</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFillTemplate("Cobrança pendente")}>Enviar cobrança</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFillTemplate("Confirmação de agendamento")}>Confirmar agendamento</DropdownMenuItem>
              <DropdownMenuItem onClick={onMoreActions}>Atualizar status</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenServiceOrder}>Abrir O.S.</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="rounded-lg p-2 enabled:hover:bg-white/10 disabled:opacity-45"
            disabled={!hasConversation}
          >
            <MessageCircleMore className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 enabled:hover:bg-white/10 disabled:opacity-45"
            disabled={!hasConversation}
          >
            <Paperclip className="size-4" />
          </button>
          <input
            value={content}
            onChange={event => canCompose && setContent(event.target.value)}
            placeholder={hasConversation ? composePlaceholder : "Selecione uma conversa para responder..."}
            disabled={!hasConversation || !canCompose}
            className="h-9 min-w-0 flex-1 rounded-lg bg-white/[0.02] px-3 text-sm outline-none placeholder:text-[var(--text-muted)]/70"
          />
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full bg-emerald-600/85 px-3 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={sendMessage}
            disabled={!hasConversation || !canCompose}
          >
            <Send className="size-3.5" />
          </Button>
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 enabled:hover:bg-white/10 disabled:opacity-45"
            disabled={!hasConversation}
          >
            <Volume2 className="size-4" />
          </button>
        </div>
      </footer>
      {error ? <p className="px-3 pb-2 text-[11px] text-rose-300">{error}</p> : null}
    </section>
  );
}

function ContextPanel({
  context,
  conversation,
  selectedCustomer,
  isLoading,
  onNavigate,
  onSendCharge,
  onSendReminder,
  onMoreActions,
  highlightedChargeId,
  highlightedAppointmentId,
  highlightedServiceOrderId,
}: {
  context?: WhatsAppContext | null;
  conversation?: Conversation;
  selectedCustomer?: any | null;
  isLoading: boolean;
  onNavigate: (path: string) => void;
  onSendCharge: () => void;
  onSendReminder: () => void;
  onMoreActions: () => void;
  highlightedChargeId?: string | null;
  highlightedAppointmentId?: string | null;
  highlightedServiceOrderId?: string | null;
}) {
  if (!conversation && !selectedCustomer) {
    return (
      <aside className="scrollbar-thin-nexo h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-white/[0.015] p-2.5" id="whatsapp-context-panel">
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-3 py-3">
          <p className="text-xs font-semibold">Sem contexto ativo</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Selecione uma conversa para ver cliente, agendamento, O.S. e cobrança vinculados.
          </p>
          <div className="mt-3 space-y-1.5 text-[11px] text-[var(--text-muted)]">
            <p>Cliente — aguardando conversa</p>
            <p>Próximo agendamento — aguardando contexto</p>
            <p>Cobrança aberta — aguardando contexto</p>
            <p>Última interação — aguardando conversa</p>
          </div>
        </section>
      </aside>
    );
  }

  const hasCharge = Boolean(context?.openCharge?.id);
  const hasAppointment = Boolean(context?.nextAppointment?.id);
  const hasServiceOrder = Boolean(context?.activeServiceOrder?.id);

  return (
    <aside className="scrollbar-thin-nexo h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-white/[0.015] p-2.5" id="whatsapp-context-panel">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <AppSkeleton key={idx} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-5 text-xs">
          <section className="px-1 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Cliente</p>
            <p className="mt-1 font-semibold">{context?.customer?.name ?? selectedCustomer?.name ?? conversation?.name ?? "Sem nome"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{context?.customer?.phone ?? selectedCustomer?.phone ?? conversation?.phone ?? "--"}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-7 text-[11px]"
              onClick={() => onNavigate(context?.customer?.id ? `/customers?customerId=${context.customer.id}` : "/customers")}
            >
              Ver cliente
            </Button>
          </section>

          <section className="px-1 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Próximo agendamento</p>
            <p className="mt-1 font-medium">{context?.nextAppointment?.serviceName ?? NO_APPOINTMENT_TEXT}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{context?.nextAppointment?.scheduledAt ? fmtDateTime(context?.nextAppointment?.scheduledAt) : NO_APPOINTMENT_TEXT}</p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">{context?.nextAppointment?.status ?? "--"}</span>
            {highlightedAppointmentId && context?.nextAppointment?.id === highlightedAppointmentId ? (
              <p className="mt-1 text-[10px] text-[var(--accent-primary)]">Sugestão: Confirmar agendamento.</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-7 text-[11px]"
              disabled={!hasAppointment}
              onClick={() => context?.nextAppointment?.id && onNavigate(`/appointments?appointmentId=${context.nextAppointment.id}`)}
            >
              Ver agendamento
            </Button>
          </section>

          <section className="px-1 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Ordem de serviço</p>
            <p className="mt-1 font-medium">{context?.activeServiceOrder?.number ? `OS #${context.activeServiceOrder.number}` : NO_SERVICE_ORDER_TEXT}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Status: {context?.activeServiceOrder?.status ?? "--"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Técnico: {context?.activeServiceOrder?.technician ?? "--"}</p>
            {highlightedServiceOrderId && context?.activeServiceOrder?.id === highlightedServiceOrderId ? (
              <p className="mt-1 text-[10px] text-[var(--accent-primary)]">Sugestão: Atualizar cliente sobre serviço.</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-7 text-[11px]"
              disabled={!hasServiceOrder}
              onClick={() => context?.activeServiceOrder?.id && onNavigate(`/service-orders?serviceOrderId=${context.activeServiceOrder.id}`)}
            >
              Ver O.S.
            </Button>
          </section>

          <section className="px-1 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Cobrança</p>
            <p className="mt-1 font-medium">{context?.openCharge?.id ? `Cobrança #${context.openCharge.id}` : NO_CHARGE_TEXT}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Vencimento: {fmtDateTime(context?.openCharge?.dueDate)}</p>
            <p className="text-[11px]">
              Valor: {context?.openCharge?.amount ? `R$ ${(context.openCharge.amount / 100).toFixed(2).replace(".", ",")}` : "--"}
            </p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100">{context?.openCharge?.status ?? "--"}</span>
            {highlightedChargeId && context?.openCharge?.id === highlightedChargeId ? (
              <p className="mt-1 text-[10px] text-[var(--accent-primary)]">Sugestão: Enviar cobrança.</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-7 text-[11px]"
              disabled={!hasCharge}
              onClick={() => context?.openCharge?.id && onNavigate(`/finances?chargeId=${context.openCharge.id}`)}
            >
              Ver cobrança
            </Button>
          </section>

          <section className="px-1 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Última interação</p>
            <p className="mt-1">{context?.lastInteraction?.direction ?? "--"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{fmtDateTime(context?.lastInteraction?.createdAt)}</p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">{context?.lastInteraction?.status ?? "--"}</span>
          </section>

          <section className="px-1 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Ações rápidas</p>
            <div className="mt-2.5 grid grid-cols-1 gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]" onClick={onSendCharge}>Enviar cobrança</Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]"
                onClick={() => onNavigate(context?.openCharge?.id ? `/finances?chargeId=${context.openCharge.id}&action=register-payment` : "/finances")}
              >
                Registrar pagamento
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]" onClick={onSendReminder}>Enviar lembrete</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]" onClick={onMoreActions}>Mais ações</Button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

export default function WhatsAppPage() {
  const [location, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);
  const queryConversationId = searchParams.get("conversationId");
  const queryCustomerId = searchParams.get("customerId");
  const queryChargeId = searchParams.get("chargeId");
  const queryAppointmentId = searchParams.get("appointmentId");
  const queryServiceOrderId = searchParams.get("serviceOrderId");

  const [selectedConversationId, setSelectedConversationId] = useOperationalMemoryState<string | null>(
    "nexo.whatsapp.selected-conversation.v1",
    queryConversationId ?? (queryCustomerId ? `customer:${queryCustomerId}` : null)
  );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState("nexo.whatsapp.search.v2", "");
  const [activeFilter, setActiveFilter] = useOperationalMemoryState<ConversationFilter>(
    "nexo.whatsapp.filter.v2",
    "all"
  );
  const [content, setContent] = useOperationalMemoryState("nexo.whatsapp.composer.v2", "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [isContextVisible, setIsContextVisible] = useState(true);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [localFavorites, setLocalFavorites] = useState<Record<string, boolean>>({});
  const didAutoSelectFromQueryRef = useRef(false);
  const hasManualSelectionRef = useRef(false);
  const shouldPromoteVirtualSelectionRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filtersInput = useMemo(() => {
    const input: Record<string, unknown> = {};
    if (activeFilter === "no_reply") input.onlyUnread = true;
    if (activeFilter === "billing") input.onlyPending = true;
    if (activeFilter === "failures") input.onlyFailed = true;
    if (activeFilter === "charges") input.contextType = "CHARGE";
    if (activeFilter === "appointments") input.contextType = "APPOINTMENT";
    if (activeFilter === "service_orders") input.contextType = "SERVICE_ORDER";
    return input;
  }, [activeFilter, debouncedSearch]);

  const healthQuery = trpc.nexo.whatsapp.health.useQuery(undefined, { retry: false });
  const conversationsQuery = trpc.nexo.whatsapp.listConversations.useQuery(filtersInput, {
    retry: false,
  });

  const conversations = useMemo(
    () => (Array.isArray(conversationsQuery.data) ? conversationsQuery.data.map(mapConversation) : []),
    [conversationsQuery.data]
  );
  const customersQuery = trpc.nexo.customers.list.useQuery(
    { page: 1, limit: 300 },
    { retry: false, enabled: true }
  );
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 500 }, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 500 }, { retry: false });
  const customers = useMemo(
    () => normalizeCustomersPayload(customersQuery.data),
    [customersQuery.data]
  );
  const appointments = useMemo(() => {
    const raw = appointmentsQuery.data as any;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
  }, [appointmentsQuery.data]);
  const serviceOrders = useMemo(() => {
    const raw = serviceOrdersQuery.data as any;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
  }, [serviceOrdersQuery.data]);
  const charges = useMemo(() => {
    const raw = chargesQuery.data as any;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
  }, [chargesQuery.data]);

  const conversationCustomerIds = useMemo(
    () =>
      new Set(
        conversations
          .map(item => item.customerId ?? item.customer?.id ?? null)
          .filter((id): id is string => Boolean(id))
      ),
    [conversations]
  );
  const customersWithoutConversation = useMemo(
    () =>
      customers
        .filter((customer: any) => customer?.id && !conversationCustomerIds.has(String(customer.id)))
        .map((customer: any): Conversation => ({
          id: `customer:${String(customer.id)}`,
          conversationId: null,
          customerId: String(customer.id),
          name: String(customer?.name ?? "Sem nome"),
          phone: customer?.phone ? String(customer.phone) : null,
          title: "Sem conversa ativa",
          lastMessage: "Sem conversa ativa",
          lastMessageAt: null,
          status: "OPEN",
          contextType: "GENERAL",
          priority: "LOW",
          unreadCount: 0,
          contextId: String(customer.id),
          operationalStatus: "Sem conversa ativa",
          contextHint: "Sem conversa ativa",
          hasPendingCharge: charges.some((charge: any) => String(charge?.customerId ?? "") === String(customer.id) && ["PENDING", "OVERDUE"].includes(String(charge?.status ?? ""))),
          hasUpcomingAppointment: appointments.some((appointment: any) => String(appointment?.customerId ?? "") === String(customer.id) && String(appointment?.status ?? "").toUpperCase() !== "CANCELED"),
          hasActiveServiceOrder: serviceOrders.some((serviceOrder: any) => String(serviceOrder?.customerId ?? "") === String(customer.id) && !["DONE", "CANCELED"].includes(String(serviceOrder?.status ?? "").toUpperCase())),
          hasFailedDelivery: false,
          isVirtual: true,
          customer: {
            id: String(customer.id),
            name: String(customer?.name ?? "Sem nome"),
            phone: customer?.phone ? String(customer.phone) : null,
          },
        })),
    [appointments, charges, conversationCustomerIds, customers, serviceOrders]
  );
  const buildVirtualRowFromCustomer = useCallback((customer: any): Conversation => ({
    id: `customer:${String(customer.id)}`,
    conversationId: null,
    customerId: String(customer.id),
    name: String(customer?.name ?? "Sem nome"),
    phone: customer?.phone ? String(customer.phone) : null,
    title: "Sem conversa ativa",
    lastMessage: "Sem conversa ativa",
    lastMessageAt: null,
    status: "OPEN",
    contextType: "GENERAL",
    priority: "LOW",
    unreadCount: 0,
    contextId: String(customer.id),
    operationalStatus: "Sem conversa ativa",
    contextHint: "Sem conversa ativa",
    hasPendingCharge: charges.some((charge: any) => String(charge?.customerId ?? "") === String(customer.id) && ["PENDING", "OVERDUE"].includes(String(charge?.status ?? ""))),
    hasUpcomingAppointment: appointments.some((appointment: any) => String(appointment?.customerId ?? "") === String(customer.id) && String(appointment?.status ?? "").toUpperCase() !== "CANCELED"),
    hasActiveServiceOrder: serviceOrders.some((serviceOrder: any) => String(serviceOrder?.customerId ?? "") === String(customer.id) && !["DONE", "CANCELED"].includes(String(serviceOrder?.status ?? "").toUpperCase())),
    hasFailedDelivery: false,
    isVirtual: true,
    customer: {
      id: String(customer.id),
      name: String(customer?.name ?? "Sem nome"),
      phone: customer?.phone ? String(customer.phone) : null,
    },
  }), [appointments, charges, serviceOrders]);
  const allInboxRows = useMemo(
    () => [...conversations, ...customersWithoutConversation],
    [conversations, customersWithoutConversation]
  );
  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return allInboxRows.filter(item => {
      const searchable = [
        item.customer?.name ?? item.name,
        item.customer?.phone ?? item.phone ?? "",
        item.title ?? "",
        item.phone ?? "",
        item.lastMessage,
        item.contextHint ?? "",
        item.operationalStatus ?? "",
      ].join(" ").toLowerCase();
      const matchesSearch = !query
        || searchable.includes(query);
      if (!matchesSearch) return false;
      if (activeFilter === "all") return true;
      if (!item.conversationId) return Boolean(query);
      if (activeFilter === "no_reply") return item.unreadCount > 0;
      if (activeFilter === "billing") return item.status === "PENDING";
      if (activeFilter === "failures") return item.status === "FAILED";
      if (activeFilter === "charges") return item.contextType === "CHARGE";
      if (activeFilter === "appointments") return item.contextType === "APPOINTMENT";
      if (activeFilter === "service_orders") return item.contextType === "SERVICE_ORDER";
      return true;
    }).sort((a, b) => {
      const scoreDiff = priorityScore(a) - priorityScore(b);
      if (scoreDiff !== 0) return scoreDiff;
      const aDate = new Date(a.lastMessageAt ?? 0).getTime();
      const bDate = new Date(b.lastMessageAt ?? 0).getTime();
      return bDate - aDate;
    });
  }, [activeFilter, allInboxRows, debouncedSearch]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[WhatsAppPage][customers-debug]", {
      queryParams: {
        customerId: queryCustomerId,
        conversationId: queryConversationId,
        chargeId: queryChargeId,
        appointmentId: queryAppointmentId,
        serviceOrderId: queryServiceOrderId,
      },
      rawCustomersQueryData: customersQuery.data,
      normalizedCustomersLength: customers.length,
      firstNormalizedCustomer: customers[0] ?? null,
      conversationsLength: conversations.length,
      customersWithoutConversationLength: customersWithoutConversation.length,
      allInboxRowsLength: allInboxRows.length,
      filteredRowsLength: filteredRows.length,
    });
  }, [
    allInboxRows.length,
    conversations.length,
    customers,
    customersQuery.data,
    customersWithoutConversation.length,
    filteredRows.length,
    queryAppointmentId,
    queryChargeId,
    queryConversationId,
    queryCustomerId,
    queryServiceOrderId,
  ]);
  const emptyStateMessage = useMemo(() => {
    if (customersQuery.error) return "Erro ao carregar clientes";
    if (!customersQuery.isLoading && !customersQuery.isFetching && customers.length === 0) {
      return "Nenhum cliente carregado";
    }
    if (allInboxRows.length > 0 && filteredRows.length === 0) return "Nenhum resultado para esta busca";
    if (debouncedSearch.trim()) return "Nenhum resultado para esta busca";
    if (activeFilter === "failures") return "Nenhuma falha encontrada.";
    return "Nenhum cliente encontrado.";
  }, [
    activeFilter,
    allInboxRows.length,
    customers.length,
    customersQuery.error,
    customersQuery.isFetching,
    customersQuery.isLoading,
    debouncedSearch,
    filteredRows.length,
  ]);

  const selectedConversation = useMemo(
    () =>
      filteredRows.find(item => item.id === selectedConversationId)
      ?? allInboxRows.find(item => item.id === selectedConversationId),
    [allInboxRows, filteredRows, selectedConversationId]
  );
  const selectedConversationRecordId = selectedConversation?.conversationId ?? null;

  useEffect(() => {
    if (hasManualSelectionRef.current) return;
    const conversationsReady = !conversationsQuery.isLoading && !conversationsQuery.isFetching;
    const customersReady = !customersQuery.isLoading && !customersQuery.isFetching;
    if ((queryCustomerId || queryConversationId) && !didAutoSelectFromQueryRef.current && conversationsReady && customersReady) {
      if (queryConversationId) {
        const byConversation = allInboxRows.find(item => item.conversationId === queryConversationId || item.id === queryConversationId);
        if (byConversation) {
          setSelectedConversationId(byConversation.id);
          didAutoSelectFromQueryRef.current = true;
          return;
        }
      }
      if (queryCustomerId) {
        const existingConversation = allInboxRows.find(item => item.customerId === queryCustomerId && Boolean(item.conversationId));
        const virtualCustomer = allInboxRows.find(item => item.id === `customer:${queryCustomerId}`)
          ?? (() => {
            const customer = customers.find((item: any) => String(item?.id ?? "") === String(queryCustomerId));
            return customer ? buildVirtualRowFromCustomer(customer) : null;
          })();
        if (!existingConversation && !virtualCustomer && import.meta.env.DEV) {
          console.debug("[WhatsAppPage] customerId from URL not found in customers dataset", {
            queryCustomerId,
            normalizedCustomersLength: customers.length,
          });
        }
        const nextSelection = existingConversation ?? virtualCustomer;
        if (nextSelection?.id) {
          setSelectedConversationId(nextSelection.id);
        }
      }
      didAutoSelectFromQueryRef.current = true;
      return;
    }

    if (!selectedConversationId && filteredRows.length > 0) {
      setSelectedConversationId(filteredRows[0]?.id ?? null);
    }
  }, [
    allInboxRows,
    conversationsQuery.isFetching,
    conversationsQuery.isLoading,
    customersQuery.isFetching,
    customersQuery.isLoading,
    filteredRows,
    queryConversationId,
    queryCustomerId,
    selectedConversationId,
    setSelectedConversationId,
    buildVirtualRowFromCustomer,
    customers,
  ]);

  useEffect(() => {
    if (!selectedConversationId) {
      setContent("");
      setComposerError(null);
    }
  }, [selectedConversationId, setContent]);

  useEffect(() => {
    if (!selectedConversationId?.startsWith("customer:")) return;
    if (!shouldPromoteVirtualSelectionRef.current) return;
    const customerId = selectedConversation?.customerId;
    if (!customerId) return;
    const existingConversation = conversations.find(
      (item) => item.customerId === customerId && Boolean(item.conversationId)
    );
    if (existingConversation?.id && existingConversation.id !== selectedConversationId) {
      shouldPromoteVirtualSelectionRef.current = false;
      setSelectedConversationId(existingConversation.id);
    }
  }, [conversations, selectedConversation?.customerId, selectedConversationId, setSelectedConversationId]);

  const conversationDetailsQuery = trpc.nexo.whatsapp.getConversation.useQuery(
    { id: selectedConversationRecordId ?? "" },
    { enabled: Boolean(selectedConversationRecordId), retry: false }
  );

  const messagesQuery = trpc.nexo.whatsapp.getMessages.useQuery(
    { conversationId: selectedConversationRecordId ?? "" },
    { enabled: Boolean(selectedConversationRecordId), retry: false }
  );
  const contextQuery = trpc.nexo.whatsapp.getContext.useQuery(
    { conversationId: selectedConversationRecordId ?? "" },
    { enabled: Boolean(selectedConversationRecordId), retry: false }
  );

  const sendMessageMutation = trpc.nexo.whatsapp.sendMessage.useMutation();
  const sendTemplateMutation = trpc.nexo.whatsapp.sendTemplate.useMutation();
  const retryMessageMutation = trpc.nexo.whatsapp.retryMessage.useMutation();

  const messages = useMemo(
    () =>
      selectedConversationRecordId && Array.isArray(messagesQuery.data)
        ? messagesQuery.data.map(mapMessage).reverse()
        : [],
    [messagesQuery.data, selectedConversationRecordId]
  );
  const selectedCustomer = useMemo(
    () => {
      const activeCustomerId = selectedConversation?.customerId ?? queryCustomerId ?? "";
      return customers.find((customer: any) => String(customer?.id ?? "") === String(activeCustomerId)) ?? null;
    },
    [customers, queryCustomerId, selectedConversation?.customerId]
  );
  const selectedCustomerCharge = useMemo(
    () => charges.find((charge: any) => String(charge?.customerId ?? "") === String(selectedCustomer?.id ?? "") && ["PENDING", "OVERDUE"].includes(String(charge?.status ?? "").toUpperCase()))
      ?? charges.find((charge: any) => String(charge?.id ?? "") === String(queryChargeId ?? "")) ?? null,
    [charges, queryChargeId, selectedCustomer?.id]
  );
  const selectedCustomerAppointment = useMemo(
    () => appointments.find((appointment: any) => String(appointment?.id ?? "") === String(queryAppointmentId ?? ""))
      ?? appointments.find((appointment: any) => String(appointment?.customerId ?? "") === String(selectedCustomer?.id ?? "") && String(appointment?.status ?? "").toUpperCase() !== "CANCELED")
      ?? null,
    [appointments, queryAppointmentId, selectedCustomer?.id]
  );
  const selectedCustomerServiceOrder = useMemo(
    () => serviceOrders.find((serviceOrder: any) => String(serviceOrder?.id ?? "") === String(queryServiceOrderId ?? ""))
      ?? serviceOrders.find((serviceOrder: any) => String(serviceOrder?.customerId ?? "") === String(selectedCustomer?.id ?? "") && !["DONE", "CANCELED"].includes(String(serviceOrder?.status ?? "").toUpperCase()))
      ?? null,
    [queryServiceOrderId, selectedCustomer?.id, serviceOrders]
  );
  const context = useMemo(() => {
    if (selectedConversationRecordId) return (contextQuery.data ?? null) as WhatsAppContext | null;
    if (selectedCustomer) {
      return {
        customer: {
          id: String(selectedCustomer.id),
          name: String(selectedCustomer.name ?? selectedConversation?.name ?? "Sem nome"),
          phone: selectedCustomer.phone ? String(selectedCustomer.phone) : undefined,
        },
        nextAppointment: selectedCustomerAppointment
          ? {
            id: String(selectedCustomerAppointment.id),
            scheduledAt: selectedCustomerAppointment.startsAt ?? selectedCustomerAppointment.scheduledAt,
            status: selectedCustomerAppointment.status,
            serviceName: selectedCustomerAppointment.serviceName ?? null,
          }
          : null,
        activeServiceOrder: selectedCustomerServiceOrder
          ? {
            id: String(selectedCustomerServiceOrder.id),
            number: selectedCustomerServiceOrder.number ? String(selectedCustomerServiceOrder.number) : null,
            status: selectedCustomerServiceOrder.status,
            technician: selectedCustomerServiceOrder.technicianName ?? null,
          }
          : null,
        openCharge: selectedCustomerCharge
          ? {
            id: String(selectedCustomerCharge.id),
            amount: Number(selectedCustomerCharge.amountCents ?? selectedCustomerCharge.amount ?? 0),
            dueDate: selectedCustomerCharge.dueDate,
            status: selectedCustomerCharge.status,
            paymentLink: selectedCustomerCharge.paymentLink ?? null,
          }
          : null,
      } as WhatsAppContext;
    }
    return null;
  }, [
    contextQuery.data,
    selectedConversation?.name,
    selectedConversationRecordId,
    selectedCustomer,
    selectedCustomerAppointment,
    selectedCustomerCharge,
    selectedCustomerServiceOrder,
  ]);

  const destinationPhone = useMemo(
    () => String(context?.customer?.phone ?? selectedConversation?.phone ?? selectedCustomer?.phone ?? "").trim(),
    [context?.customer?.phone, selectedConversation?.phone, selectedCustomer?.phone]
  );
  const canComposeForSelected = Boolean(selectedConversationId) && Boolean(destinationPhone);
  const composePlaceholder = selectedConversation
    ? selectedConversationRecordId
      ? "Responder conversa..."
      : "Iniciar conversa com este cliente..."
    : "Selecione uma conversa para responder...";

  const handleSelectConversation = (conversationId: string) => {
    hasManualSelectionRef.current = true;
    setSelectedConversationId(conversationId);
    setContent("");
    setComposerError(null);
  };

  const handleManualSend = async () => {
    if (!selectedConversationId) {
      setComposerError("Selecione uma conversa antes de enviar.");
      return;
    }
    const customerId = context?.customer?.id ?? selectedConversation?.customerId ?? undefined;
    if (!selectedConversationRecordId && !customerId) {
      setComposerError("Não foi possível identificar o cliente para iniciar a conversa.");
      return;
    }
    if (!destinationPhone) {
      setComposerError("Este cliente não possui telefone cadastrado.");
      return;
    }
    const finalContent = content.trim();
    if (!finalContent) {
      setComposerError("Digite uma mensagem antes de enviar.");
      return;
    }
    setComposerError(null);

    try {
      const entity = resolveEntityFromContext(context);
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationRecordId ?? undefined,
        customerId,
        toPhone: destinationPhone,
        content: finalContent,
        entityType: entity.entityType,
        entityId: entity.entityId ?? customerId ?? undefined,
        messageType: resolveMessageTypeFromContext(context),
      });
      setContent("");
      shouldPromoteVirtualSelectionRef.current = !selectedConversationRecordId;
      const refreshedConversations = await conversationsQuery.refetch();
      const refreshedRows = Array.isArray(refreshedConversations.data)
        ? refreshedConversations.data.map(mapConversation)
        : [];
      const resolvedConversation = refreshedRows.find(item => String(item.customerId ?? "") === String(customerId ?? ""));
      if (resolvedConversation?.id) {
        setSelectedConversationId(resolvedConversation.id);
      }
      // TODO(timeline): validar evento MESSAGE_SENT/PAYMENT_LINK_SENT quando endpoint de timeline expuser rastreamento dedicado.
      await Promise.all([messagesQuery.refetch(), contextQuery.refetch(), conversationDetailsQuery.refetch()]);
    } catch (error: any) {
      console.error(error);
      setComposerError(error?.message ?? "Falha ao enviar mensagem.");
      toast.error(error?.message ?? "Falha ao enviar mensagem.");
    }
  };

  const handleTemplateChip = (template: string) => {
    if (!selectedConversationId) return;
    setContent(buildTemplateText(template, context));
  };

  const handleSendTemplate = async (templateKey: string) => {
    if (!selectedConversationId) return;
    const customerId = context?.customer?.id ?? selectedConversation?.customerId ?? undefined;
    if (!selectedConversationRecordId && !customerId) {
      toast.error("Não foi possível identificar o cliente para iniciar a conversa.");
      return;
    }
    if (!destinationPhone) {
      toast.error("Este cliente não possui telefone cadastrado.");
      return;
    }
    try {
      const entity = resolveEntityFromContext(context);
      await sendTemplateMutation.mutateAsync({
        templateKey,
        conversationId: selectedConversationRecordId ?? undefined,
        customerId,
        toPhone: destinationPhone,
        entityType: entity.entityType,
        entityId: entity.entityId ?? customerId ?? undefined,
        context: {
          customerName: context?.customer?.name,
          appointmentDate: context?.nextAppointment?.scheduledAt,
          appointmentTime: context?.nextAppointment?.scheduledAt,
          chargeAmount: context?.openCharge?.amount,
          chargeDueDate: context?.openCharge?.dueDate,
          paymentLink: context?.openCharge?.paymentLink,
          serviceOrderNumber: context?.activeServiceOrder?.number,
        },
      });
      shouldPromoteVirtualSelectionRef.current = !selectedConversationRecordId;
      const refreshedConversations = await conversationsQuery.refetch();
      const refreshedRows = Array.isArray(refreshedConversations.data)
        ? refreshedConversations.data.map(mapConversation)
        : [];
      const resolvedConversation = refreshedRows.find(item => String(item.customerId ?? "") === String(customerId ?? ""));
      if (resolvedConversation?.id) {
        setSelectedConversationId(resolvedConversation.id);
      }
      await Promise.all([messagesQuery.refetch(), contextQuery.refetch(), conversationDetailsQuery.refetch()]);
      toast.success("Template enviado.");
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao enviar template.");
    }
  };

  const handleRetryLastFailed = async () => {
    const failed = [...messages].reverse().find((item) => item.status === "FAILED");
    if (!failed?.id) {
      toast.message("Nenhuma mensagem com falha para reenviar.");
      return;
    }
    try {
      await retryMessageMutation.mutateAsync({ id: failed.id });
      await Promise.all([messagesQuery.refetch(), conversationsQuery.refetch(), contextQuery.refetch()]);
      toast.success("Reenvio solicitado com sucesso.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível reenviar a mensagem.");
    }
  };

  const handleMoreActions = async () => {
    await handleRetryLastFailed();
  };

  const handleSendCharge = async () => {
    if (!context?.openCharge?.id) {
      toast.message("Nenhuma cobrança aberta para este cliente.");
      return;
    }
    await handleSendTemplate(context.openCharge.paymentLink ? "payment_link" : "payment_reminder");
  };

  const handleSendReminder = async () => {
    if (context?.openCharge?.id && (context?.openCharge?.daysOverdue ?? 0) > 0) {
      await handleSendTemplate("payment_reminder");
      return;
    }
    if (context?.nextAppointment?.id) {
      await handleSendTemplate("appointment_reminder");
      return;
    }
    if (context?.activeServiceOrder?.id) {
      await handleSendTemplate("service_update");
      return;
    }
    await handleSendTemplate("manual_followup");
  };

  if (conversationsQuery.isLoading && customersQuery.isLoading && allInboxRows.length === 0) {
    return (
      <AppPageShell>
        <AppPageLoadingState
          title="Carregando inbox operacional"
          description="Preparando prioridades, contexto e fila de execução."
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell className="h-[calc(100vh-5rem)] min-h-0 overflow-hidden bg-[#0B111C] px-3 pb-0 pt-3">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden bg-transparent xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(280px,320px)]">
        <div className="h-full min-h-0 min-w-0 overflow-hidden">
          <ConversationsList
            rows={filteredRows}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
            filter={activeFilter}
            onFilter={setActiveFilter}
            search={searchTerm}
            onSearch={setSearchTerm}
            isLoading={
              (conversationsQuery.isLoading || conversationsQuery.isFetching || customersQuery.isLoading || customersQuery.isFetching)
              && filteredRows.length === 0
            }
            hasError={Boolean(conversationsQuery.error) || Boolean(customersQuery.error)}
            errorMessage={customersQuery.error ? "Erro ao carregar clientes" : "Não foi possível carregar conversas"}
            emptyStateMessage={emptyStateMessage}
          />
        </div>

        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <ChatPanel
            conversation={selectedConversation}
            canCompose={canComposeForSelected}
            composePlaceholder={composePlaceholder}
            messages={messages}
            isLoading={messagesQuery.isLoading || messagesQuery.isFetching}
            sendMessage={handleManualSend}
            content={content}
            setContent={value => setContent(value)}
            onToggleFavorite={() => {
              if (!selectedConversationId) return;
              setLocalFavorites(prev => ({ ...prev, [selectedConversationId]: !prev[selectedConversationId] }));
              // TODO: conectar favorite quando Conversation tiver campo isFavorite
            }}
            isFavorite={Boolean(localFavorites[selectedConversationId ?? ""])}
            onInfo={() => {
              setIsContextVisible(true);
              document.getElementById("whatsapp-context-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onMoreActions={handleMoreActions}
            error={composerError}
            onOpenCustomer={() => setLocation(context?.customer?.id ? `/customers?customerId=${context.customer.id}` : "/customers")}
            onOpenFinance={() => setLocation(context?.openCharge?.id ? `/finances?chargeId=${context.openCharge.id}` : "/finances")}
            onOpenAppointment={() => setLocation(context?.nextAppointment?.id ? `/appointments?appointmentId=${context.nextAppointment.id}` : "/appointments")}
            onOpenServiceOrder={() => setLocation(context?.activeServiceOrder?.id ? `/service-orders?serviceOrderId=${context.activeServiceOrder.id}` : "/service-orders")}
            onFillTemplate={handleTemplateChip}
            canMarkAsPaid={Boolean(context?.openCharge?.id)}
          />
        </div>

        <div className={cn("h-full min-h-0 min-w-0 overflow-hidden", isContextVisible ? "xl:block" : "hidden")}> 
          <ContextPanel
            conversation={selectedConversation}
            context={context}
            selectedCustomer={selectedCustomer}
            isLoading={contextQuery.isLoading || contextQuery.isFetching}
            onNavigate={setLocation}
            onSendCharge={handleSendCharge}
            onSendReminder={handleSendReminder}
            onMoreActions={handleMoreActions}
            highlightedChargeId={queryChargeId}
            highlightedAppointmentId={queryAppointmentId}
            highlightedServiceOrderId={queryServiceOrderId}
          />
        </div>
      </div>
      {healthQuery.error ? <p className="sr-only">health error</p> : null}
      {/* TODO: Conectar registro direto quando finance.markAsPaid estiver exposto no BFF. */}
      {/* TODO: Abrir detalhe de clientes/financeiro pelo query id caso a rota ainda não suporte foco automático. */}
    </AppPageShell>
  );
}
