import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  History,
  Info,
  Search,
  Send,
  Sparkles,
  UserRound,
  WandSparkles,
  Workflow,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { cn } from "@/lib/utils";
import { Button, Badge } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { AppEmptyState, AppLoadingState } from "@/components/internal-page-system";

type ConversationFilter = "all" | "no_reply" | "billing" | "appointment" | "service_order" | "failures" | "suggestions";
type MessageSendStatus = "queued" | "sent" | "delivered" | "failed" | "unknown";
type MessageKind = "incoming" | "outgoing" | "automation" | "event";
type WorkspaceView = "conversations" | "chat" | "context" | "automations" | "history";

const QUICK_ACTIONS = [
  {
    key: "confirm_appointment",
    label: "Confirmar agendamento",
    content: "Olá! Confirmando seu agendamento para hoje. Qualquer ajuste, me avise por aqui.",
  },
  {
    key: "send_charge",
    label: "Enviar cobrança",
    content: "Olá! Segue o lembrete da cobrança pendente. Posso te enviar novamente o link de pagamento?",
  },
  {
    key: "request_reply",
    label: "Cobrar retorno",
    content: "Passando para confirmar se conseguiu ver nossa última mensagem. Posso te ajudar com algo agora?",
  },
  {
    key: "delay_notice",
    label: "Avisar atraso",
    content: "Atualizando seu atendimento: tivemos um atraso na operação, mas seu caso já está priorizado.",
  },
  {
    key: "confirm_completion",
    label: "Confirmar conclusão",
    content: "Concluímos a execução da sua solicitação. Se precisar de ajuste final, responda por aqui.",
  },
  {
    key: "free_message",
    label: "Mensagem livre",
    content: "",
  },
] as const;

const FILTERS: Array<{ key: ConversationFilter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "no_reply", label: "Sem resposta" },
  { key: "billing", label: "Cobrança" },
  { key: "appointment", label: "Agendamento" },
  { key: "service_order", label: "O.S." },
  { key: "failures", label: "Falhas" },
  { key: "suggestions", label: "Sugestões" },
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
  return parsed ? parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
}

function sinceDays(value: unknown) {
  const parsed = safeDate(value);
  if (!parsed) return null;
  const diff = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
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
  const direction = String(message?.direction ?? message?.flow ?? "").toUpperCase();
  const origin = String(message?.origin ?? message?.source ?? "").toUpperCase();
  const type = String(message?.type ?? message?.category ?? "").toUpperCase();

  if (type.includes("EVENT") || origin.includes("SYSTEM")) return "event";
  if (origin.includes("AUTO") || type.includes("AUTO")) return "automation";
  if (direction.includes("IN") || origin.includes("CUSTOMER") || origin.includes("CLIENT")) return "incoming";
  return "outgoing";
}

function statusLabel(status: MessageSendStatus) {
  switch (status) {
    case "queued":
      return "Na fila";
    case "sent":
      return "Enviada";
    case "delivered":
      return "Entregue";
    case "failed":
      return "Falhou";
    default:
      return "Sem status";
  }
}

function statusTone(status: MessageSendStatus) {
  switch (status) {
    case "failed":
      return "text-rose-500";
    case "delivered":
      return "text-emerald-500";
    case "queued":
      return "text-amber-500";
    default:
      return "text-[var(--text-muted)]";
  }
}

function statusIcon(status: MessageSendStatus) {
  switch (status) {
    case "queued":
      return <Clock3 className="size-3.5" />;
    case "sent":
      return <Check className="size-3.5" />;
    case "delivered":
      return <CheckCheck className="size-3.5" />;
    case "failed":
      return <span className="text-[10px] font-bold leading-none">!</span>;
    default:
      return null;
  }
}

function stateTone(state: string) {
  if (state === "Falha") return "text-rose-500";
  if (state === "Cobrança") return "text-amber-500";
  if (state === "Sem resposta") return "text-sky-500";
  return "text-[var(--text-secondary)]";
}

