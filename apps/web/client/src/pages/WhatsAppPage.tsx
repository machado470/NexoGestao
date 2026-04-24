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
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCheck,
  Circle,
  Clock3,
  EllipsisVertical,
  Info,
  MessageCircleMore,
  Paperclip,
  Search,
  Send,
  Star,
  Volume2,
  Wallet,
  Zap,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/design-system";
import {
  AppPageHeader,
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
  pending: { label: "Pendente", dot: "bg-sky-400" },
  ok: { label: "OK", dot: "bg-emerald-400" },
  failed: { label: "Falha", dot: "bg-rose-400" },
};

const ROW_HEIGHT = 110;

const topStats = [
  {
    label: "Aguardando resposta",
    value: "6",
    detail: "2 acima de 30 min",
    icon: Clock3,
    tone: "text-amber-300",
  },
  {
    label: "Falhas de envio",
    value: "2",
    detail: "requer ação manual",
    icon: AlertTriangle,
    tone: "text-rose-300",
  },
  {
    label: "Cobranças pendentes",
    value: "3",
    detail: "R$ 1.240,00 em aberto",
    icon: Wallet,
    tone: "text-violet-300",
  },
  {
    label: "Agendamentos hoje",
    value: "1",
    detail: "14:00 confirmado",
    icon: CalendarClock,
    tone: "text-sky-300",
  },
];

const footerMetrics = [
  ["Tempo médio resposta", "42 min"],
  ["Conversas abertas", "18"],
  ["Taxa de resposta", "92%"],
  ["Mensagens enviadas", "156"],
  ["Falhas de envio", "2"],
] as const;

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
    <div style={style} className="px-1 py-1">
      <button
        type="button"
        onClick={() => onSelect(conversation.customerId)}
        className={cn(
          "w-full rounded-xl border px-3 py-2 text-left transition",
          selectedId === conversation.customerId
            ? "border-sky-400/60 bg-indigo-950/40"
            : "border-white/10 bg-[var(--surface-primary)]/35 hover:border-white/20"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-semibold">
              {conversation.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {conversation.name}
              </p>
              {conversation.badge ? (
                <p className="truncate text-[10px] text-violet-300">
                  {conversation.badge}
                </p>
              ) : null}
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            {fmtTime(conversation.lastMessageAt)}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-secondary)]">
          {conversation.lastMessage}
        </p>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          {conversation.unreadCount ? (
            <span className="rounded-full bg-orange-500/25 px-1.5 py-0.5 text-[10px] text-orange-200">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </button>
    </div>
  );
});

