import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Clock3,
  History,
  Info,
  Search,
  Send,
  WandSparkles,
  UserRound,
  Workflow,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { cn } from "@/lib/utils";
import {
  formatDelta,
  getWindow,
  inRange,
  percentDelta,
  trendFromDelta,
} from "@/lib/operational/kpi";
import { Button, Badge } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { AppEmptyState, AppKpiRow, AppLoadingState } from "@/components/internal-page-system";

type ConversationFilter = "all" | "no_reply" | "billing" | "appointment" | "service_order" | "failures" | "suggestions";
type MessageSendStatus = "queued" | "sent" | "delivered" | "failed" | "unknown";
type MessageKind = "incoming" | "outgoing" | "automation" | "event";
type WorkspaceTab = "context" | "automation" | "history";

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
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("context");

  const selectedCustomer = customers.find((item) => String(item?.id) === selectedCustomerId);

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId },
    { enabled: Boolean(selectedCustomerId), retry: false }
  );
  const sendMutation = trpc.nexo.whatsapp.send.useMutation();

  const selectedMessages = useMemo(() => normalizeArrayPayload<any>(messagesQuery.data), [messagesQuery.data]);

  const failed = selectedMessages.filter((item) => normalizeMessageStatus(item?.status) === "failed").length;
  const delivered = selectedMessages.filter((item) => normalizeMessageStatus(item?.status) === "delivered").length;

  const current7 = getWindow(7, 0);
  const previous7 = getWindow(7, 1);
  const current7Messages = selectedMessages.filter((item) => inRange(safeDate(item?.createdAt), current7.start, current7.end));
  const previous7Messages = selectedMessages.filter((item) => inRange(safeDate(item?.createdAt), previous7.start, previous7.end));
  const current7DeliveryRate = current7Messages.length === 0
    ? 0
    : (current7Messages.filter((item) => normalizeMessageStatus(item?.status) === "delivered").length / current7Messages.length) * 100;
  const previous7DeliveryRate = previous7Messages.length === 0
    ? 0
    : (previous7Messages.filter((item) => normalizeMessageStatus(item?.status) === "delivered").length / previous7Messages.length) * 100;

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
      const isNoReply = !lastContact || Date.now() - lastContact.getTime() > 1000 * 60 * 60 * 24 * 3;

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
            ? "Sem interação recente."
            : "Conversa em andamento.";

      return {
        id: cid,
        name: String(customer?.name ?? "Cliente"),
        phone: String(customer?.phone ?? "—"),
        lastInteraction: lastContact,
        snippet: suggestedSnippet,
        state,
        contextBadge,
        suggestionsCount: suggestionsForConversation.length,
      };
    });
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

  const historyEvents = useMemo(() => {
    const events: Array<{ id: string; label: string; detail: string; at: string }> = [];

    if (chargePendingForSelected) {
      events.push({
        id: "charge-overdue",
        label: "Cobrança pendente",
        detail: "Existe cobrança vencida que pode disparar contato automático.",
        at: fmtDateTime(new Date()),
      });
    }

    if (futureAppointmentForSelected) {
      events.push({
        id: "schedule",
        label: "Agendamento operacional",
        detail: "Atendimento com status de acompanhamento ativo.",
        at: fmtDateTime(recentServiceOrder?.updatedAt ?? recentServiceOrder?.createdAt),
      });
    }

    const failedMessage = [...sortedMessages].reverse().find((message) => message._deliveryStatus === "failed");
    if (failedMessage) {
      events.push({
        id: "failed-send",
        label: "Falha de entrega",
        detail: "Última tentativa de envio retornou falha e requer ação.",
        at: fmtDateTime(failedMessage?.createdAt),
      });
    }

    if (events.length === 0 && sortedMessages.length > 0) {
      events.push({
        id: "recent-message",
        label: "Conversa ativa",
        detail: "Últimas mensagens sem bloqueios operacionais críticos.",
        at: fmtDateTime(lastMessage?.createdAt),
      });
    }

    return events;
  }, [chargePendingForSelected, futureAppointmentForSelected, lastMessage?.createdAt, recentServiceOrder?.createdAt, recentServiceOrder?.updatedAt, sortedMessages]);

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
    <PageWrapper
      title="WhatsApp Operacional"
      subtitle="Central de conversa operacional com contexto, histórico e automações no mesmo fluxo."
    >
      <AppKpiRow
        items={[
          {
            title: "Mensagens enviadas",
            value: String(selectedMessages.length),
            delta: formatDelta(percentDelta(current7Messages.length, previous7Messages.length)),
            trend: trendFromDelta(percentDelta(current7Messages.length, previous7Messages.length)),
            hint: "7 dias vs período anterior",
          },
          {
            title: "Taxa de entrega",
            value: `${current7DeliveryRate.toFixed(1).replace(".", ",")}%`,
            delta: formatDelta(percentDelta(current7DeliveryRate, previous7DeliveryRate)),
            trend: trendFromDelta(percentDelta(current7DeliveryRate, previous7DeliveryRate)),
            hint: "mensagens entregues / enviadas (7d)",
          },
          { title: "Falhas de envio", value: String(failed), hint: "status FAILED" },
          { title: "Automações prontas", value: String(conversationSuggestions.length), hint: "sugestões para esta conversa" },
        ]}
      />

      <section className="grid min-h-[74vh] gap-4 md:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={cn(
          "flex min-h-0 flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]",
          selectedCustomerId ? "hidden md:flex" : "flex"
        )}>
          <div className="border-b border-[var(--border-subtle)] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Conversas</p>
            <p className="text-xs text-[var(--text-secondary)]">Inbox operacional com prioridade e contexto</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar cliente ou telefone"
                className="pl-8"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    activeFilter === filter.key
                      ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {filteredConversations.length === 0 ? (
              <AppEmptyState
                title="Nenhuma conversa encontrada"
                description="Ajuste o filtro ou a busca para localizar uma conversa operacional."
              />
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(conversation.id);
                      setActiveWorkspaceTab("context");
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3.5 text-left transition-colors",
                      selectedCustomerId === conversation.id
                        ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]"
                        : "border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{conversation.name}</p>
                      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{fmtTime(conversation.lastInteraction)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{conversation.snippet}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge>{conversation.state}</Badge>
                      {conversation.contextBadge ? <Badge>{conversation.contextBadge}</Badge> : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className={cn(
          "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]",
          !selectedCustomerId ? "hidden md:flex" : "flex"
        )}>
          {!selectedCustomer ? (
            <div className="flex h-full items-center justify-center p-6">
              <AppEmptyState
                title="Nenhuma conversa selecionada"
                description="Selecione um cliente na lista para abrir o chat operacional com contexto e automações."
              />
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerId("")}
                      className="inline-flex rounded-md p-1 text-[var(--text-muted)] md:hidden"
                      aria-label="Voltar para lista de conversas"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{String(selectedCustomer.name ?? "Cliente")}</p>
                    <Badge>{failed > 0 ? "Falha" : delivered > 0 ? "Saudável" : "Sem resposta"}</Badge>
                  </div>
                  <p className="truncate text-xs text-[var(--text-secondary)]">{String(selectedCustomer.phone ?? "Telefone não informado")}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSearchTerm(String(selectedCustomer.name ?? ""))}>
                    Abrir cliente
                  </Button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(250px,0.45fr)]">
                  <div className="min-h-0 overflow-y-auto px-5 py-4">
                    {messagesQuery.isLoading ? (
                      <AppLoadingState rows={5} />
                    ) : sortedMessages.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="w-full max-w-2xl rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-elevated)]/30 p-8 text-center">
                          <p className="text-base font-semibold text-[var(--text-primary)]">Conversa pronta para operação</p>
                          <p className="mt-2 text-sm text-[var(--text-secondary)]">
                            Inicie o contato com uma ação rápida no composer ou execute uma automação sugerida no workspace abaixo.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sortedMessages.map((message) => {
                          if (message._kind === "event") {
                            return (
                              <div key={String(message?.id)} className="mx-auto w-full max-w-[82%] rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-elevated)]/60 px-3 py-2 text-center">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Evento operacional</p>
                                <p className="mt-1 text-xs text-[var(--text-secondary)]">{String(message?.content ?? "Atualização registrada na operação.")}</p>
                                <p className="mt-1 text-[11px] text-[var(--text-muted)]">{fmtDateTime(message?.createdAt)}</p>
                              </div>
                            );
                          }

                          const fromClient = message._kind === "incoming";
                          return (
                            <div key={String(message?.id)} className={cn("flex", fromClient ? "justify-start" : "justify-end")}>
                              <div
                                className={cn(
                                  "max-w-[78%] rounded-2xl border px-3 py-2.5",
                                  fromClient
                                    ? "border-[var(--border-subtle)] bg-[var(--surface-elevated)]"
                                    : "border-[var(--border-emphasis)] bg-[color-mix(in_srgb,var(--surface-elevated)_86%,var(--bg-surface))]"
                                )}
                              >
                                <div className="mb-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                                  {fromClient ? <UserRound className="size-3" /> : message._kind === "automation" ? <Bot className="size-3" /> : <Send className="size-3" />}
                                  <span>{fromClient ? "Cliente" : message._kind === "automation" ? "Automação" : "Operador"}</span>
                                </div>
                                <p className="text-sm text-[var(--text-primary)]">{String(message?.content ?? "")}</p>
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
                  <div className="border-t border-[var(--border-subtle)] px-5 py-4">
                    <WorkspaceTabs
                      activeTab={activeWorkspaceTab}
                      onChange={setActiveWorkspaceTab}
                      selectedCustomer={selectedCustomer}
                      selectedMessages={sortedMessages}
                      chargePendingForSelected={chargePendingForSelected}
                      futureAppointmentForSelected={futureAppointmentForSelected}
                      recentServiceOrder={recentServiceOrder}
                      conversationSuggestions={conversationSuggestions}
                      historyEvents={historyEvents}
                      onApplySuggestion={(preview) => setContent(preview)}
                      onExecuteSuggestion={(item) => void executeSuggestedMessage(item.customerId, item.preview)}
                    />
                  </div>
                </div>
              </div>

              <footer className="border-t border-[var(--border-subtle)] px-5 py-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => setContent(action.content)}
                      className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <Textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Escreva a mensagem ou use uma ação rápida..."
                    className="min-h-[96px] resize-y"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--text-muted)]">Template sugerido, contexto e mensagem livre no mesmo fluxo.</p>
                    <Button type="button" onClick={() => void sendMessage()} disabled={sendMutation.isPending}>
                      <Send className="mr-1 size-4" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </footer>
            </>
          )}
        </main>
      </section>
    </PageWrapper>
  );
}