export default function WhatsAppPage() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const search = new URLSearchParams(location.split("?")[1] ?? "");
  const queryCustomerId = search.get("customerId") ?? "";

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);

  const [selectedCustomerId, setSelectedCustomerId] = useState(queryCustomerId || String(customers[0]?.id ?? ""));
  const [content, setContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>("all");
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<WorkspaceView>(queryCustomerId ? "chat" : "conversations");

  const selectedCustomer = customers.find((item) => String(item?.id) === selectedCustomerId);

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId },
    { enabled: Boolean(selectedCustomerId), retry: false }
  );
  const sendMutation = trpc.nexo.whatsapp.send.useMutation();

  const selectedMessages = useMemo(() => normalizeArrayPayload<any>(messagesQuery.data), [messagesQuery.data]);

  const failed = selectedMessages.filter((item) => normalizeMessageStatus(item?.status) === "failed").length;
  const delivered = selectedMessages.filter((item) => normalizeMessageStatus(item?.status) === "delivered").length;

  usePageDiagnostics({
    page: "whatsapp",
    isLoading: messagesQuery.isLoading,
    hasError: Boolean(messagesQuery.error),
    isEmpty: !messagesQuery.isLoading && !messagesQuery.error && selectedMessages.length === 0,
    dataCount: selectedMessages.length,
  });

  const automationSuggestions = useMemo(() => {
    const now = Date.now();
    const items: Array<{
      id: string;
      customerId: string;
      title: string;
      reason: string;
      impact: string;
      urgency: "Alta" | "Média";
      preview: string;
      origin: string;
    }> = [];

    for (const charge of charges) {
      if (String(charge?.status ?? "").toUpperCase() !== "OVERDUE") continue;
      const customerId = String(charge?.customerId ?? "");
      const customer = customers.find((item) => String(item?.id) === customerId);
      if (!customerId || !customer?.phone) continue;
      const value = Number(charge?.amountCents ?? 0) / 100;
      items.push({
        id: `overdue-${String(charge?.id ?? customerId)}`,
        customerId,
        title: `Cobrança vencida · ${String(customer?.name ?? "Cliente")}`,
        reason: "Cobrança vencida detectada",
        impact: value > 0 ? `Impacto financeiro: R$ ${value.toFixed(2).replace(".", ",")}` : "Impacto financeiro imediato",
        urgency: "Alta",
        preview: "Olá, identificamos cobrança em aberto. Podemos regularizar hoje para evitar bloqueios?",
        origin: "Financeiro",
      });
    }

    for (const serviceOrder of serviceOrders) {
      const status = String(serviceOrder?.status ?? "").toUpperCase();
      if (status !== "OVERDUE" && status !== "AT_RISK") continue;
      const customerId = String(serviceOrder?.customerId ?? "");
      const customer = customers.find((item) => String(item?.id) === customerId);
      if (!customerId || !customer?.phone) continue;
      items.push({
        id: `so-delay-${String(serviceOrder?.id ?? customerId)}`,
        customerId,
        title: `Atraso de O.S. · ${String(customer?.name ?? "Cliente")}`,
        reason: "Ordem em atraso operacional",
        impact: "Impacto em SLA e retenção",
        urgency: "Alta",
        preview: "Atualização rápida: sua O.S. está em prioridade máxima e enviamos novo horário estimado.",
        origin: "Service Desk",
      });
    }

    for (const customer of customers) {
      const customerId = String(customer?.id ?? "");
      if (!customerId || !customer?.phone) continue;
      const lastContact = safeDate(customer?.lastContactAt);
      if (lastContact && now - lastContact.getTime() < 1000 * 60 * 60 * 24 * 14) continue;
      items.push({
        id: `no-contact-${customerId}`,
        customerId,
        title: `Cliente sem contato · ${String(customer?.name ?? "Cliente")}`,
        reason: "Sem interação recente",
        impact: "Oportunidade de reativação",
        urgency: "Média",
        preview: "Passando para confirmar se está tudo bem e se você precisa de algum suporte nesta semana.",
        origin: "Relacionamento",
      });
    }

    return items.slice(0, 8);
  }, [charges, customers, serviceOrders]);

  const conversations = useMemo(() => {
    return customers.map((customer) => {
      const cid = String(customer?.id ?? "");
      const relatedCharge = charges.find((charge) => String(charge?.customerId ?? "") === cid && String(charge?.status ?? "").toUpperCase() === "OVERDUE");
      const relatedServiceOrder = serviceOrders.find((serviceOrder) => {
        const status = String(serviceOrder?.status ?? "").toUpperCase();
        return String(serviceOrder?.customerId ?? "") === cid && (status === "OVERDUE" || status === "AT_RISK");
      });
      const suggestionsForConversation = automationSuggestions.filter((item) => item.customerId === cid);
      const hasFailure = cid === selectedCustomerId && failed > 0;
      const lastContact = safeDate(customer?.lastContactAt);
      const noReplyDays = lastContact ? Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24)) : 99;
      const isNoReply = !lastContact || noReplyDays > 3;

      const state = hasFailure
        ? "Falha"
        : relatedCharge
          ? "Cobrança"
          : relatedServiceOrder
            ? "O.S."
            : isNoReply
              ? "Sem resposta"
              : "Saudável";

      const contextBadge = relatedServiceOrder
        ? "Agendamento"
        : suggestionsForConversation.length > 0
          ? "Automação sugerida"
          : null;

      const suggestedSnippet = relatedCharge
        ? "Cobrança vencida precisa de retorno."
        : relatedServiceOrder
          ? "O.S. com risco operacional."
          : isNoReply
            ? `Sem interação há ${noReplyDays} dia${noReplyDays === 1 ? "" : "s"}.`
            : "Conversa em andamento.";

      const urgencyScore = Number(Boolean(relatedCharge)) * 4 + Number(Boolean(relatedServiceOrder)) * 3 + Number(hasFailure) * 5 + Number(isNoReply) * 2;

      return {
        id: cid,
        name: String(customer?.name ?? "Cliente"),
        phone: String(customer?.phone ?? "—"),
        lastInteraction: lastContact,
        snippet: suggestedSnippet,
        state,
        contextBadge,
        suggestionsCount: suggestionsForConversation.length,
        hasCharge: Boolean(relatedCharge),
        hasServiceOrder: Boolean(relatedServiceOrder),
        isNoReply,
        noReplyDays,
        urgencyScore,
      };
    }).sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [automationSuggestions, charges, customers, failed, selectedCustomerId, serviceOrders]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const filterMatch = (() => {
        if (activeFilter === "all") return true;
        if (activeFilter === "no_reply") return conversation.state === "Sem resposta";
        if (activeFilter === "billing") return conversation.state === "Cobrança";
        if (activeFilter === "appointment") return conversation.contextBadge === "Agendamento";
        if (activeFilter === "service_order") return conversation.state === "O.S.";
        if (activeFilter === "failures") return conversation.state === "Falha";
        if (activeFilter === "suggestions") return conversation.suggestionsCount > 0;
        return true;
      })();

      const searchMatch = !normalizedSearch
        || conversation.name.toLowerCase().includes(normalizedSearch)
        || conversation.phone.replace(/\D/g, "").includes(normalizedSearch.replace(/\D/g, ""));

      return filterMatch && searchMatch;
    });
  }, [activeFilter, conversations, searchTerm]);

  const conversationSuggestions = useMemo(
    () => automationSuggestions.filter((item) => item.customerId === selectedCustomerId),
    [automationSuggestions, selectedCustomerId]
  );

  const chargePendingForSelected = charges.some(
    (charge) => String(charge?.customerId ?? "") === selectedCustomerId && String(charge?.status ?? "").toUpperCase() === "OVERDUE"
  );
  const futureAppointmentForSelected = serviceOrders.some((item) => {
    if (String(item?.customerId ?? "") !== selectedCustomerId) return false;
    const status = String(item?.status ?? "").toUpperCase();
    return status === "SCHEDULED" || status === "AT_RISK";
  });
  const recentServiceOrder = serviceOrders.find((item) => String(item?.customerId ?? "") === selectedCustomerId);

  const sortedMessages = useMemo(() => {
    return [...selectedMessages]
      .sort((a, b) => {
        const left = safeDate(a?.createdAt)?.getTime() ?? 0;
        const right = safeDate(b?.createdAt)?.getTime() ?? 0;
        return left - right;
      })
      .map((message) => ({
        ...message,
        _kind: detectMessageKind(message),
        _deliveryStatus: normalizeMessageStatus(message?.status),
      }));
  }, [selectedMessages]);

  const lastMessage = sortedMessages[sortedMessages.length - 1];
  const noReplyDays = sinceDays(lastMessage?.createdAt ?? selectedCustomer?.lastContactAt);

  const intelligenceSignals = useMemo(() => {
    const items: Array<{ id: string; label: string; tone: "danger" | "attention" | "neutral" }> = [];
    if (chargePendingForSelected) items.push({ id: "charge", label: "Cobrança vencida", tone: "danger" });
    if (futureAppointmentForSelected) items.push({ id: "so", label: "Operação em risco", tone: "attention" });
    if ((noReplyDays ?? 0) >= 3) items.push({ id: "no-reply", label: `Sem resposta há ${noReplyDays}d`, tone: "attention" });
    if (conversationSuggestions.length > 0) items.push({ id: "suggestion", label: `${conversationSuggestions.length} ação sugerida`, tone: "neutral" });
    if (failed > 0) items.push({ id: "failed", label: `${failed} falha de envio`, tone: "danger" });
    return items;
  }, [chargePendingForSelected, futureAppointmentForSelected, noReplyDays, conversationSuggestions.length, failed]);

  const historyEvents = useMemo(() => {
    const events: Array<{ id: string; label: string; detail: string; at: string; type: "billing" | "warning" | "automation" | "normal" }> = [];

    if (chargePendingForSelected) {
      events.push({
        id: "charge-overdue",
        label: "Cobrança pendente",
        detail: "Existe cobrança vencida que pode disparar contato automático.",
        at: fmtDateTime(new Date()),
        type: "billing",
      });
    }

    if (futureAppointmentForSelected) {
      events.push({
        id: "schedule",
        label: "Agendamento operacional",
        detail: "Atendimento com status de acompanhamento ativo.",
        at: fmtDateTime(recentServiceOrder?.updatedAt ?? recentServiceOrder?.createdAt),
        type: "warning",
      });
    }

    const failedMessage = [...sortedMessages].reverse().find((message) => message._deliveryStatus === "failed");
    if (failedMessage) {
      events.push({
        id: "failed-send",
        label: "Falha de entrega",
        detail: "Última tentativa de envio retornou falha e requer ação.",
        at: fmtDateTime(failedMessage?.createdAt),
        type: "warning",
      });
    }

    if (conversationSuggestions.length > 0) {
      events.push({
        id: "suggested-action",
        label: "Próxima ação recomendada",
        detail: "O sistema detectou oportunidade de automação para acelerar a conversa.",
        at: fmtDateTime(new Date()),
        type: "automation",
      });
    }

    if (events.length === 0 && sortedMessages.length > 0) {
      events.push({
        id: "recent-message",
        label: "Conversa ativa",
        detail: "Últimas mensagens sem bloqueios operacionais críticos.",
        at: fmtDateTime(lastMessage?.createdAt),
        type: "normal",
      });
    }

    return events;
  }, [chargePendingForSelected, futureAppointmentForSelected, lastMessage?.createdAt, recentServiceOrder?.createdAt, recentServiceOrder?.updatedAt, sortedMessages, conversationSuggestions.length]);

  async function sendMessage() {
    if (!selectedCustomerId || content.trim().length < 2) {
      toast.error("Selecione o cliente e escreva uma mensagem válida para enviar.");
      return;
    }
    const phone = String(selectedCustomer?.phone ?? "").replace(/\D/g, "");
    if (phone.length < 10) {
      toast.error("Cliente sem número válido para WhatsApp.");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        customerId: selectedCustomerId,
        content: content.trim(),
        idempotencyKey: buildIdempotencyKey("whatsapp.manual_send", selectedCustomerId),
      });
      setContent("");
      toast.success("Mensagem enviada com sucesso.");
      await Promise.all([
        messagesQuery.refetch(),
        invalidateOperationalGraph(utils, selectedCustomerId),
      ]);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao enviar mensagem.");
    }
  }

  async function executeSuggestedMessage(customerIdToSend: string, preview: string) {
    setSelectedCustomerId(customerIdToSend);
    setContent(preview);
    await sendMutation.mutateAsync({
      customerId: customerIdToSend,
      content: preview,
      idempotencyKey: buildIdempotencyKey("whatsapp.automation_send", customerIdToSend),
    });
    toast.success("Automação executada com 1 clique.");
    await Promise.all([messagesQuery.refetch(), invalidateOperationalGraph(utils, customerIdToSend)]);
  }

  return (
    <PageWrapper title="WhatsApp Operacional" subtitle="">
      <section className="space-y-4">
        <header className="rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-elevated)_58%,var(--surface-primary))] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Central de execução</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Conversa, decisão e ação no mesmo fluxo operacional</p>
            </div>
            {selectedCustomer ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">{String(selectedCustomer.name ?? "Cliente")}</p>
                <Badge>{failed > 0 ? "Falha" : delivered > 0 ? "Saudável" : "Sem resposta"}</Badge>
              </div>
            ) : null}
          </div>
        </header>

        <WorkspaceModeTabs activeView={activeWorkspaceView} onChange={setActiveWorkspaceView} />

        <main className="min-h-[74vh] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]">
          {activeWorkspaceView === "conversations" ? (
            <ConversationsView
              filteredConversations={filteredConversations}
              selectedCustomerId={selectedCustomerId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onSelectConversation={(conversationId) => {
                setSelectedCustomerId(conversationId);
                setActiveWorkspaceView("chat");
              }}
            />
          ) : null}

          {activeWorkspaceView === "chat" ? (
            <ChatView
              selectedCustomer={selectedCustomer}
              messages={sortedMessages}
              isLoading={messagesQuery.isLoading}
              content={content}
              onContentChange={setContent}
              onSend={() => void sendMessage()}
              isSending={sendMutation.isPending}
              quickActions={QUICK_ACTIONS}
              onQuickAction={setContent}
              onOpenConversations={() => setActiveWorkspaceView("conversations")}
              signals={intelligenceSignals}
              noReplyDays={noReplyDays}
            />
          ) : null}

          {activeWorkspaceView === "context" ? (
            <ContextWorkspaceView
              selectedCustomer={selectedCustomer}
              selectedMessages={sortedMessages}
              chargePendingForSelected={chargePendingForSelected}
              futureAppointmentForSelected={futureAppointmentForSelected}
              recentServiceOrder={recentServiceOrder}
              noReplyDays={noReplyDays}
            />
          ) : null}

          {activeWorkspaceView === "automations" ? (
            <AutomationsWorkspaceView
              selectedCustomer={selectedCustomer}
              conversationSuggestions={conversationSuggestions}
              onApplySuggestion={(preview) => {
                setContent(preview);
                setActiveWorkspaceView("chat");
              }}
              onExecuteSuggestion={(item) => {
                void executeSuggestedMessage(item.customerId, item.preview);
                setActiveWorkspaceView("chat");
              }}
            />
          ) : null}

          {activeWorkspaceView === "history" ? (
            <HistoryWorkspaceView selectedCustomer={selectedCustomer} historyEvents={historyEvents} />
          ) : null}
        </main>
      </section>
    </PageWrapper>
  );
}

