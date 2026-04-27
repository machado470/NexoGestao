import {
  memo,
  type CSSProperties,
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
  AppPageLoadingState,
} from "@/components/internal-page-system";

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
type ContextType = "CHARGE" | "APPOINTMENT" | "SERVICE_ORDER" | "GENERAL";
type MessageDirection = "INBOUND" | "OUTBOUND";
type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";

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
};

type ChatMessage = {
  id: string;
  direction: MessageDirection;
  content: string;
  createdAt?: string | null;
  status: MessageStatus;
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

const TEMPLATES = [
  "Confirmação de agendamento",
  "Lembrete",
  "Cobrança simples",
  "Link de pagamento",
];

const statusUi: Record<WhatsAppConversationStatus, { label: string; dot: string }> = {
  OPEN: { label: "Aberta", dot: "bg-amber-400" },
  PENDING: { label: "Pendente", dot: "bg-[var(--accent-primary)]" },
  RESOLVED: { label: "Resolvida", dot: "bg-emerald-400" },
  FAILED: { label: "Falha", dot: "bg-rose-400" },
};

const ROW_HEIGHT = 106;

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
  };
}

function mapMessage(item: any): ChatMessage {
  return {
    id: String(item?.id ?? ""),
    direction: (item?.direction ?? "OUTBOUND") as MessageDirection,
    content: String(item?.renderedText ?? item?.content ?? ""),
    createdAt: item?.createdAt ?? null,
    status: (item?.status ?? "QUEUED") as MessageStatus,
  };
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
  if (template === "Lembrete") {
    return `Olá ${customerName}, passando para lembrar do seu atendimento/pendência.`;
  }
  if (template === "Cobrança simples") {
    return `Olá ${customerName}, identificamos uma cobrança em aberto (${chargeAmount}, vencimento ${chargeDueDate}).`;
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
              {conversation.title ? (
                <p className="truncate text-[11px] text-[var(--accent-primary)]/90">{conversation.title}</p>
              ) : null}
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{fmtTime(conversation.lastMessageAt)}</span>
        </div>
        <p className="mt-1.5 line-clamp-1 text-xs text-[var(--text-secondary)]">{conversation.lastMessage}</p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            {status.label} · {conversation.priority}
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
                ? "Não foi possível carregar conversas"
                : search.trim()
                  ? "Nenhuma conversa encontrada para esta busca."
                  : "Nenhuma conversa ainda."}
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
                  selectedId={selectedId}
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
            Selecione uma conversa para continuar.
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
                      "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                      outgoing
                        ? "max-w-[66%] border-emerald-400/20 bg-emerald-900/55"
                        : "max-w-[68%] border-white/[0.08] bg-white/[0.03]"
                    )}
                  >
                    <p>{message.content}</p>
                    <p className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]/85">
                      {fmtTime(message.createdAt)} · {message.status}
                      {outgoing && ["DELIVERED", "READ"].includes(message.status) ? (
                        <CheckCheck className="size-3" />
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasConversation ? (
        <div className="shrink-0 flex flex-wrap items-center gap-2 bg-white/[0.02] px-3 py-2">
          {TEMPLATES.map(template => (
            <Button
              key={template}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg border-white/[0.08] bg-white/[0.02] text-[11px] hover:bg-white/[0.05]"
              onClick={() => setContent(template)}
            >
              {template}
            </Button>
          ))}
        </div>
      ) : null}

      <footer className="shrink-0 mt-0 flex items-center gap-1.5 overflow-x-hidden bg-white/[0.02] px-3 py-2.5">
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
      </footer>
      {error ? <p className="px-3 pb-2 text-[11px] text-rose-300">{error}</p> : null}
    </section>
  );
}