function WorkspaceTabs({
  activeTab,
  onChange,
  selectedCustomer,
  selectedMessages,
  chargePendingForSelected,
  futureAppointmentForSelected,
  recentServiceOrder,
  conversationSuggestions,
  historyEvents,
  onApplySuggestion,
  onExecuteSuggestion,
}: {
  activeTab: WorkspaceTab;
  onChange: (value: WorkspaceTab) => void;
  selectedCustomer: any;
  selectedMessages: Array<any>;
  chargePendingForSelected: boolean;
  futureAppointmentForSelected: boolean;
  recentServiceOrder: any;
  conversationSuggestions: Array<{ id: string; customerId: string; title: string; reason: string; urgency: "Alta" | "Média"; origin: string; preview: string }>;
  historyEvents: Array<{ id: string; label: string; detail: string; at: string }>;
  onApplySuggestion: (preview: string) => void;
  onExecuteSuggestion: (item: { customerId: string; preview: string }) => void;
}) {
  if (!selectedCustomer) {
    return (
      <div className="flex h-full items-center justify-center p-2">
        <AppEmptyState
          title="Contexto indisponível"
          description="Selecione uma conversa para acompanhar contexto, automações e histórico operacional."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="inline-flex w-full flex-wrap gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/35 p-1.5">
        <WorkspaceTabButton
          icon={Info}
          label="Contexto"
          active={activeTab === "context"}
          onClick={() => onChange("context")}
        />
        <WorkspaceTabButton
          icon={WandSparkles}
          label="Automações"
          active={activeTab === "automation"}
          onClick={() => onChange("automation")}
        />
        <WorkspaceTabButton
          icon={History}
          label="Histórico"
          active={activeTab === "history"}
          onClick={() => onChange("history")}
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
        {activeTab === "context" ? (
          <ContextPanel
            selectedCustomer={selectedCustomer}
            selectedMessages={selectedMessages}
            chargePendingForSelected={chargePendingForSelected}
            futureAppointmentForSelected={futureAppointmentForSelected}
            recentServiceOrder={recentServiceOrder}
          />
        ) : null}

        {activeTab === "automation" ? (
          <AutomationPanel
            conversationSuggestions={conversationSuggestions}
            onApplySuggestion={onApplySuggestion}
            onExecuteSuggestion={onExecuteSuggestion}
          />
        ) : null}

        {activeTab === "history" ? <HistoryTimeline historyEvents={historyEvents} /> : null}
      </div>
    </div>
  );
}

function WorkspaceTabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Info;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-[var(--border-emphasis)] bg-[var(--surface-primary)] text-[var(--text-primary)]"
          : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function ContextPanel({
  selectedCustomer,
  selectedMessages,
  chargePendingForSelected,
  futureAppointmentForSelected,
  recentServiceOrder,
}: {
  selectedCustomer: any;
  selectedMessages: Array<any>;
  chargePendingForSelected: boolean;
  futureAppointmentForSelected: boolean;
  recentServiceOrder: any;
}) {
  const contextRows = [
    { label: "Cliente", value: String(selectedCustomer?.name ?? "—") },
    { label: "Telefone", value: String(selectedCustomer?.phone ?? "—") },
    { label: "Última interação", value: fmtDateTime(selectedMessages[selectedMessages.length - 1]?.createdAt ?? selectedCustomer?.lastContactAt) },
    { label: "Mensagens enviadas", value: String(selectedMessages.length) },
    { label: "Cobrança pendente", value: chargePendingForSelected ? "Sim" : "Não" },
    { label: "Agendamento futuro", value: futureAppointmentForSelected ? "Sim" : "Não" },
    { label: "O.S. recente", value: recentServiceOrder ? String(recentServiceOrder?.status ?? "Registrada") : "Sem O.S. recente" },
    { label: "Responsável interno", value: String(selectedCustomer?.ownerName ?? "Operação Nexo") },
  ];

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {contextRows.map((row) => (
        <div key={row.label} className="grid gap-1 py-2.5 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{row.label}</p>
          <p className="text-sm text-[var(--text-primary)]">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function AutomationPanel({
  conversationSuggestions,
  onApplySuggestion,
  onExecuteSuggestion,
}: {
  conversationSuggestions: Array<{ id: string; customerId: string; title: string; reason: string; urgency: "Alta" | "Média"; origin: string; preview: string }>;
  onApplySuggestion: (preview: string) => void;
  onExecuteSuggestion: (item: { customerId: string; preview: string }) => void;
}) {
  if (conversationSuggestions.length === 0) {
    return (
      <AppEmptyState
        title="Nenhuma automação disponível"
        description="Quando houver gatilho de cobrança, atraso ou reativação, ele aparecerá aqui para execução rápida."
      />
    );
  }

  const [primarySuggestion, ...secondarySuggestions] = conversationSuggestions;
  return (
    <div className="space-y-3">
      <article className="rounded-xl border border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/55 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{primarySuggestion.title}</p>
          <Badge>{primarySuggestion.urgency}</Badge>
        </div>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{primarySuggestion.reason}</p>
        <p className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-2.5 text-xs text-[var(--text-secondary)]">
          {primarySuggestion.preview}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Workflow className="size-3.5" />
            Origem: {primarySuggestion.origin}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onApplySuggestion(primarySuggestion.preview)}>
              Usar
            </Button>
            <Button type="button" size="sm" onClick={() => onExecuteSuggestion(primarySuggestion)}>
              Executar agora
            </Button>
          </div>
        </div>
      </article>

      {secondarySuggestions.length > 0 ? (
        <div className="space-y-2">
          {secondarySuggestions.map((item) => (
            <article key={item.id} className="rounded-xl border border-[var(--border-subtle)] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                <Badge>{item.urgency}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.reason}</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{item.preview}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted)]">Origem: {item.origin}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => onApplySuggestion(item.preview)}>
                  Usar
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HistoryTimeline({ historyEvents }: { historyEvents: Array<{ id: string; label: string; detail: string; at: string }> }) {
  if (historyEvents.length === 0) {
    return (
      <AppEmptyState
        title="Sem histórico recente"
        description="Os eventos operacionais desta conversa aparecerão aqui conforme a execução avança."
      />
    );
  }

  return (
    <div className="space-y-1">
      {historyEvents.map((event, index) => (
        <article key={event.id} className="relative grid gap-2 pb-4 pl-7 last:pb-0">
          {index < historyEvents.length - 1 ? (
            <span className="absolute bottom-0 left-[8px] top-6 w-px bg-[var(--border-subtle)]" aria-hidden />
          ) : null}
          <span className="absolute left-0 top-1.5 inline-flex size-4 items-center justify-center rounded-full border border-[var(--border-emphasis)] bg-[var(--surface-primary)]" aria-hidden>
            <span className="size-1.5 rounded-full bg-[var(--text-primary)]" />
          </span>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{event.label}</p>
          <p className="text-xs text-[var(--text-secondary)]">{event.detail}</p>
          <p className="text-[11px] text-[var(--text-muted)]">{event.at}</p>
        </article>
      ))}
    </div>
  );
}