function WorkspaceModeTabs({ activeView, onChange }: { activeView: WorkspaceView; onChange: (value: WorkspaceView) => void }) {
  return (
    <nav className="rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-elevated)_60%,var(--surface-primary))] p-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <WorkspaceModeButton label="Conversas" active={activeView === "conversations"} onClick={() => onChange("conversations")} />
        <WorkspaceModeButton label="Conversar" active={activeView === "chat"} onClick={() => onChange("chat")} icon={Send} />
        <WorkspaceModeButton label="Contexto" icon={Info} active={activeView === "context"} onClick={() => onChange("context")} />
        <WorkspaceModeButton label="Executar" icon={WandSparkles} active={activeView === "automations"} onClick={() => onChange("automations")} />
        <WorkspaceModeButton label="Histórico" icon={History} active={activeView === "history"} onClick={() => onChange("history")} />
      </div>
    </nav>
  );
}

function WorkspaceModeButton({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: typeof Info;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-all",
        active
          ? "border-[var(--border-emphasis)] bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
          : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-primary)]/80 hover:text-[var(--text-primary)]"
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      <span>{label}</span>
    </button>
  );
}

function ConversationsView({
  filteredConversations,
  selectedCustomerId,
  searchTerm,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onSelectConversation,
}: {
  filteredConversations: Array<{
    id: string;
    name: string;
    phone: string;
    lastInteraction: Date | null;
    snippet: string;
    state: string;
    contextBadge: string | null;
    hasCharge: boolean;
    hasServiceOrder: boolean;
    isNoReply: boolean;
    noReplyDays: number;
    suggestionsCount: number;
    urgencyScore: number;
  }>;
  selectedCustomerId: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeFilter: ConversationFilter;
  onFilterChange: (value: ConversationFilter) => void;
  onSelectConversation: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[74vh] flex-col">
      <div className="border-b border-[var(--border-subtle)] px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">Radar de conversas</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Priorize cobranças, riscos operacionais e clientes sem retorno com leitura instantânea.</p>
          </div>
          <Badge>{filteredConversations.length} em foco</Badge>
        </div>

        <div className="relative mt-4 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar cliente ou telefone"
            className="h-11 pl-9"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => onFilterChange(filter.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                activeFilter === filter.key
                  ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)]/40 hover:text-[var(--text-primary)]"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {filteredConversations.length === 0 ? (
          <AppEmptyState
            title="Nenhuma conversa encontrada"
            description="Ajuste o filtro ou a busca para localizar uma conversa operacional."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)]/70">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectConversation(conversation.id)}
                className={cn(
                  "group relative w-full px-4 py-4 text-left transition-all md:px-5",
                  selectedCustomerId === conversation.id
                    ? "bg-[color-mix(in_srgb,var(--surface-elevated)_76%,var(--surface-primary))]"
                    : "hover:bg-[var(--surface-elevated)]/35"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{conversation.name}</p>
                      {conversation.hasCharge ? <Badge>Cobrança</Badge> : null}
                      {conversation.hasServiceOrder ? <Badge>O.S.</Badge> : null}
                      {conversation.suggestionsCount > 0 ? <Badge>{conversation.suggestionsCount} sugestão(ões)</Badge> : null}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{conversation.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[var(--text-muted)]">{fmtTime(conversation.lastInteraction)}</span>
                    <p className={cn("mt-1 text-xs font-medium", stateTone(conversation.state))}>{conversation.state}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-start justify-between gap-4">
                  <p className="text-sm text-[var(--text-secondary)]">{conversation.snippet}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    Abrir
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>

                {conversation.isNoReply ? (
                  <p className="mt-2 text-xs text-amber-500">Sem retorno há {conversation.noReplyDays} dia{conversation.noReplyDays === 1 ? "" : "s"}.</p>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({
  selectedCustomer,
  messages,
  isLoading,
  content,
  onContentChange,
  onSend,
  isSending,
  quickActions,
  onQuickAction,
  onOpenConversations,
  signals,
  noReplyDays,
}: {
  selectedCustomer: any;
  messages: Array<any>;
  isLoading: boolean;
  content: string;
  onContentChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  quickActions: ReadonlyArray<{ key: string; label: string; content: string }>;
  onQuickAction: (value: string) => void;
  onOpenConversations: () => void;
  signals: Array<{ id: string; label: string; tone: "danger" | "attention" | "neutral" }>;
  noReplyDays: number | null;
}) {
  if (!selectedCustomer) {
    return (
      <div className="flex min-h-[74vh] items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <AppEmptyState
            title="Nenhuma conversa selecionada"
            description="Abra o modo Conversas para escolher um cliente e iniciar o atendimento operacional."
          />
          <Button type="button" variant="outline" onClick={onOpenConversations}>
            Ir para Conversas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[74vh] grid-rows-[auto_minmax(0,1fr)_auto]">
      <header className="border-b border-[var(--border-subtle)] px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">{String(selectedCustomer.name ?? "Cliente")}</p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{String(selectedCustomer.phone ?? "Telefone não informado")}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">{noReplyDays !== null ? `Último retorno há ${noReplyDays} dia(s)` : "Sem histórico de resposta"}</p>
          </div>
          <div className="flex max-w-xl flex-wrap justify-end gap-2">
            {signals.map((signal) => (
              <span
                key={signal.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                  signal.tone === "danger"
                    ? "border-rose-500/35 bg-rose-500/10 text-rose-500"
                    : signal.tone === "attention"
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-500"
                      : "border-[var(--border-subtle)] bg-[var(--surface-elevated)]/65 text-[var(--text-secondary)]"
                )}
              >
                {signal.tone === "danger" ? <AlertTriangle className="size-3.5" /> : <Sparkles className="size-3.5" />}
                {signal.label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="min-h-0 overflow-y-auto bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--surface-elevated)_28%,transparent),transparent_140px)] px-4 py-5 md:px-7">
        {isLoading ? (
          <AppLoadingState rows={7} />
        ) : messages.length === 0 ? (
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col justify-end">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 px-3 py-1 text-xs text-[var(--text-secondary)]">
              <Bot className="size-3.5" />
              Sem mensagens ainda — a conversa está pronta para começar.
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl space-y-4">
            {messages.map((message) => {
              if (message._kind === "event") {
                return (
                  <div key={String(message?.id)} className="mx-auto flex w-full items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-1 text-[11px] text-[var(--text-secondary)]">
                      <Workflow className="size-3.5" />
                      {String(message?.content ?? "Evento operacional")}
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)]">{fmtTime(message?.createdAt)}</span>
                    <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                  </div>
                );
              }

              const fromClient = message._kind === "incoming";
              return (
                <div key={String(message?.id)} className={cn("flex", fromClient ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[82%] rounded-2xl px-4 py-3",
                      fromClient
                        ? "rounded-tl-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/75"
                        : "rounded-tr-md border border-[var(--border-emphasis)] bg-[color-mix(in_srgb,var(--surface-elevated)_82%,var(--bg-surface))]"
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                      {fromClient ? <UserRound className="size-3" /> : message._kind === "automation" ? <Bot className="size-3" /> : <Send className="size-3" />}
                      <span>{fromClient ? "Cliente" : message._kind === "automation" ? "Automação" : "Operação"}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--text-primary)]">{String(message?.content ?? "")}</p>
                    <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[var(--text-muted)]">
                      <span>{fmtTime(message?.createdAt)}</span>
                      {!fromClient ? (
                        <span className={cn("inline-flex items-center gap-1", statusTone(message._deliveryStatus))}>
                          {statusIcon(message._deliveryStatus)}
                          {statusLabel(message._deliveryStatus)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-4 md:px-6">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => onQuickAction(action.content)}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/40 px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-all hover:border-[var(--border-emphasis)]/40 hover:text-[var(--text-primary)]"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/45 px-3 py-3">
            <Textarea
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Escreva a mensagem, ajuste uma sugestão ou acione uma resposta rápida..."
              className="min-h-[64px] flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            <Button type="button" onClick={onSend} disabled={isSending || content.trim().length < 2} className="h-10 rounded-xl px-4">
              <Send className="mr-1 size-4" />
              Enviar
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContextWorkspaceView({
  selectedCustomer,
  selectedMessages,
  chargePendingForSelected,
  futureAppointmentForSelected,
  recentServiceOrder,
  noReplyDays,
}: {
  selectedCustomer: any;
  selectedMessages: Array<any>;
  chargePendingForSelected: boolean;
  futureAppointmentForSelected: boolean;
  recentServiceOrder: any;
  noReplyDays: number | null;
}) {
  if (!selectedCustomer) {
    return (
      <div className="flex min-h-[74vh] items-center justify-center p-8">
        <AppEmptyState
          title="Contexto indisponível"
          description="Selecione uma conversa para acompanhar os dados operacionais do cliente."
        />
      </div>
    );
  }

  const contextRows = [
    { label: "Cliente", value: String(selectedCustomer?.name ?? "—") },
    { label: "Telefone", value: String(selectedCustomer?.phone ?? "—") },
    { label: "Última interação", value: fmtDateTime(selectedMessages[selectedMessages.length - 1]?.createdAt ?? selectedCustomer?.lastContactAt) },
    { label: "Mensagens no histórico", value: String(selectedMessages.length) },
    { label: "O.S. recente", value: recentServiceOrder ? String(recentServiceOrder?.status ?? "Registrada") : "Sem O.S. recente" },
    { label: "Responsável interno", value: String(selectedCustomer?.ownerName ?? "Operação Nexo") },
    { label: "Observações", value: String(selectedCustomer?.notes ?? "Sem observações registradas") },
  ];

  return (
    <div className="min-h-[74vh] px-6 py-6 md:px-8">
      <div className="max-w-5xl space-y-4">
        <div className="space-y-1">
          <p className="text-base font-semibold text-[var(--text-primary)]">Contexto para decisão</p>
          <p className="text-sm text-[var(--text-secondary)]">Priorize o que impacta resposta, cobrança e execução antes de responder no chat.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-rose-500">Criticidade</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{chargePendingForSelected ? "Cobrança pendente" : "Sem cobrança crítica"}</p>
          </section>
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-amber-500">Operação</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{futureAppointmentForSelected ? "Agendamento em acompanhamento" : "Sem risco imediato"}</p>
          </section>
          <section className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-sky-500">Relacionamento</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{(noReplyDays ?? 0) >= 3 ? `Sem resposta há ${noReplyDays} dias` : "Contato recente"}</p>
          </section>
        </div>
      </div>

      <div className="mt-6 divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)]/80">
        {contextRows.map((row) => (
          <div key={row.label} className="grid gap-2 px-4 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start md:px-6">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{row.label}</p>
            <p className="text-sm text-[var(--text-primary)]">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationsWorkspaceView({
  selectedCustomer,
  conversationSuggestions,
  onApplySuggestion,
  onExecuteSuggestion,
}: {
  selectedCustomer: any;
  conversationSuggestions: Array<{ id: string; customerId: string; title: string; reason: string; urgency: "Alta" | "Média"; origin: string; impact: string; preview: string }>;
  onApplySuggestion: (preview: string) => void;
  onExecuteSuggestion: (item: { customerId: string; preview: string }) => void;
}) {
  if (!selectedCustomer) {
    return (
      <div className="flex min-h-[74vh] items-center justify-center p-8">
        <AppEmptyState
          title="Automações indisponíveis"
          description="Selecione uma conversa para exibir sugestões acionáveis desta operação."
        />
      </div>
    );
  }

  if (conversationSuggestions.length === 0) {
    return (
      <div className="flex min-h-[74vh] items-center justify-center p-8">
        <AppEmptyState
          title="Nenhuma automação disponível"
          description="Quando houver gatilho de cobrança, atraso ou reativação, ele aparecerá aqui para execução rápida."
        />
      </div>
    );
  }

  const [primarySuggestion, ...secondarySuggestions] = conversationSuggestions;

  return (
    <div className="min-h-[74vh] space-y-6 px-6 py-6 md:px-8">
      <section className="rounded-2xl border border-[var(--border-emphasis)] bg-[linear-gradient(130deg,color-mix(in_srgb,var(--surface-elevated)_78%,var(--surface-primary))_20%,var(--surface-primary)_100%)] p-6">
        <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          <Sparkles className="size-3.5" />
          melhor próxima ação
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-lg font-semibold text-[var(--text-primary)]">{primarySuggestion.title}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{primarySuggestion.reason}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{primarySuggestion.impact}</p>
          </div>
          <Badge>{primarySuggestion.urgency}</Badge>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/85 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Mensagem sugerida</p>
          <p className="mt-2 text-sm text-[var(--text-primary)]">{primarySuggestion.preview}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Workflow className="size-4" />
            Origem: {primarySuggestion.origin}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onApplySuggestion(primarySuggestion.preview)}>
              Revisar no chat
            </Button>
            <Button type="button" onClick={() => onExecuteSuggestion(primarySuggestion)}>
              Executar agora
            </Button>
          </div>
        </div>
      </section>

      {secondarySuggestions.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Opções secundárias</p>
          <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]/70">
            {secondarySuggestions.map((item) => (
              <article key={item.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.reason}</p>
                  </div>
                  <Badge>{item.urgency}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.preview}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-muted)]">Origem: {item.origin}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => onApplySuggestion(item.preview)}>
                    Levar ao chat
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HistoryWorkspaceView({
  selectedCustomer,
  historyEvents,
}: {
  selectedCustomer: any;
  historyEvents: Array<{ id: string; label: string; detail: string; at: string; type: "billing" | "warning" | "automation" | "normal" }>;
}) {
  if (!selectedCustomer) {
    return (
      <div className="flex min-h-[74vh] items-center justify-center p-8">
        <AppEmptyState
          title="Histórico indisponível"
          description="Selecione uma conversa para visualizar a timeline operacional auditável."
        />
      </div>
    );
  }

  if (historyEvents.length === 0) {
    return (
      <div className="flex min-h-[74vh] items-center justify-center p-8">
        <AppEmptyState
          title="Sem histórico recente"
          description="Os eventos operacionais desta conversa aparecerão aqui conforme a execução avança."
        />
      </div>
    );
  }

  return (
    <div className="min-h-[74vh] px-6 py-6 md:px-8">
      <div className="max-w-4xl">
        <p className="mb-4 text-base font-semibold text-[var(--text-primary)]">Linha do tempo operacional</p>
        <div className="space-y-1">
          {historyEvents.map((event, index) => (
            <article key={event.id} className="relative grid gap-1 rounded-lg px-4 py-3 pl-11 hover:bg-[var(--surface-elevated)]/35">
              {index < historyEvents.length - 1 ? (
                <span className="absolute -bottom-5 left-[21px] top-8 w-px bg-[var(--border-subtle)]" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "absolute left-3 top-3.5 inline-flex size-5 items-center justify-center rounded-full border",
                  event.type === "billing"
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-500"
                    : event.type === "warning"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-500"
                      : event.type === "automation"
                        ? "border-violet-500/40 bg-violet-500/15 text-violet-500"
                        : "border-[var(--border-subtle)] bg-[var(--surface-primary)] text-[var(--text-muted)]"
                )}
                aria-hidden
              >
                {event.type === "automation" ? <Bot className="size-3" /> : <Clock3 className="size-3" />}
              </span>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{event.label}</p>
              <p className="text-sm text-[var(--text-secondary)]">{event.detail}</p>
              <p className="text-xs text-[var(--text-muted)]">{event.at}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