function TopOperationalStats() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {topStats.map(item => (
        <article
          key={item.label}
          className="rounded-xl border border-white/10 bg-[var(--surface-primary)]/45 p-3"
        >
          <div className="flex items-center gap-2">
            <item.icon className={cn("size-4", item.tone)} />
            <p className={cn("text-xs", item.tone)}>{item.label}</p>
          </div>
          <p className="mt-1 text-2xl font-semibold leading-none">
            {item.value}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {item.detail}
          </p>
        </article>
      ))}
    </div>
  );
}

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
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface-primary)]/45 p-2">
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 px-2 py-1.5">
          <Search className="size-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="h-7 w-full bg-transparent text-xs outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.slice(0, 3).map(item => (
            <button
              key={item.value}
              type="button"
              className={cn(
                "h-7 rounded-full border px-2.5 text-[11px]",
                filter === item.value
                  ? "border-white/60 bg-white/10"
                  : "border-white/10 text-[var(--text-muted)]"
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
        className="mt-2 flex-1 min-h-0 overflow-y-auto"
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface-base)]/55">
      <header className="shrink-0 flex items-center justify-between border-b border-white/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-semibold">
            {conversation?.name?.slice(0, 1) ?? "-"}
          </div>
          <div>
            <p className="text-xs font-semibold">
              {conversation?.name ?? "Selecione uma conversa"}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {conversation?.phone ?? ""}
            </p>
          </div>
          {conversation ? (
            <span className="rounded-full bg-amber-500/20 px-2 py-1 text-[10px] text-amber-200">
              COBRANÇA PENDENTE
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          <button type="button" className="rounded-lg p-1 hover:bg-white/10">
            <Star className="size-4" />
          </button>
          <button type="button" className="rounded-lg p-1 hover:bg-white/10">
            <Info className="size-4" />
          </button>
          <button type="button" className="rounded-lg p-1 hover:bg-white/10">
            <EllipsisVertical className="size-4" />
          </button>
        </div>
      </header>

      <div
        ref={messagesRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
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
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <AppSkeleton key={idx} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
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
                      "max-w-[70%] rounded-xl px-3 py-2 text-sm",
                      outgoing
                        ? "bg-emerald-900/45"
                        : "border border-white/10 bg-slate-900/70"
                    )}
                  >
                    <p>{message.text}</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]">
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

      <div className="shrink-0 flex items-center gap-2 overflow-x-auto border-t border-white/10 px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TEMPLATES.map(template => (
          <Button
            key={template}
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg text-[11px]"
            onClick={() => setContent(template)}
          >
            {template}
          </Button>
        ))}
      </div>

      <footer className="shrink-0 flex items-center gap-2 border-t border-white/10 px-2 py-1.5">
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
          className="h-9 w-full rounded-xl border border-white/10 bg-transparent px-3 text-sm outline-none"
        />
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-full bg-emerald-600 px-3 hover:bg-emerald-500"
          onClick={() => sendMessage()}
        >
          <Send className="size-3.5" />
        </Button>
        <button type="button" className="rounded-lg p-2 hover:bg-white/10">
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
    <aside className="h-full min-h-0 min-w-0 overflow-y-auto rounded-2xl border border-white/10 bg-[var(--surface-primary)]/45 p-2.5">
      {!conversation ? (
        <AppEmptyState
          title="Sem contexto ativo"
          description="Selecione uma conversa para abrir contexto operacional."
        />
      ) : (
        <div className="space-y-2 text-xs">
          <section className="rounded-xl border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Cliente
            </p>
            <p className="mt-1 font-semibold">João Silva</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              5511999998888
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-[11px]"
            >
              Ver cliente
            </Button>
          </section>
          <section className="rounded-xl border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Próximo agendamento
            </p>
            <p className="mt-1 font-medium">Manutenção preventiva</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              24/04/2026 às 14:00
            </p>
            <span className="mt-1 inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
              PENDENTE CONFIRMAÇÃO
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-[11px]"
            >
              Ver agendamento
            </Button>
          </section>
          <section className="rounded-xl border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Ordens de serviço
            </p>
            <p className="mt-1 font-medium">OS #236</p>
            <p className="text-[11px] text-[var(--text-muted)]">Em andamento</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Técnico: William Machado
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-[11px]"
            >
              Ver O.S.
            </Button>
          </section>
          <section className="rounded-xl border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Financeiro
            </p>
            <p className="mt-1 font-medium">Cobrança #1247</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Vencimento: 20/04/2026
            </p>
            <span className="mt-1 inline-flex rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-200">
              ATRASADA 3 DIAS
            </span>
            <p className="mt-1 text-[11px]">Valor: R$ 480,00</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-[11px]"
            >
              Ver cobrança
            </Button>
          </section>
          <section className="rounded-xl border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Última interação
            </p>
            <p className="mt-1">Mensagem enviada</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Link de pagamento
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">Hoje, 09:40</p>
            <span className="mt-1 inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
              Entregue
            </span>
          </section>
          <section className="rounded-xl border border-white/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Ações rápidas
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 justify-start text-[11px]"
                onClick={() => sendMessage("Cobrança")}
              >
                Enviar cobrança
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 justify-start text-[11px]"
              >
                Registrar pagamento
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 justify-start text-[11px]"
              >
                Atualizar O.S.
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 justify-start text-[11px]"
              >
                Mais ações
              </Button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function WhatsAppMetricsFooter() {
  return (
    <div className="shrink-0 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
      {footerMetrics.map(([label, value]) => (
        <article
          key={label}
          className="rounded-xl border border-white/10 bg-[var(--surface-primary)]/45 px-3 py-2"
        >
          <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </article>
      ))}
    </div>
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
    <AppPageShell className="px-3 py-3">
      <div className="flex flex-col overflow-y-auto xl:h-[calc(100vh-var(--altura-topbar,72px))] xl:min-h-0 xl:overflow-hidden">
        <AppPageHeader className="mb-3 flex min-h-14 shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-[var(--surface-primary)]/55 px-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">WhatsApp</h1>
              {isDemoMode ? (
                <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  Dados piloto
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Canal de execução operacional
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            <Circle className="size-2.5 fill-current" /> Online
          </div>
        </AppPageHeader>

        <div className="flex min-h-0 flex-col space-y-4">
          <div className="shrink-0">
            <TopOperationalStats />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[320px_minmax(0,1fr)_320px] xl:overflow-hidden">
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
            <ContextPanel
              conversation={selectedConversation}
              sendMessage={sendMessage}
            />
          </div>
          <WhatsAppMetricsFooter />
        </div>
      </div>
    </AppPageShell>
  );
}
