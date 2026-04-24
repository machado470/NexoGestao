import { memo, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCheck,
  Circle,
  Clock3,
  Filter,
  Send,
  Zap,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/design-system";
import { AppPageHeader, AppPageShell, AppSkeleton } from "@/components/app-system";
import {
  AppEmptyState,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
} from "@/components/internal-page-system";

type ConversationFilter = "all" | "no_reply" | "billing" | "failures";
type ConversationStatus = "awaiting" | "ok" | "failed";
type ContextType = "charge" | "appointment" | "os";

type Conversation = {
  customerId: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string;
  status: ConversationStatus;
  contextType: ContextType;
  priorityScore: number;
  context?: {
    nextAppointmentAt?: string | null;
    activeServiceOrderStatus?: string | null;
    overdueAmountCents?: number;
    overdueCount?: number;
  };
};

const FILTERS: Array<{ value: ConversationFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "no_reply", label: "Não respondidas" },
  { value: "billing", label: "Cobranças" },
  { value: "failures", label: "Falhas" },
];

const TEMPLATES = [
  {
    key: "charge",
    label: "Cobrança",
    content: "Olá! Identificamos uma pendência em aberto. Posso reenviar seu link de pagamento agora?",
  },
  {
    key: "reminder",
    label: "Lembrete",
    content: "Passando para lembrar seu atendimento. Confirma sua disponibilidade?",
  },
  {
    key: "confirmation",
    label: "Confirmação",
    content: "Confirmação operacional: seguimos com a execução combinada.",
  },
] as const;

const statusUi: Record<ConversationStatus, { label: string; dot: string }> = {
  awaiting: { label: "Aguardando resposta", dot: "bg-red-400" },
  ok: { label: "Resolvido", dot: "bg-emerald-400" },
  failed: { label: "Falha", dot: "bg-amber-400" },
};

function fmtTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(value?: string | null) {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";
  return date.toLocaleString("pt-BR");
}

