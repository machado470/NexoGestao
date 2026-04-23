import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Check, CheckCheck, CircleDashed, Clock3, MessageCircle, Search, Send, Sparkles, Workflow, XCircle } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { cn } from "@/lib/utils";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { Button } from "@/components/design-system";
import { Textarea } from "@/components/ui/textarea";
import { AppPageShell, AppSectionCard, AppSkeleton, AppTimeline, AppTimelineItem, AppToolbar } from "@/components/app-system";
import {
  AppEmptyState,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppOperationalHeader,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

type ConversationFilter = "all" | "no_reply" | "billing" | "appointment" | "service_order" | "failures" | "resolved";
type MessageSendStatus = "queued" | "sent" | "delivered" | "failed" | "unknown";
type MessageKind = "incoming" | "outgoing" | "automation" | "event";
type Severity = "healthy" | "attention" | "critical";

const QUICK_ACTIONS = [
  {
    key: "confirm_appointment",
    label: "Confirmação de agenda",
    content: "Olá! Confirmando seu agendamento. Posso seguir com sua janela combinada?",
  },
  {
    key: "appointment_reminder",
    label: "Lembrete",
    content: "Passando para lembrar seu atendimento de hoje. Qualquer ajuste me avise por aqui.",
  },
  {
    key: "send_charge",
    label: "Cobrança",
    content: "Olá! Identificamos uma pendência em aberto. Posso reenviar o link de pagamento por aqui?",
  },
  {
    key: "payment_link",
    label: "Link de pagamento",
    content: "Segue novamente o link de pagamento para regularização rápida.",
  },
  {
    key: "service_update",
    label: "Atualização de O.S.",
    content: "Atualização da sua O.S.: execução em andamento com retorno no próximo bloco operacional.",
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
  return parsed ? parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function sinceDays(value: unknown) {
  const parsed = safeDate(value);
  if (!parsed) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
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
  if (status === "queued") return "Na fila";
  if (status === "sent") return "Enviada";
  if (status === "delivered") return "Entregue";
  if (status === "failed") return "Falhou";
  return "Sem status";
}

function severityFromScore(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 5) return "attention";
  return "healthy";
}

function riskLabel(severity: Severity) {
  if (severity === "critical") return "Crítico";
  if (severity === "attention") return "Atenção";
  return "Saudável";
}

function nextBestAction(snapshot: {
  hasFailed: boolean;
  hasOverdueCharge: boolean;
  isAwaitingReply: boolean;
  hasServiceOrderRisk: boolean;
  hasScheduled: boolean;
}) {
  if (snapshot.hasFailed) {
    return { title: "Reenviar mensagem falhada", description: "Último envio falhou. Reenvie agora para evitar quebra do fluxo.", cta: "Reenviar" };
  }
  if (snapshot.hasOverdueCharge) {
    return { title: "Cobrar pendência vencida", description: "Cobrança vencida ligada à conversa. Priorize regularização.", cta: "Cobrar" };
  }
  if (snapshot.hasScheduled) {
    return { title: "Confirmar agendamento", description: "Conversa vinculada à agenda. Confirme presença e reduza no-show.", cta: "Confirmar" };
  }
  if (snapshot.hasServiceOrderRisk) {
    return { title: "Atualizar status da O.S.", description: "Cliente precisa atualização de execução para reduzir risco operacional.", cta: "Atualizar" };
  }
  if (snapshot.isAwaitingReply) {
    return { title: "Executar follow-up", description: "Cliente sem retorno recente. Faça follow-up objetivo agora.", cta: "Follow-up" };
  }
  return { title: "Conversa resolvida", description: "Sem bloqueios críticos agora. Mantenha monitoramento contextual.", cta: "Acompanhar" };
}

function WhatsStatusBadge({ label }: { label: string }) {
  return <AppStatusBadge label={label} />;
}

function WhatsContextCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function WhatsAppPage() {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const searchParams = new URLSearchParams(location.split("?")[1] ?? "");
  const queryCustomerId = searchParams.get("customerId") ?? "";

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);

  const [selectedCustomerId, setSelectedCustomerId] = useOperationalMemoryState("nexo.whatsapp.selected-customer.v1", queryCustomerId || "");
  const [searchTerm, setSearchTerm] = useOperationalMemoryState("nexo.whatsapp.search.v1", "");
  const [activeFilter, setActiveFilter] = useOperationalMemoryState<ConversationFilter>("nexo.whatsapp.filter.v1", "all");
  const [content, setContent] = useOperationalMemoryState("nexo.whatsapp.composer.v1", "");

  const selectedCustomer = customers.find(item => String(item?.id) === selectedCustomerId);

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery({ customerId: selectedCustomerId }, { enabled: Boolean(selectedCustomerId), retry: false });
  const sendMutation = trpc.nexo.whatsapp.send.useMutation();

  const selectedMessages = useMemo(() => normalizeArrayPayload<any>(messagesQuery.data), [messagesQuery.data]);
  const sortedMessages = useMemo(
    () =>
      [...selectedMessages]
        .sort((a, b) => (safeDate(a?.createdAt)?.getTime() ?? 0) - (safeDate(b?.createdAt)?.getTime() ?? 0))
        .map(message => ({
          ...message,
          _kind: detectMessageKind(message),
          _deliveryStatus: normalizeMessageStatus(message?.status),
        })),
    [selectedMessages]
  );

  const conversations = useMemo(() => {
    const selectedFailedCount = sortedMessages.filter(m => m._deliveryStatus === "failed").length;

    return customers
      .map(customer => {
        const customerId = String(customer?.id ?? "");
        const customerMessages = customerId === selectedCustomerId ? sortedMessages : [];
        const lastMessage = customerMessages[customerMessages.length - 1];
        const lastContact = safeDate(lastMessage?.createdAt ?? customer?.lastContactAt);
        const noReplyDays = sinceDays(lastContact) ?? 99;

        const customerCharges = charges.filter(charge => String(charge?.customerId ?? "") === customerId);
        const overdueCharges = customerCharges.filter(charge => String(charge?.status ?? "").toUpperCase() === "OVERDUE");
        const pendingCharges = customerCharges.filter(charge => String(charge?.status ?? "").toUpperCase() === "PENDING");
        const financialPendingCents = [...overdueCharges, ...pendingCharges].reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);

        const serviceOrder = serviceOrders.find(item => String(item?.customerId ?? "") === customerId);
        const serviceStatus = String(serviceOrder?.status ?? "").toUpperCase();

        const hasOverdueCharge = overdueCharges.length > 0;
        const hasServiceOrderRisk = serviceStatus === "AT_RISK" || serviceStatus === "OVERDUE" || serviceStatus === "BLOCKED";
        const hasScheduled = serviceStatus === "SCHEDULED" || serviceStatus === "WAITING_CUSTOMER";
        const hasFailed = customerId === selectedCustomerId && selectedFailedCount > 0;
        const isAwaitingReply = noReplyDays >= 2;
        const isResolved = !hasFailed && !hasOverdueCharge && !hasServiceOrderRisk && !isAwaitingReply;
        const workflowStatus = hasFailed ? "falha" : isAwaitingReply ? "aguardando resposta" : isResolved ? "resolvido" : "sem ação";

        const priorityScore = Number(hasFailed) * 7 + Number(hasOverdueCharge) * 6 + Number(hasServiceOrderRisk) * 4 + Number(hasScheduled) * 3 + Number(isAwaitingReply) * 3;

        const severity = severityFromScore(priorityScore);
        const contextType = hasOverdueCharge ? "cobrança" : hasScheduled ? "agendamento" : hasServiceOrderRisk ? "O.S." : "relacionamento";

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

  const selectedConversation = conversations.find(item => item.id === selectedCustomerId);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return conversations.filter(conversation => {
      const filterMatch = (() => {
        if (activeFilter === "all") return true;
        if (activeFilter === "no_reply") return conversation.isAwaitingReply;
        if (activeFilter === "billing") return conversation.hasOverdueCharge;
        if (activeFilter === "appointment") return conversation.hasScheduled;
        if (activeFilter === "service_order") return conversation.serviceOrder && ["AT_RISK", "OVERDUE", "BLOCKED"].includes(String(conversation.serviceOrder.status ?? "").toUpperCase());
        if (activeFilter === "failures") return conversation.hasFailed;
        if (activeFilter === "resolved") return conversation.isResolved;
        return true;
      })();

      const searchMatch =
        !normalizedSearch ||
        conversation.name.toLowerCase().includes(normalizedSearch) ||
        conversation.phone.replace(/\D/g, "").includes(normalizedSearch.replace(/\D/g, ""));

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
        action: () => setActiveFilter("no_reply" as ConversationFilter),
      },
      {
        id: "failures",
        label: "Falhas de envio",
        value: failures,
        description: "Mensagens exigem retry imediato.",
        action: () => setActiveFilter("failures" as ConversationFilter),
      },
      {
        id: "billing",
        label: "Cobranças pendentes",
        value: billing,
        description: "Conversas com impacto no caixa.",
        action: () => setActiveFilter("billing" as ConversationFilter),
      },
      {
        id: "appointments",
        label: "Agendamentos hoje",
        value: appointments,
        description: "Confirmações para reduzir no-show.",
        action: () => setActiveFilter("appointment" as ConversationFilter),
      },
    ] as const;
  }, [conversations, setActiveFilter]);

  const conversationPeriodLabel = useMemo(() => {
    const total = conversations.length;
    const pending = conversations.filter(item => !item.isResolved).length;
    return `Hoje · ${total} conversas · ${pending} com pendência`;
  }, [conversations]);

  usePageDiagnostics({
    page: "whatsapp",
    isLoading: customersQuery.isLoading,
    hasError: Boolean(customersQuery.error),
    isEmpty: !customersQuery.isLoading && !customersQuery.error && customers.length === 0,
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
        idempotencyKey: buildIdempotencyKey("whatsapp.operational_send", selectedConversation.id),
      });
      setContent("");
      toast.success("Mensagem operacional enviada.");
      await Promise.all([messagesQuery.refetch(), invalidateOperationalGraph(utils, selectedConversation.id)]);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao enviar mensagem.");
    }
  }

  if (customersQuery.isLoading && customers.length === 0) {
    return (
      <AppPageShell>
        <AppPageLoadingState title="Carregando execução de WhatsApp" description="Montando inbox priorizada e contexto operacional." />
      </AppPageShell>
    );
  }

  if (customersQuery.error && customers.length === 0) {
    return (
      <AppPageShell>
        <AppPageErrorState description="Não foi possível carregar o canal operacional do WhatsApp." actionLabel="Tentar novamente" onAction={() => void customersQuery.refetch()} />
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
      <AppOperationalHeader
        title="WhatsApp"
        description="Central de execução operacional por conversa: decisão rápida com contexto real do cliente ao pagamento."
        contextChips={
          <>
            <WhatsStatusBadge label={conversationPeriodLabel} />
            <WhatsStatusBadge label="Canal conectado" />
          </>
        }
        primaryAction={<Button type="button" onClick={() => setContent("Olá! Iniciando atendimento operacional contextual pelo Nexo.")}>Nova comunicação</Button>}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {communicationAlerts.map(alert => (
          <button
            key={alert.id}
            type="button"
            onClick={alert.action}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3 text-left transition-colors hover:bg-[var(--surface-elevated)]/65"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--text-muted)]">{alert.label}</p>
              <CircleDashed className="size-3.5 text-[var(--text-muted)]" />
            </div>
            <p className="mt-1 text-xl font-semibold leading-none text-[var(--text-primary)]">{alert.value}</p>
            <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{alert.description}</p>
          </button>
        ))}
      </section>

      <div className="grid min-h-[calc(100vh-270px)] gap-4 xl:grid-cols-[minmax(280px,20vw)_minmax(0,1fr)_minmax(300px,23vw)] 2xl:grid-cols-[minmax(320px,18vw)_minmax(0,1fr)_minmax(340px,20vw)]">
        <AppSectionBlock title="Inbox operacional" subtitle="Fila priorizada por consequência operacional." className="h-full p-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar cliente ou telefone"
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-emphasis)]"
              />
            </div>

            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max items-center gap-2">
                {FILTERS.map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    className={cn(
                      "h-8 rounded-xl border px-3 text-xs font-medium transition-colors",
                      activeFilter === filter.value
                        ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-primary)]/45 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-420px)] space-y-2 overflow-y-auto pr-1">
              {customersQuery.isFetching ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <AppSkeleton key={idx} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <AppEmptyState title="Nenhuma conversa no filtro" description="Ajuste o recorte para voltar à fila operacional." />
              ) : (
                filteredConversations.map(conversation => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(conversation.id)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition-colors",
                      selectedConversation?.id === conversation.id
                        ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/65"
                        : "border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 hover:bg-[var(--surface-elevated)]/45"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{conversation.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{conversation.phone}</p>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">{fmtTime(conversation.lastMessageAt)}</p>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">{conversation.snippet}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <AppPriorityBadge label={riskLabel(conversation.severity)} />
                      <WhatsStatusBadge label={conversation.contextType} />
                      <WhatsStatusBadge label={conversation.workflowStatus} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </AppSectionBlock>

        <AppSectionCard className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] p-0">
          {!selectedConversation ? (
            <div className="grid h-full place-items-center p-6">
              <AppEmptyState title="Selecione uma conversa" description="Escolha um cliente para executar confirmação, cobrança ou atualização de O.S." />
            </div>
          ) : (
            <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto_auto]">
              <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]/75 px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedConversation.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{selectedConversation.phone}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <WhatsStatusBadge label={selectedConversation.contextType} />
                    <WhatsStatusBadge label={selectedConversation.hasOverdueCharge ? "Cobrança pendente" : "Sem pendência crítica"} />
                    <WhatsStatusBadge label={selectedConversation.isAwaitingReply ? "Aguardando resposta" : "Fluxo ativo"} />
                  </div>
                </div>
              </header>

              <div className="space-y-3 overflow-y-auto bg-[var(--surface-base)]/55 px-6 py-4">
                {messagesQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <AppSkeleton key={idx} className="h-14 rounded-xl" />
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
                  <AppEmptyState title="Conversa sem mensagens" description="Use templates operacionais para iniciar contato com objetivo claro." />
                ) : (
                  sortedMessages.map(message => {
                    if (message._kind === "event") {
                      return (
                        <div key={String(message?.id)} className="mx-auto flex max-w-[66%] items-center gap-2 text-xs text-[var(--text-muted)]">
                          <Workflow className="size-3.5" />
                          <span>{String(message?.content ?? "Evento operacional")}</span>
                          <span className="ml-auto">{fmtTime(message?.createdAt)}</span>
                        </div>
                      );
                    }

                    const incoming = message._kind === "incoming";
                    const status = message._deliveryStatus as MessageSendStatus;

                    return (
                      <div key={String(message?.id)} className={cn("flex", incoming ? "justify-start" : "justify-end")}>
                        <div
                          className={cn(
                            "max-w-[66%] rounded-2xl border px-4 py-3",
                            incoming
                              ? "border-[var(--border-subtle)] bg-[var(--surface-primary)]"
                              : "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/60"
                          )}
                        >
                          <p className="text-sm leading-6 text-[var(--text-primary)]">{String(message?.content ?? "")}</p>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                            <span>{fmtTime(message?.createdAt)}</span>
                            {!incoming ? (
                              <span className="inline-flex items-center gap-1">
                                {status === "queued" ? <Clock3 className="size-3.5" /> : null}
                                {status === "sent" ? <Check className="size-3.5" /> : null}
                                {status === "delivered" ? <CheckCheck className="size-3.5" /> : null}
                                {status === "failed" ? <XCircle className="size-3.5" /> : null}
                                {statusLabel(status)}
                              </span>
                            ) : null}
                          </div>
                          {status === "failed" ? (
                            <Button type="button" size="sm" variant="outline" className="mt-2 h-7" onClick={() => void sendMessage(String(message?.content ?? ""))}>
                              Retry
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="overflow-x-auto border-t border-[var(--border-subtle)] bg-[var(--surface-primary)]/75 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max items-center gap-2">
                  {QUICK_ACTIONS.map(action => (
                    <Button key={action.key} type="button" size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => setContent(action.content)}>
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>

              <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-base)]/90 p-3">
                <div className="flex items-end gap-2">
                  <Button type="button" variant="outline" className="h-11 px-3" onClick={() => setContent(value => `${value}${value ? "\n" : ""}`)}>
                    <Sparkles className="size-4" />
                  </Button>
                  <Textarea
                    value={content}
                    onChange={event => setContent(event.target.value)}
                    placeholder="Descreva a ação operacional vinculando cliente, agenda, O.S. ou cobrança..."
                    className="min-h-[52px] resize-none rounded-xl"
                  />
                  <Button type="button" className="h-11 px-4" disabled={sendMutation.isPending || content.trim().length < 2} onClick={() => void sendMessage()}>
                    <Send className="mr-1 size-4" />
                    Executar envio
                  </Button>
                </div>
              </footer>
            </div>
          )}
        </AppSectionCard>

        <AppSectionBlock title="Contexto operacional" subtitle="Cliente, agenda, O.S., financeiro e timeline no mesmo campo de ação." className="h-full p-4">
          {!selectedConversation ? (
            <AppEmptyState title="Sem contexto ativo" description="Selecione uma conversa para exibir vínculos operacionais." />
          ) : (
            <div className="max-h-[calc(100vh-420px)] space-y-3 overflow-y-auto pr-1 text-sm">
              <WhatsContextCard title="Cliente">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedConversation.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{selectedConversation.phone}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <WhatsStatusBadge label={riskLabel(selectedConversation.severity)} />
                  <WhatsStatusBadge label={selectedConversation.isAwaitingReply ? "Aguardando resposta" : "Contato em dia"} />
                </div>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/customers/${selectedConversation.id}`)}>Ver cliente</Button>
              </WhatsContextCard>

              <WhatsContextCard title="Próximo agendamento">
                <p className="text-sm text-[var(--text-primary)]">
                  {selectedConversation.hasScheduled ? "Atendimento em aberto para confirmação." : "Sem agendamento confirmado agora."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate("/appointments")}>Ver agendamento</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void sendMessage("Confirmando seu horário de atendimento. Posso seguir com a janela planejada?")}>Confirmar</Button>
                </div>
              </WhatsContextCard>

              <WhatsContextCard title="Ordem de serviço">
                <p className="text-sm text-[var(--text-primary)]">
                  {selectedConversation.serviceOrder ? `Status: ${String(selectedConversation.serviceOrder?.status ?? "OPEN")}` : "Nenhuma O.S. vinculada ativa."}
                </p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => navigate("/service-orders")}>Ver O.S.</Button>
              </WhatsContextCard>

              <WhatsContextCard title="Financeiro">
                <p className="text-sm text-[var(--text-primary)]">
                  {selectedConversation.hasOverdueCharge
                    ? `${selectedConversation.overdueCharges.length} vencida(s) · ${fmtCurrency(selectedConversation.financialPendingCents)}`
                    : selectedConversation.pendingCharges.length > 0
                      ? `${selectedConversation.pendingCharges.length} pendente(s) · ${fmtCurrency(selectedConversation.financialPendingCents)}`
                      : "Sem pendência crítica"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Vencimento: {fmtDateTime(selectedConversation.overdueCharges[0]?.dueDate ?? selectedConversation.pendingCharges[0]?.dueDate)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void sendMessage("Identificamos pendência em aberto. Posso enviar o link para regularização agora?")}>Cobrar</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate("/finances")}>Ver cobrança</Button>
                </div>
              </WhatsContextCard>

              <WhatsContextCard title="Timeline curta">
                <AppTimeline className="space-y-2">
                  <AppTimelineItem className="p-2.5">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">Última interação registrada</p>
                    <p className="text-xs text-[var(--text-secondary)]">{fmtDateTime(sortedMessages[sortedMessages.length - 1]?.createdAt ?? selectedCustomer?.lastContactAt)}</p>
                  </AppTimelineItem>
                  {selectedConversation.hasFailed ? (
                    <AppTimelineItem className="p-2.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Retry disponível</p>
                      <p className="text-xs text-[var(--text-secondary)]">Falha de envio em aberto na conversa.</p>
                    </AppTimelineItem>
                  ) : null}
                </AppTimeline>
              </WhatsContextCard>
            </div>
          )}
        </AppSectionBlock>
      </div>

      <AppToolbar className="gap-2 px-3 py-2">
        <p className="text-xs text-[var(--text-secondary)]">Fluxo reforçado: cliente → agendamento → O.S. → cobrança → pagamento.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => selectedConversation && void sendMessage(selectedConversation.bestAction.description)} disabled={!selectedConversation}>
          <MessageCircle className="mr-1 size-4" /> Executar próxima ação
        </Button>
      </AppToolbar>
    </AppPageShell>
  );
}