function ContextPanel({
  context,
  conversation,
  isLoading,
  onNavigate,
  onSendCharge,
  onSendReminder,
  onMoreActions,
}: {
  context?: WhatsAppContext | null;
  conversation?: Conversation;
  isLoading: boolean;
  onNavigate: (path: string) => void;
  onSendCharge: () => void;
  onSendReminder: () => void;
  onMoreActions: () => void;
}) {
  if (!conversation || !context) {
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

  const hasCharge = Boolean(context.openCharge?.id);
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
            <p className="mt-1 font-semibold">{context?.customer?.name ?? conversation.name}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{context?.customer?.phone ?? conversation.phone ?? "--"}</p>
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
            <p className="mt-1 font-medium">{context?.nextAppointment?.serviceName ?? "Sem agendamento"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{fmtDateTime(context?.nextAppointment?.scheduledAt)}</p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">{context?.nextAppointment?.status ?? "--"}</span>
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
            <p className="mt-1 font-medium">{context?.activeServiceOrder?.number ? `OS #${context.activeServiceOrder.number}` : "Sem O.S. ativa"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Status: {context?.activeServiceOrder?.status ?? "--"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Técnico: {context?.activeServiceOrder?.technician ?? "--"}</p>
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
            <p className="mt-1 font-medium">{context?.openCharge?.id ? `Cobrança #${context.openCharge.id}` : "Sem cobrança aberta"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Vencimento: {fmtDateTime(context?.openCharge?.dueDate)}</p>
            <p className="text-[11px]">
              Valor: {context?.openCharge?.amount ? `R$ ${(context.openCharge.amount / 100).toFixed(2).replace(".", ",")}` : "--"}
            </p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100">{context?.openCharge?.status ?? "--"}</span>
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
  const searchParams = new URLSearchParams(location.split("?")[1] ?? "");
  const queryConversationId = searchParams.get("conversationId");
  const queryCustomerId = searchParams.get("customerId");

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
  const customersQuery = trpc.nexo.customers.list.useQuery({ page: 1, limit: 500 }, { retry: false });
  const customers = useMemo(() => {
    const raw = customersQuery.data as any;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
  }, [customersQuery.data]);

  const conversationCustomerIds = useMemo(
    () => new Set(conversations.map(item => item.customerId).filter(Boolean) as string[]),
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
        })),
    [conversationCustomerIds, customers]
  );
  const allInboxRows = useMemo(
    () => [...conversations, ...(activeFilter === "all" ? customersWithoutConversation : [])],
    [activeFilter, conversations, customersWithoutConversation]
  );
  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return allInboxRows.filter(item => {
      const matchesSearch = !query
        || [item.name, item.phone ?? "", item.lastMessage, item.title ?? ""].join(" ").toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (activeFilter === "all") return true;
      if (!item.conversationId) return false;
      if (activeFilter === "no_reply") return item.unreadCount > 0;
      if (activeFilter === "billing") return item.status === "PENDING";
      if (activeFilter === "failures") return item.status === "FAILED";
      if (activeFilter === "charges") return item.contextType === "CHARGE";
      if (activeFilter === "appointments") return item.contextType === "APPOINTMENT";
      if (activeFilter === "service_orders") return item.contextType === "SERVICE_ORDER";
      return true;
    });
  }, [activeFilter, allInboxRows, debouncedSearch]);

  const selectedConversation = useMemo(
    () =>
      filteredRows.find(item => item.id === selectedConversationId)
      ?? allInboxRows.find(item => item.id === selectedConversationId),
    [allInboxRows, filteredRows, selectedConversationId]
  );
  const selectedConversationRecordId = selectedConversation?.conversationId ?? null;

  useEffect(() => {
    if (filteredRows.length === 0) {
      if (selectedConversationId !== null) setSelectedConversationId(null);
      return;
    }
    if (!selectedConversationId || !filteredRows.some(item => item.id === selectedConversationId)) {
      setSelectedConversationId(filteredRows[0]?.id ?? null);
    }
  }, [filteredRows, selectedConversationId, setSelectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setContent("");
      setComposerError(null);
    }
  }, [selectedConversationId, setContent]);

  useEffect(() => {
    if (!selectedConversationId?.startsWith("customer:")) return;
    const customerId = selectedConversation?.customerId;
    if (!customerId) return;
    const existingConversation = conversations.find(
      (item) => item.customerId === customerId && Boolean(item.conversationId)
    );
    if (existingConversation?.id && existingConversation.id !== selectedConversationId) {
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
  const updateStatusMutation = trpc.nexo.whatsapp.updateConversationStatus.useMutation();
  const retryMessageMutation = trpc.nexo.whatsapp.retryMessage.useMutation();

  const messages = useMemo(
    () =>
      selectedConversationRecordId && Array.isArray(messagesQuery.data)
        ? messagesQuery.data.map(mapMessage).reverse()
        : [],
    [messagesQuery.data, selectedConversationRecordId]
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer: any) => String(customer?.id ?? "") === String(selectedConversation?.customerId ?? "")) ?? null,
    [customers, selectedConversation?.customerId]
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
      } as WhatsAppContext;
    }
    return null;
  }, [contextQuery.data, selectedConversation?.name, selectedConversationRecordId, selectedCustomer]);

  const destinationPhone = useMemo(
    () => String(context?.customer?.phone ?? selectedConversation?.phone ?? selectedCustomer?.phone ?? "").trim(),
    [context?.customer?.phone, selectedConversation?.phone, selectedCustomer?.phone]
  );
  const canComposeForSelected = Boolean(selectedConversationId) && Boolean(destinationPhone);
  const composePlaceholder = selectedConversation
    ? selectedConversationRecordId
      ? "Digite sua mensagem..."
      : "Iniciar conversa com este cliente..."
    : "Selecione uma conversa para responder...";

  const refreshAll = async () => {
    await Promise.all([
      conversationsQuery.refetch(),
      messagesQuery.refetch(),
      contextQuery.refetch(),
      conversationDetailsQuery.refetch(),
    ]);
  };

  const handleSelectConversation = (conversationId: string) => {
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
      setComposerError("Cliente sem telefone válido. Cadastre um número para iniciar a conversa.");
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
        messageType: "MANUAL",
      });
      setContent("");
      await conversationsQuery.refetch();
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
      toast.error("Cliente sem telefone válido. Cadastre um número para iniciar a conversa.");
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
      await conversationsQuery.refetch();
      await Promise.all([messagesQuery.refetch(), contextQuery.refetch(), conversationDetailsQuery.refetch()]);
      toast.success("Template enviado.");
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao enviar template.");
    }
  };

  const handleConversationStatus = async (status: "PENDING" | "RESOLVED" | "OPEN") => {
    if (!selectedConversationRecordId) return;
    try {
      await updateStatusMutation.mutateAsync({ id: selectedConversationRecordId, status: status as any });
      await refreshAll();
      toast.success(`Conversa atualizada para ${status}.`);
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao atualizar conversa.");
    }
  };

  const retryFailedMessages = async () => {
    const failed = messages.filter(item => item.status === "FAILED");
    if (failed.length === 0) {
      toast.message("Nenhuma mensagem com falha nesta conversa.");
      return;
    }

    await Promise.all(failed.map(item => retryMessageMutation.mutateAsync({ id: item.id })));
    await refreshAll();
    toast.success("Reenvio de falhas solicitado.");
  };

  const handleCopyPhone = async () => {
    const phone = selectedConversation?.phone ?? context?.customer?.phone;
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    toast.success("Telefone copiado.");
  };

  const handleMoreActions = async () => {
    const answer = window.prompt(
      "Ação: resolved | pending | reopen | retry | copy | customer | finance",
      "resolved"
    );
    if (!answer) return;
    if (answer === "resolved") return handleConversationStatus("RESOLVED");
    if (answer === "pending") return handleConversationStatus("PENDING");
    if (answer === "reopen") return handleConversationStatus("OPEN");
    if (answer === "retry") return retryFailedMessages();
    if (answer === "copy") return handleCopyPhone();
    if (answer === "customer") {
      setLocation(context?.customer?.id ? `/customers?customerId=${context.customer.id}` : "/customers");
      return;
    }
    if (answer === "finance") {
      setLocation(context?.openCharge?.id ? `/finances?chargeId=${context.openCharge.id}` : "/finances");
    }
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
            setContent={value => {
              if (!selectedConversationId) return;
              const mapping: Record<string, string> = {
                "Confirmação de agendamento": buildTemplateText("Confirmação de agendamento", context),
                Lembrete: buildTemplateText("Lembrete", context),
                "Cobrança simples": buildTemplateText("Cobrança simples", context),
                "Link de pagamento": buildTemplateText("Link de pagamento", context),
              };
              if (mapping[value]) {
                handleTemplateChip(value);
                return;
              }
              setContent(value);
            }}
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
          />
        </div>

        <div className={cn("h-full min-h-0 min-w-0 overflow-hidden", isContextVisible ? "xl:block" : "hidden")}> 
          <ContextPanel
            conversation={selectedConversation}
            context={context}
            isLoading={contextQuery.isLoading || contextQuery.isFetching}
            onNavigate={setLocation}
            onSendCharge={handleSendCharge}
            onSendReminder={handleSendReminder}
            onMoreActions={handleMoreActions}
          />
        </div>
      </div>
      {healthQuery.error ? <p className="sr-only">health error</p> : null}
      {/* TODO: Conectar registro direto quando finance.markAsPaid estiver exposto no BFF. */}
      {/* TODO: Abrir detalhe de clientes/financeiro pelo query id caso a rota ainda não suporte foco automático. */}
    </AppPageShell>
  );
}
