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
  Circle,
  EllipsisVertical,
  Info,
  Bell,
  MessageCircleMore,
  Paperclip,
  PanelLeftClose,
  Search,
  Send,
  Star,
  UserCircle2,
  Volume2,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/design-system";
import {
  AppPageShell,
  AppSkeleton,
} from "@/components/app-system";
import {
  AppEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
} from "@/components/internal-page-system";

type ConversationFilter = "all" | "no_reply" | "billing" | "failures";
type ConversationStatus = "awaiting" | "pending" | "ok" | "failed";
type ContextType = "charge" | "appointment" | "os" | "failed";

type Conversation = {
  customerId: string;
  name: string;
  phone?: string;
  lastMessage: string;
  lastMessageAt: string;
  status: ConversationStatus;
  contextType: ContextType;
  priorityScore: number;
  badge?: string;
  unreadCount?: number;
  avatarUrl?: string | null;
  context?: {
    nextAppointmentAt?: string | null;
    activeServiceOrderStatus?: string | null;
    overdueAmountCents?: number;
    overdueCount?: number;
  };
};

type ChatMessage = {
  id: string;
  side: "incoming" | "outgoing" | "event";
  text: string;
  at: string;
  delivered?: boolean;
};

const demoConversations: Conversation[] = [
  {
    customerId: "demo-joao",
    name: "João Silva",
    phone: "5511999998888",
    lastMessage: "Olá, tudo bem? Segue o link para paga...",
    lastMessageAt: "09:41",
    contextType: "charge",
    status: "awaiting",
    priorityScore: 98,
    badge: "Cobrança #1247",
    unreadCount: 2,
    avatarUrl: null,
  },
  {
    customerId: "demo-condominio",
    name: "Condomínio Parque das Flores",
    phone: "5511988887777",
    lastMessage: "Perfeito, confirmado!",
    lastMessageAt: "09:35",
    contextType: "appointment",
    status: "pending",
    priorityScore: 74,
    badge: "Agendamento hoje 14:00",
    unreadCount: 1,
  },
  {
    customerId: "demo-mariana",
    name: "Mariana Costa",
    phone: "5511977776666",
    lastMessage: "Pode sim, vou estar aí às 15h.",
    lastMessageAt: "09:12",
    contextType: "os",
    status: "ok",
    priorityScore: 55,
    badge: "OS #235 em andamento",
  },
  {
    customerId: "demo-carlos",
    name: "Carlos Alberto",
    phone: "5511966665555",
    lastMessage: "Vou efetuar o pagamento hoje.",
    lastMessageAt: "08:50",
    contextType: "charge",
    status: "awaiting",
    priorityScore: 88,
    badge: "Cobrança vencida",
    unreadCount: 3,
  },
  {
    customerId: "demo-helena",
    name: "Helena Martins",
    phone: "5511955554444",
    lastMessage: "Obrigada, até amanhã!",
    lastMessageAt: "08:30",
    contextType: "appointment",
    status: "ok",
    priorityScore: 40,
    badge: "Agendamento amanhã",
  },
  {
    customerId: "demo-lucas",
    name: "Lucas Ferreira",
    phone: "5511944443333",
    lastMessage: "Serviço finalizado com sucesso.",
    lastMessageAt: "Ontem",
    contextType: "os",
    status: "ok",
    priorityScore: 35,
    badge: "OS #231 concluída",
  },
  {
    customerId: "demo-beatriz",
    name: "Beatriz Lima",
    phone: "5511933332222",
    lastMessage: "---",
    lastMessageAt: "Ontem",
    contextType: "failed",
    status: "failed",
    priorityScore: 92,
    badge: "Falha de envio",
    unreadCount: 1,
  },
];