function fmtCurrency(cents = 0) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const ROW_HEIGHT = 92;

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
  const status = statusUi[conversation.status] ?? statusUi.ok;

  return (
    <div style={style} className="px-1 py-1">
      <button
        type="button"
        onClick={() => onSelect(conversation.customerId)}
        className={cn(
          "w-full rounded-xl border px-3 py-2 text-left",
          selectedId === conversation.customerId
            ? "border-[color:rgba(255,255,255,0.55)] bg-[var(--surface-elevated)]/60"
            : "border-[color:rgba(255,255,255,0.08)] bg-[var(--surface-primary)]/35"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold">{conversation.name}</p>
          <span className="text-[10px] text-[var(--text-muted)]">{fmtTime(conversation.lastMessageAt)}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">{conversation.lastMessage}</p>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span>{conversation.contextType}</span>
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
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
}: {
  rows: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
  filter: ConversationFilter;
  onFilter: (next: ConversationFilter) => void;
  search: string;
  onSearch: (next: string) => void;
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
    <section className="min-w-0 rounded-2xl border border-[color:rgba(255,255,255,0.08)] bg-[var(--surface-primary)]/45 p-2">
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-[color:rgba(255,255,255,0.08)] px-2 py-1.5">
          <Filter className="size-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar conversa"
            className="h-7 w-full bg-transparent text-xs outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map(item => (
            <button
              key={item.value}
              type="button"
              className={cn(
                "h-7 rounded-full border px-2.5 text-[11px]",
                filter === item.value
                  ? "border-[color:rgba(255,255,255,0.55)]"
                  : "border-[color:rgba(255,255,255,0.1)] text-[var(--text-muted)]"
              )}
              onClick={() => onFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          ref={viewportRef}
          className="h-[calc(100vh-250px)] min-h-[420px] overflow-y-auto"
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
        >
          {rows.length === 0 ? (
            <AppEmptyState
              title="Inbox sem conversas"
              description="Ajuste filtros para visualizar a fila operacional."
            />
          ) : (
            <div style={{ height: totalHeight, position: "relative" }}>
              <div style={{ transform: `translateY(${startIndex * ROW_HEIGHT}px)` }}>
                {visibleRows.map(conversation => (
                  <ConversationRow
                    key={conversation.customerId}
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
      </div>
    </section>
  );
}

function ChatPanel({
  conversation,
  messages,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  content,
  setContent,
  sendMessage,
}: {
  conversation?: Conversation;
  messages: any[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  content: string;
  setContent: (value: string) => void;
  sendMessage: (preset?: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  return (
    <section className="grid min-h-0 grid-rows-[56px_minmax(0,1fr)_44px_48px] overflow-hidden rounded-2xl border border-[color:rgba(255,255,255,0.08)] bg-[var(--surface-base)]/55">
      <header className="flex items-center justify-between border-b border-[color:rgba(255,255,255,0.07)] px-3">
        <div>
          <p className="text-xs font-semibold">{conversation?.name ?? "Selecione uma conversa"}</p>
          <p className="text-[11px] text-[var(--text-muted)]">Execução operacional contextual</p>
        </div>
        {conversation ? (
          <span className="rounded-full border border-[color:rgba(255,255,255,0.2)] px-2 py-0.5 text-[10px]">
            Prioridade {conversation.priorityScore}
          </span>
        ) : null}
      </header>

      <div
        ref={listRef}
        className="overflow-y-auto px-3 py-3"
        onScroll={event => {
          const target = event.currentTarget;
          if (target.scrollTop < 80 && hasMore && !isLoadingMore) onLoadMore();
        }}
      >
        {!conversation ? (
          <AppEmptyState
            title="Selecione uma conversa"
            description="Escolha um cliente para executar cobrança, lembrete ou confirmação."
          />
        ) : isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, idx) => <AppSkeleton key={idx} className="h-12 rounded-xl" />)}</div>
        ) : messages.length === 0 ? (
          <AppEmptyState title="Sem mensagens" description="Use templates para iniciar a execução." />
        ) : (
          <div className="space-y-2">
            {isLoadingMore ? (
              <p className="text-center text-[11px] text-[var(--text-muted)]">Carregando histórico...</p>
            ) : null}
            {messages.map(message => {
              const outgoing = String(message?.status ?? "").toUpperCase() !== "RECEIVED";
              return (
                <div key={String(message?.id)} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[70%] rounded-xl px-3 py-2 text-sm", outgoing ? "bg-emerald-900/35" : "bg-[var(--surface-primary)]/65 border border-[color:rgba(255,255,255,0.08)]")}>
                    <p>{String(message?.renderedText ?? "")}</p>
                    <p className="mt-1 text-right text-[10px] text-[var(--text-muted)]">{fmtTime(message?.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-[color:rgba(255,255,255,0.07)] px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TEMPLATES.map(template => (
          <Button
            key={template.key}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-lg text-[11px]"
            onClick={() => setContent(template.content)}
          >
            {template.label}
          </Button>
        ))}
      </div>

      <footer className="flex items-center gap-2 border-t border-[color:rgba(255,255,255,0.07)] px-2 py-1.5">
        <input
          value={content}
          onChange={event => setContent(event.target.value)}
          placeholder="Mensagem operacional"
          className="h-9 w-full rounded-xl border border-[color:rgba(255,255,255,0.1)] bg-transparent px-3 text-sm outline-none"
        />
        <Button type="button" size="sm" className="h-9 w-9 rounded-full p-0" onClick={() => sendMessage()}>
          <Send className="size-3.5" />
        </Button>
      </footer>
    </section>
  );
}

function ContextPanel({
  conversation,
  sendMessage,
}: {
  conversation?: Conversation;
  sendMessage: (preset?: string) => void;
}) {
  return (
    <aside className="min-w-0 rounded-2xl border border-[color:rgba(255,255,255,0.08)] bg-[var(--surface-primary)]/45 p-2.5">
      {!conversation ? (
        <AppEmptyState title="Sem contexto ativo" description="Selecione uma conversa para abrir contexto operacional." />
      ) : (
        <div className="space-y-2 text-xs">
          <section className="rounded-xl border border-[color:rgba(255,255,255,0.08)] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Cliente</p>
            <p className="mt-1 font-semibold">{conversation.name}</p>
          </section>

          <section className="rounded-xl border border-[color:rgba(255,255,255,0.08)] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Próximo agendamento</p>
            <p className="mt-1">{fmtDate(conversation.context?.nextAppointmentAt)}</p>
          </section>

          <section className="rounded-xl border border-[color:rgba(255,255,255,0.08)] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">O.S. ativa</p>
            <p className="mt-1">{conversation.context?.activeServiceOrderStatus ?? "Sem O.S. ativa"}</p>
          </section>

          <section className="rounded-xl border border-[color:rgba(255,255,255,0.08)] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Cobrança pendente</p>
            <p className="mt-1">
              {conversation.context?.overdueCount ? `${conversation.context.overdueCount} cobrança(s)` : "Sem pendência"}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {fmtCurrency(conversation.context?.overdueAmountCents ?? 0)}
            </p>
          </section>

          <section className="grid grid-cols-1 gap-1.5 pt-1">
            <Button type="button" size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => sendMessage(TEMPLATES[0].content)}>
              <Zap className="mr-1 size-3.5" /> Enviar cobrança
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-[11px]">
              <CheckCheck className="mr-1 size-3.5" /> Marcar resolvido
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => sendMessage()}>
              <AlertTriangle className="mr-1 size-3.5" /> Reenviar mensagem
            </Button>
          </section>
        </div>
      )}
    </aside>
  );
}

export default function WhatsAppPage() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const searchParams = new URLSearchParams(location.split("?")[1] ?? "");

  const [selectedCustomerId, setSelectedCustomerId] = useOperationalMemoryState(
    "nexo.whatsapp.selected-customer.v2",
    searchParams.get("customerId") ?? ""
  );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState("nexo.whatsapp.search.v2", "");
  const [activeFilter, setActiveFilter] = useOperationalMemoryState<ConversationFilter>(
    "nexo.whatsapp.filter.v2",
    "all"
  );
  const [content, setContent] = useOperationalMemoryState("nexo.whatsapp.composer.v2", "");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [messagePages, setMessagePages] = useState<any[][]>([]);

  const conversationsQuery = trpc.nexo.whatsapp.conversations.useQuery(undefined, { retry: false });
  const sendMutation = trpc.nexo.whatsapp.send.useMutation();

  const conversations = useMemo(
    () => (Array.isArray(conversationsQuery.data) ? (conversationsQuery.data as Conversation[]) : []),
    [conversationsQuery.data]
  );

  useEffect(() => {
    if (!selectedCustomerId && conversations[0]?.customerId) {
      setSelectedCustomerId(conversations[0].customerId);
    }
  }, [conversations, selectedCustomerId, setSelectedCustomerId]);

  const messagesFeedQuery = trpc.nexo.whatsapp.messagesFeed.useQuery(
    { customerId: selectedCustomerId, limit: 20, cursor },
    { enabled: Boolean(selectedCustomerId), retry: false }
  );

  useEffect(() => {
    setCursor(undefined);
    setMessagePages([]);
  }, [selectedCustomerId]);

  useEffect(() => {
    const payload = messagesFeedQuery.data as { items?: any[]; nextCursor?: string | null } | undefined;
    if (!payload?.items) return;
    const pageItems = payload.items;
    setMessagePages(prev => {
      if (!cursor) return [pageItems];
      return [...prev, pageItems];
    });
  }, [messagesFeedQuery.data, cursor]);

  const selectedConversation = conversations.find(item => item.customerId === selectedCustomerId);

  const filteredConversations = useMemo(() => {
    const text = searchTerm.toLowerCase().trim();
    return conversations.filter(item => {
      if (activeFilter === "no_reply" && item.status !== "awaiting") return false;
      if (activeFilter === "billing" && item.contextType !== "charge") return false;
      if (activeFilter === "failures" && item.status !== "failed") return false;
      if (text && !item.name.toLowerCase().includes(text) && !item.lastMessage.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [activeFilter, conversations, searchTerm]);

  const messages = useMemo(() => {
    return messagePages
      .flat()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messagePages]);

  async function sendMessage(preset?: string) {
    if (!selectedConversation) return;
    const finalContent = (preset ?? content).trim();
    if (finalContent.length < 2) {
      toast.error("Digite uma mensagem operacional válida.");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        customerId: selectedConversation.customerId,
        content: finalContent,
        idempotencyKey: buildIdempotencyKey("whatsapp.operational_send", selectedConversation.customerId),
      });

      setContent("");
      setCursor(undefined);
      setMessagePages([]);
      await Promise.all([
        messagesFeedQuery.refetch(),
        conversationsQuery.refetch(),
        invalidateOperationalGraph(utils, selectedConversation.customerId),
      ]);
      toast.success("Mensagem enviada para execução operacional.");
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao enviar mensagem.");
    }
  }

  if (conversationsQuery.isLoading && conversations.length === 0) {
    return (
      <AppPageShell>
        <AppPageLoadingState
          title="Carregando inbox operacional"
          description="Preparando prioridades, contexto e fila de execução."
        />
      </AppPageShell>
    );
  }

  if (conversationsQuery.error && conversations.length === 0) {
    return (
      <AppPageShell>
        <AppPageErrorState
          description="Não foi possível carregar a operação de WhatsApp."
          actionLabel="Tentar novamente"
          onAction={() => void conversationsQuery.refetch()}
        />
      </AppPageShell>
    );
  }

  if (conversations.length === 0) {
    return (
      <AppPageShell>
        <AppPageEmptyState
          title="Sem operação de WhatsApp"
          description="Crie contexto com cliente, cobrança, agendamento ou O.S. para abrir a inbox."
        />
      </AppPageShell>
    );
  }

  const nextCursor = (messagesFeedQuery.data as any)?.nextCursor as string | null | undefined;

  return (
    <AppPageShell className="px-3 py-3">
      <AppPageHeader className="mb-3 flex min-h-14 items-center justify-between rounded-2xl border border-[color:rgba(255,255,255,0.08)] bg-[var(--surface-primary)]/55 px-4">
        <div>
          <h1 className="text-sm font-semibold">WhatsApp · Execução operacional</h1>
          <p className="text-xs text-[var(--text-muted)]">Inbox inteligente com prioridade e contexto no mesmo fluxo</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
          <Circle className="size-2.5 fill-current" /> Online
        </div>
      </AppPageHeader>

      <div className="grid h-[calc(100vh-170px)] min-h-[560px] grid-cols-[320px_1fr_360px] gap-2">
        <ConversationsList
          rows={filteredConversations}
          selectedId={selectedCustomerId}
          onSelect={setSelectedCustomerId}
          filter={activeFilter}
          onFilter={setActiveFilter}
          search={searchTerm}
          onSearch={setSearchTerm}
        />

        <ChatPanel
          conversation={selectedConversation}
          messages={messages}
          isLoading={messagesFeedQuery.isLoading}
          isLoadingMore={messagesFeedQuery.isFetching && Boolean(cursor)}
          hasMore={Boolean(nextCursor)}
          onLoadMore={() => {
            if (nextCursor) setCursor(nextCursor);
          }}
          content={content}
          setContent={setContent}
          sendMessage={sendMessage}
        />

        <ContextPanel conversation={selectedConversation} sendMessage={sendMessage} />
      </div>
    </AppPageShell>
  );
}