const demoMessages: Record<string, ChatMessage[]> = {
  "demo-joao": [
    { id: "m1", side: "incoming", text: "Olá, bom dia!", at: "09:30" },
    {
      id: "m2",
      side: "incoming",
      text: "Pode me enviar o link para pagamento?",
      at: "09:32",
    },
    {
      id: "m3",
      side: "outgoing",
      text: "Olá João! Bom dia 🙂",
      at: "09:34",
      delivered: true,
    },
    {
      id: "m4",
      side: "outgoing",
      text: "Segue o link seguro para você realizar o pagamento:",
      at: "09:35",
      delivered: true,
    },
    {
      id: "m5",
      side: "outgoing",
      text: "https://pag.ae/7d3f-kL9m",
      at: "09:35",
      delivered: true,
    },
    {
      id: "m6",
      side: "outgoing",
      text: "Qualquer dúvida, estou à disposição!",
      at: "09:36",
      delivered: true,
    },
    {
      id: "m7",
      side: "incoming",
      text: "Recebi aqui, vou pagar ainda hoje.",
      at: "09:39",
    },
    { id: "m8", side: "incoming", text: "Obrigado!", at: "09:39" },
    {
      id: "m9",
      side: "event",
      text: "Marcada como aguardando pagamento por Paula",
      at: "09:41",
    },
    {
      id: "m10",
      side: "outgoing",
      text: "Perfeito! Assim que identificar o pagamento, eu te aviso por aqui.",
      at: "09:42",
      delivered: true,
    },
    {
      id: "m11",
      side: "outgoing",
      text: "Tenha um ótimo dia! 🙏",
      at: "09:42",
      delivered: true,
    },
  ],
};

const FILTERS: Array<{
  value: ConversationFilter;
  label: string;
  count: string;
}> = [
  { value: "all", label: "Todas", count: "18" },
  { value: "no_reply", label: "Não respondidas", count: "6" },
  { value: "billing", label: "Pendências", count: "5" },
  { value: "failures", label: "Falhas", count: "2" },
];

const TEMPLATES = [
  "Confirmação de agendamento",
  "Lembrete",
  "Cobrança",
  "Link de pagamento",
];

const statusUi: Record<ConversationStatus, { label: string; dot: string }> = {
  awaiting: { label: "Aguardando", dot: "bg-amber-400" },
  pending: { label: "Pendente", dot: "bg-[var(--accent-primary)]" },
  ok: { label: "OK", dot: "bg-emerald-400" },
  failed: { label: "Falha", dot: "bg-rose-400" },
};

const ROW_HEIGHT = 106;

function fmtTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const status = statusUi[conversation.status] ?? statusUi.ok;

  return (
    <div style={style} className="px-0.5 py-1">
      <button
        type="button"
        onClick={() => onSelect(conversation.customerId)}
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-left transition",
          selectedId === conversation.customerId
            ? "border-[var(--accent-primary)]/40 bg-[var(--accent-soft)]/28 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.12]"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                selectedId === conversation.customerId
                  ? "border-[var(--accent-primary)]/55 bg-[var(--accent-soft)]/70 text-[var(--accent-primary)]"
                  : "border-white/[0.12] bg-white/[0.04] text-[var(--text-secondary)]"
              )}
            >
              {conversation.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {conversation.name}
              </p>
              {conversation.badge ? (
                <p className="truncate text-[11px] text-[var(--accent-primary)]/90">
                  {conversation.badge}
                </p>
              ) : null}
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {fmtTime(conversation.lastMessageAt)}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-1 text-xs text-[var(--text-secondary)]">
          {conversation.lastMessage}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            {status.label}
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
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.015] p-2.5">
      <div className="shrink-0 space-y-2 border-b border-white/[0.05] pb-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Inbox</p>
          <button type="button" className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-white/[0.05]">Filtros</button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
          <Search className="size-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="h-7 w-full bg-transparent text-xs outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.slice(0, 3).map(item => (
            <button
              key={item.value}
              type="button"
              className={cn(
                "h-7.5 rounded-full border px-2.5 text-[11px]",
                filter === item.value
                  ? "border-[var(--accent-primary)]/45 bg-[var(--accent-soft)]/45 text-[var(--accent-primary)]"
                  : "border-white/[0.06] bg-white/[0.02] text-[var(--text-muted)]"
              )}
              onClick={() => onFilter(item.value)}
            >
              {item.label} {item.count}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={viewportRef}
        className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1"
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      >
        {rows.length === 0 ? (
          <AppEmptyState
            title="Inbox sem conversas"
            description="Ajuste filtros para visualizar a fila operacional."
          />
        ) : (
          <div style={{ height: totalHeight, position: "relative" }}>
            <div
              style={{ transform: `translateY(${startIndex * ROW_HEIGHT}px)` }}
            >
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
    </aside>
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
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  content: string;
  setContent: (value: string) => void;
  sendMessage: (preset?: string) => void;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [conversation?.customerId]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.015]">
      <header className="shrink-0 flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-[var(--accent-primary)]/25 bg-[var(--accent-soft)]/60 text-sm font-semibold text-[var(--accent-primary)]">
            {conversation?.name?.slice(0, 1) ?? "-"}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {conversation?.name ?? "Selecione uma conversa"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {conversation?.phone ?? ""}
            </p>
          </div>
          {conversation ? (
            <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">
              Cobrança pendente
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <button type="button" className="rounded-lg p-1.5 hover:bg-white/10">
            <Star className="size-4.5" />
          </button>
          <button type="button" className="rounded-lg p-1.5 hover:bg-white/10">
            <Info className="size-4.5" />
          </button>
          <button type="button" className="rounded-lg p-1.5 hover:bg-white/10">
            <EllipsisVertical className="size-4.5" />
          </button>
        </div>
      </header>

      <div
        ref={messagesRef}
        className="flex-1 min-h-0 overflow-y-auto bg-transparent px-5 py-4"
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
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <AppSkeleton key={idx} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3.5">
            <p className="text-center text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Hoje
            </p>
            {messages.map(message => {
              if (message.side === "event") {
                return (
                  <p
                    key={message.id}
                    className="text-center text-[10px] text-[var(--text-muted)]"
                  >
                    {message.text} • {message.at}
                  </p>
                );
              }

              const outgoing = message.side === "outgoing";
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    outgoing ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                      outgoing
                        ? "max-w-[66%] border-emerald-400/20 bg-emerald-900/55"
                        : "max-w-[68%] border-white/[0.08] bg-white/[0.03]"
                    )}
                  >
                    <p>{message.text}</p>
                    <p className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]/85">
                      {message.at}
                      {outgoing && message.delivered ? (
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

      <div className="shrink-0 flex flex-wrap items-center gap-2 border-t border-white/[0.05] bg-white/[0.02] px-3 py-2">
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

      <footer className="shrink-0 mt-auto flex items-center gap-1.5 overflow-x-hidden border-t border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
        <button type="button" className="rounded-lg p-2 hover:bg-white/10">
          <MessageCircleMore className="size-4" />
        </button>
        <button type="button" className="rounded-lg p-2 hover:bg-white/10">
          <Paperclip className="size-4" />
        </button>
        <input
          value={content}
          onChange={event => setContent(event.target.value)}
          placeholder="Digite sua mensagem..."
          className="h-9 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-sm outline-none placeholder:text-[var(--text-muted)]/70"
        />
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-full bg-emerald-600/85 px-3 hover:bg-emerald-500"
          onClick={() => sendMessage()}
        >
          <Send className="size-3.5" />
        </Button>
        <button type="button" className="shrink-0 rounded-lg p-2 hover:bg-white/10">
          <Volume2 className="size-4" />
        </button>
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
    <aside className="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/[0.05] bg-white/[0.015] p-2.5">
      {!conversation ? (
        <AppEmptyState
          title="Sem contexto ativo"
          description="Selecione uma conversa para abrir contexto operacional."
        />
      ) : (
        <div className="space-y-2.5 text-xs">
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Cliente</p>
            <p className="mt-1 font-semibold">João Silva</p>
            <p className="text-[11px] text-[var(--text-muted)]">5511999998888</p>
            <Button type="button" size="sm" variant="outline" className="mt-3 h-7 text-[11px]">Ver cliente</Button>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Próximo agendamento</p>
            <p className="mt-1 font-medium">Manutenção preventiva</p>
            <p className="text-[11px] text-[var(--text-muted)]">24/04/2026 às 14:00</p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">Pendente confirmação</span>
            <Button type="button" size="sm" variant="outline" className="mt-3 h-7 text-[11px]">Ver agendamento</Button>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Ordem de serviço</p>
            <p className="mt-1 font-medium">OS #236</p>
            <p className="text-[11px] text-[var(--text-muted)]">Status: Em andamento</p>
            <p className="text-[11px] text-[var(--text-muted)]">Técnico: William Machado</p>
            <Button type="button" size="sm" variant="outline" className="mt-3 h-7 text-[11px]">Ver O.S.</Button>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Cobrança</p>
            <p className="mt-1 font-medium">Cobrança #1247</p>
            <p className="text-[11px] text-[var(--text-muted)]">Vencimento: 20/04/2026</p>
            <p className="text-[11px]">Valor: R$ 480,00</p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100">Atrasada 3 dias</span>
            <Button type="button" size="sm" variant="outline" className="mt-3 h-7 text-[11px]">Ver cobrança</Button>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Última interação</p>
            <p className="mt-1">Mensagem enviada</p>
            <p className="text-[11px] text-[var(--text-muted)]">Hoje, 09:40</p>
            <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">Entregue</span>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Ações rápidas</p>
            <div className="mt-2.5 grid grid-cols-1 gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]" onClick={() => sendMessage("Cobrança")}>Enviar cobrança</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]">Registrar pagamento</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]" onClick={() => sendMessage("Lembrete")}>Enviar lembrete</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 w-full min-w-0 justify-start truncate px-2.5 text-[11px]">Mais ações</Button>
            </div>
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
  const [searchTerm, setSearchTerm] = useOperationalMemoryState(
    "nexo.whatsapp.search.v2",
    ""
  );
  const [activeFilter, setActiveFilter] =
    useOperationalMemoryState<ConversationFilter>(
      "nexo.whatsapp.filter.v2",
      "all"
    );
  const [content, setContent] = useOperationalMemoryState(
    "nexo.whatsapp.composer.v2",
    ""
  );
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [messagePages, setMessagePages] = useState<any[][]>([]);
  const [demoMessageState, setDemoMessageState] =
    useState<Record<string, ChatMessage[]>>(demoMessages);

  const conversationsQuery = trpc.nexo.whatsapp.conversations.useQuery(
    undefined,
    { retry: false }
  );
  const sendMutation = trpc.nexo.whatsapp.send.useMutation();

  const apiConversations = useMemo(
    () =>
      Array.isArray(conversationsQuery.data)
        ? (conversationsQuery.data as Conversation[])
        : [],
    [conversationsQuery.data]
  );
  const conversations =
    apiConversations.length > 0 ? apiConversations : demoConversations;
  const isDemoMode = apiConversations.length === 0;

  useEffect(() => {
    if (!selectedCustomerId && conversations[0]?.customerId)
      setSelectedCustomerId(conversations[0].customerId);
  }, [conversations, selectedCustomerId, setSelectedCustomerId]);

  const isApiConversationSelected = apiConversations.some(
    item => item.customerId === selectedCustomerId
  );
  const messagesFeedQuery = trpc.nexo.whatsapp.messagesFeed.useQuery(
    { customerId: selectedCustomerId, limit: 20, cursor },
    {
      enabled: Boolean(selectedCustomerId) && isApiConversationSelected,
      retry: false,
    }
  );

  useEffect(() => {
    setCursor(undefined);
    setMessagePages([]);
  }, [selectedCustomerId]);

  useEffect(() => {
    const payload = messagesFeedQuery.data as
      | { items?: any[]; nextCursor?: string | null }
      | undefined;
    if (!payload?.items) return;
    const pageItems = payload.items;
    setMessagePages(prev => (!cursor ? [pageItems] : [...prev, pageItems]));
  }, [messagesFeedQuery.data, cursor]);

  const selectedConversation = conversations.find(
    item => item.customerId === selectedCustomerId
  );

  const filteredConversations = useMemo(() => {
    const text = searchTerm.toLowerCase().trim();
    return conversations.filter(item => {
      if (activeFilter === "no_reply" && item.status !== "awaiting")
        return false;
      if (activeFilter === "billing" && item.contextType !== "charge")
        return false;
      if (activeFilter === "failures" && item.status !== "failed") return false;
      if (
        text &&
        !item.name.toLowerCase().includes(text) &&
        !item.lastMessage.toLowerCase().includes(text)
      )
        return false;
      return true;
    });
  }, [activeFilter, conversations, searchTerm]);

  const messages = useMemo<ChatMessage[]>(() => {
    if (isDemoMode) return demoMessageState[selectedCustomerId] ?? [];
    return messagePages
      .flat()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map(item => ({
        id: String(item?.id),
        side:
          String(item?.status ?? "").toUpperCase() === "RECEIVED"
            ? "incoming"
            : "outgoing",
        text: String(item?.renderedText ?? ""),
        at: fmtTime(item?.createdAt),
        delivered: true,
      }));
  }, [demoMessageState, isDemoMode, messagePages, selectedCustomerId]);

  async function sendMessage(preset?: string) {
    if (!selectedConversation) return;
    const finalContent = (preset ?? content).trim();
    if (finalContent.length < 2) {
      toast.error("Digite uma mensagem operacional válida.");
      return;
    }

    if (isDemoMode) {
      const now = new Date();
      const at = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setDemoMessageState(prev => ({
        ...prev,
        [selectedConversation.customerId]: [
          ...(prev[selectedConversation.customerId] ?? []),
          {
            id: `demo-${Date.now()}`,
            side: "outgoing",
            text: finalContent,
            at,
            delivered: true,
          },
        ],
      }));
      setContent("");
      toast.success("Mensagem adicionada no modo de dados piloto.");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        customerId: selectedConversation.customerId,
        content: finalContent,
        idempotencyKey: buildIdempotencyKey(
          "whatsapp.operational_send",
          selectedConversation.customerId
        ),
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

  if (conversationsQuery.error && !isDemoMode) {
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

  const nextCursor = (messagesFeedQuery.data as any)?.nextCursor as
    | string
    | null
    | undefined;

  return (
    <AppPageShell className="h-full overflow-hidden bg-[#0B111C] px-3 py-3">
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <button type="button" className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-1.5 text-[var(--text-muted)] hover:bg-white/[0.05]">
              <PanelLeftClose className="size-4" />
            </button>
            <div>
              <h1 className="text-sm font-semibold">WhatsApp</h1>
              <p className="text-[11px] text-[var(--text-muted)]">
                Canal de execução conectado ao contexto de operação.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              <Circle className="size-2.5 fill-current" /> Online
            </div>
            {isDemoMode ? (
              <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">
                Dados piloto
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 md:flex">
              <Search className="size-3.5 text-[var(--text-muted)]" />
              <input placeholder="Buscar..." className="w-36 bg-transparent text-xs outline-none placeholder:text-[var(--text-muted)]/70" />
            </div>
            <button type="button" className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-1.5 text-[var(--text-muted)] hover:bg-white/[0.05]">
              <Bell className="size-4" />
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs hover:bg-white/[0.05]">
              <UserCircle2 className="size-4 text-[var(--accent-primary)]" />
              Paula
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden bg-transparent xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(280px,320px)]">
            <div className="min-w-0">
              <ConversationsList
                rows={filteredConversations}
                selectedId={selectedCustomerId}
                onSelect={setSelectedCustomerId}
                filter={activeFilter}
                onFilter={setActiveFilter}
                search={searchTerm}
                onSearch={setSearchTerm}
              />
            </div>
            <div className="min-w-0">
              <ChatPanel
                conversation={selectedConversation}
                messages={messages}
                isLoading={messagesFeedQuery.isLoading && !isDemoMode}
                isLoadingMore={messagesFeedQuery.isFetching && Boolean(cursor)}
                hasMore={Boolean(nextCursor)}
                onLoadMore={() => {
                  if (nextCursor) setCursor(nextCursor);
                }}
                content={content}
                setContent={setContent}
                sendMessage={sendMessage}
              />
            </div>
            <div className="hidden min-w-0 xl:block">
              <ContextPanel
                conversation={selectedConversation}
                sendMessage={sendMessage}
              />
            </div>
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}
