import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock3,
  MessageCircleWarning,
  Search,
  Send,
  Siren,
  UserRound,
  Workflow,
  XCircle,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/design-system";
import { Textarea } from "@/components/ui/textarea";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppEmptyState,
  AppOperationalBar,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

type ConversationFilter =
  | "all"
  | "no_reply"
  | "billing"
  | "appointment"
  | "service_order"
  | "failures";
type MessageSendStatus = "queued" | "sent" | "delivered" | "failed" | "unknown";
type MessageKind = "incoming" | "outgoing" | "automation" | "event";
type Severity = "healthy" | "attention" | "critical";

const QUICK_ACTIONS = [
  {
    key: "confirm_appointment",
    label: "Confirmar agendamento",
    content: "Olá! Confirmando seu agendamento. Está tudo certo para seguirmos no horário?",
  },
  {
    key: "send_charge",
    label: "Enviar cobrança",
    content: "Olá! Identificamos uma pendência em aberto. Posso reenviar o link de pagamento por aqui?",
  },
  {
    key: "payment_link",
    label: "Reenviar link",
    content: "Segue novamente o link de pagamento para facilitar sua regularização.",
  },
  {
    key: "service_update",
    label: "Atualização de O.S.",
    content: "Atualizando sua O.S.: seguimos em execução e retorno confirmado no próximo bloco operacional.",
  },
  {
    key: "follow_up",
    label: "Fazer follow-up",
    content: "Passando para confirmar se conseguiu ver nossa última atualização.",
  },
] as const;

const FILTERS: Array<{ value: ConversationFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "no_reply", label: "Não respondidos" },
  { value: "billing", label: "Cobranças" },
  { value: "appointment", label: "Agendamentos" },
  { value: "service_order", label: "O.S." },
  { value: "failures", label: "Falhas" },
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
    return { title: "Reenviar mensagem falhada", description: "Último envio falhou. Reenvie agora para evitar quebra de fluxo.", cta: "Reenviar mensagem" };
  }
  if (snapshot.hasOverdueCharge) {
    return { title: "Cobrar pendência vencida", description: "Existe cobrança vencida ligada à conversa. Priorize regularização.", cta: "Enviar cobrança" };
  }
  if (snapshot.hasScheduled) {
    return { title: "Confirmar agendamento", description: "Conversa vinculada a agenda. Confirme presença para reduzir no-show.", cta: "Confirmar agenda" };
  }
  if (snapshot.hasServiceOrderRisk) {
    return { title: "Atualizar status da O.S.", description: "Cliente precisa atualização de execução para reduzir risco operacional.", cta: "Atualizar cliente" };
  }
  if (snapshot.isAwaitingReply) {
    return { title: "Executar follow-up", description: "Cliente sem retorno recente. Faça follow-up objetivo agora.", cta: "Enviar follow-up" };
  }
  return { title: "Conversa saudável", description: "Sem bloqueios críticos agora. Mantenha acompanhamento com contexto.", cta: "Enviar atualização" };
}

export default function WhatsAppPage() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const searchParams = new URLSearchParams(location.split("?")[1] ?? "");
  const queryCustomerId = searchParams.get("customerId") ?? "";

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);

  const [selectedCustomerId, setSelectedCustomerId] = useState(queryCustomerId || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>("all");
  const [content, setContent] = useState("");

  const selectedCustomer = customers.find(item => String(item?.id) === selectedCustomerId);

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId },
    { enabled: Boolean(selectedCustomerId), retry: false }
  );
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

  const currentCustomerFailed = sortedMessages.filter(m => m._deliveryStatus === "failed").length;

  const conversations = useMemo(() => {
    return customers
      .map(customer => {
        const customerId = String(customer?.id ?? "");
        const customerMessages = customerId === selectedCustomerId ? sortedMessages : [];
        const lastMessage = customerMessages[customerMessages.length - 1];
        const lastContact = safeDate(lastMessage?.createdAt ?? customer?.lastContactAt);
        const noReplyDays = sinceDays(lastContact) ?? 99;
        const hasOverdueCharge = charges.some(
          charge => String(charge?.customerId ?? "") === customerId && String(charge?.status ?? "").toUpperCase() === "OVERDUE"
        );
        const serviceOrder = serviceOrders.find(item => String(item?.customerId ?? "") === customerId);
        const serviceStatus = String(serviceOrder?.status ?? "").toUpperCase();
        const hasServiceOrderRisk = serviceStatus === "AT_RISK" || serviceStatus === "OVERDUE";
        const hasScheduled = serviceStatus === "SCHEDULED";
        const hasFailed = customerId === selectedCustomerId && currentCustomerFailed > 0;
        const isAwaitingReply = noReplyDays >= 3;

        const priorityScore =
          Number(hasFailed) * 6 +
          Number(hasOverdueCharge) * 5 +
          Number(hasServiceOrderRisk) * 4 +
          Number(hasScheduled) * 2 +
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
          lastStatus: lastMessage?._deliveryStatus ?? "unknown",
          contextType,
          severity,
          priorityScore,
          isAwaitingReply,
          noReplyDays,
          hasOverdueCharge,
          hasServiceOrderRisk,
          hasScheduled,
          hasFailed,
          bestAction,
          serviceOrder,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [charges, currentCustomerFailed, customers, selectedCustomerId, serviceOrders, sortedMessages]);

  const selectedConversation = conversations.find(item => item.id === selectedCustomerId);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return conversations.filter(conversation => {
      const filterMatch = (() => {
        if (activeFilter === "all") return true;
        if (activeFilter === "no_reply") return conversation.isAwaitingReply;
        if (activeFilter === "billing") return conversation.hasOverdueCharge;
        if (activeFilter === "appointment") return conversation.hasScheduled;
        if (activeFilter === "service_order") return conversation.hasServiceOrderRisk;
        if (activeFilter === "failures") return conversation.hasFailed;
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
    const critical = conversations.filter(item => item.severity === "critical").length;

    const alerts = [
      {
        id: "waiting",
        title: `${noReply} cliente(s) aguardando resposta`,
        description: "Follow-up pendente pode virar perda de contexto operacional.",
        severity: noReply > 0 ? "attention" : "healthy",
        cta: "Ver não respondidos",
        action: () => setActiveFilter("no_reply"),
      },
      {
        id: "failures",
        title: `${failures} falha(s) de envio`,
        description: "Mensagens não entregues pedem reenvio imediato.",
        severity: failures > 0 ? "critical" : "healthy",
        cta: "Abrir falhas",
        action: () => setActiveFilter("failures"),
      },
      {
        id: "billing",
        title: `${billing} cobrança(s) ignorada(s)`,
        description: "Conversa com financeiro crítico exige ação agora.",
        severity: billing > 0 ? "critical" : "healthy",
        cta: "Abrir cobranças",
        action: () => setActiveFilter("billing"),
      },
      {
        id: "appointments",
        title: `${appointments} agendamento(s) sem confirmação`,
        description: "Reduza no-show com confirmação em 1 clique.",
        severity: appointments > 0 ? "attention" : "healthy",
        cta: "Ver agendamentos",
        action: () => setActiveFilter("appointment"),
      },
      {
        id: "critical",
        title: `${critical} conversa(s) crítica(s)`,
        description: "Risco consolidado de relacionamento, entrega e caixa.",
        severity: critical > 0 ? "critical" : "healthy",
        cta: "Prioridade máxima",
        action: () => setActiveFilter("all"),
      },
    ] as const;

    return alerts;
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
      <PageWrapper title="WhatsApp Operacional" subtitle="">
        <AppPageLoadingState title="Carregando comunicação operacional" />
      </PageWrapper>
    );
  }

  if (customersQuery.error && customers.length === 0) {
    return (
      <PageWrapper title="WhatsApp Operacional" subtitle="">
        <AppPageErrorState
          description="Não foi possível carregar as conversas operacionais do WhatsApp."
          actionLabel="Tentar novamente"
          onAction={() => void customersQuery.refetch()}
        />
      </PageWrapper>
    );
  }

  if (customers.length === 0) {
    return (
      <PageWrapper title="WhatsApp Operacional" subtitle="">
        <AppPageEmptyState
          title="Sem base operacional para iniciar comunicação"
          description="Cadastre cliente, crie agendamento ou O.S. e retorne para iniciar conversa com contexto."
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="WhatsApp Operacional" subtitle="">
      <section className="space-y-4">
        <AppPageHeader
          title="WhatsApp · Execução operacional"
          description="Quem falou com quem, sobre o quê e qual ação precisa acontecer agora, sem sair do contexto do Nexo."
          cta={
            <Button type="button" onClick={() => setContent("Olá! Iniciando atendimento operacional contextual pelo Nexo.")}>
              Nova mensagem contextual
            </Button>
          }
        />

        <AppSectionBlock
          title="Alertas de comunicação"
          subtitle="Priorize risco, falha e follow-up pendente com CTA direto."
          compact
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {communicationAlerts.map(alert => (
              <article
                key={alert.id}
                className={cn(
                  "rounded-xl border p-3",
                  alert.severity === "critical"
                    ? "border-rose-500/30 bg-rose-500/10"
                    : alert.severity === "attention"
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-[var(--border-subtle)] bg-[var(--surface-elevated)]/35"
                )}
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">{alert.title}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{alert.description}</p>
                <Button className="mt-3 h-8" type="button" variant="outline" size="sm" onClick={alert.action}>
                  {alert.cta}
                </Button>
              </article>
            ))}
          </div>
        </AppSectionBlock>

        <div className="grid min-h-[72vh] gap-4 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <AppSectionBlock title="Inbox prioritária" subtitle="Ordenada por prioridade operacional, não cronologia burra." className="h-full">
            <AppOperationalBar
              tabs={FILTERS}
              activeTab={activeFilter}
              onTabChange={setActiveFilter}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Buscar cliente ou telefone"
            />

            <div className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
              {filteredConversations.length === 0 ? (
                <AppEmptyState
                  title="Nenhuma conversa nesse filtro"
                  description="Ajuste filtro ou busca para continuar a execução operacional."
                />
              ) : (
                filteredConversations.map(conversation => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(conversation.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left",
                      selectedConversation?.id === conversation.id
                        ? "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/55"
                        : "border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 hover:bg-[var(--surface-elevated)]/45"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{conversation.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{conversation.phone}</p>
                      </div>
                      <div className="text-right">
                        <AppPriorityBadge label={riskLabel(conversation.severity)} />
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">{fmtTime(conversation.lastMessageAt)}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <AppStatusBadge label={conversation.contextType} />
                      <AppStatusBadge label={conversation.hasFailed ? "Falhou" : conversation.isAwaitingReply ? "Atenção" : "Seguro"} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">{conversation.snippet}</p>
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">Próxima ação: {conversation.bestAction.title}</p>
                  </button>
                ))
              )}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Conversa orientada à ação"
            subtitle="Execução rápida com contexto, status de envio e templates operacionais."
            className="h-full"
          >
            {!selectedConversation ? (
              <AppEmptyState
                title="Selecione uma conversa"
                description="Escolha um cliente na inbox para iniciar execução operacional."
              />
            ) : (
              <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
                <header className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedConversation.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{selectedConversation.phone}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <AppStatusBadge label={selectedConversation.contextType} />
                      <AppStatusBadge label={riskLabel(selectedConversation.severity)} />
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/35 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Próxima melhor ação</p>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{selectedConversation.bestAction.title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{selectedConversation.bestAction.description}</p>
                  </div>
                </header>

                <div className="max-h-[44vh] space-y-3 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  {messagesQuery.isLoading ? (
                    <AppPageLoadingState title="Carregando histórico" description="Buscando mensagens e eventos desta conversa." />
                  ) : sortedMessages.length === 0 ? (
                    <AppEmptyState
                      title="Conversa sem mensagens"
                      description="Use um template contextual para iniciar contato com objetivo operacional."
                    />
                  ) : (
                    sortedMessages.map(message => {
                      if (message._kind === "event") {
                        return (
                          <div key={String(message?.id)} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Workflow className="size-3.5" />
                            <span>{String(message?.content ?? "Evento de timeline")}</span>
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
                              "max-w-[80%] rounded-xl border px-3 py-2",
                              incoming
                                ? "border-[var(--border-subtle)] bg-[var(--surface-primary)]"
                                : "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/45"
                            )}
                          >
                            <div className="mb-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                              <UserRound className="size-3" />
                              <span>{incoming ? "Cliente" : message._kind === "automation" ? "Template" : "Operação"}</span>
                            </div>
                            <p className="text-sm text-[var(--text-primary)]">{String(message?.content ?? "")}</p>
                            <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-[var(--text-muted)]">
                              <span>{fmtTime(message?.createdAt)}</span>
                              {!incoming ? (
                                <span className={cn("inline-flex items-center gap-1", status === "failed" ? "text-rose-500" : "text-[var(--text-muted)]")}>
                                  {status === "queued" ? <Clock3 className="size-3.5" /> : null}
                                  {status === "sent" ? <Check className="size-3.5" /> : null}
                                  {status === "delivered" ? <CheckCheck className="size-3.5" /> : null}
                                  {status === "failed" ? <XCircle className="size-3.5" /> : null}
                                  {statusLabel(status)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <footer className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/80 p-3">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map(action => (
                      <Button key={action.key} type="button" size="sm" variant="outline" onClick={() => setContent(action.content)}>
                        {action.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={content}
                      onChange={event => setContent(event.target.value)}
                      placeholder="Escreva mensagem com contexto operacional..."
                      className="min-h-[64px] resize-none"
                    />
                    <Button type="button" className="h-10" disabled={sendMutation.isPending || content.trim().length < 2} onClick={() => void sendMessage()}>
                      <Send className="mr-1 size-4" />
                      Enviar
                    </Button>
                  </div>
                </footer>
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Contexto operacional"
            subtitle="Cliente, agenda, O.S., financeiro, timeline e risco na mesma visão."
            className="h-full"
          >
            {!selectedConversation ? (
              <AppEmptyState
                title="Sem contexto ativo"
                description="Selecione uma conversa para abrir o painel contextual lateral."
              />
            ) : (
              <div className="space-y-3 text-sm">
                <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Cliente</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedConversation.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{selectedConversation.phone}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AppStatusBadge label={riskLabel(selectedConversation.severity)} />
                    <AppStatusBadge label={selectedConversation.isAwaitingReply ? "Sem resposta" : "Ativo"} />
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Agendamento</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {selectedConversation.hasScheduled
                      ? `Próximo atendimento vinculado · ${String(selectedConversation.serviceOrder?.status ?? "SCHEDULED")}`
                      : "Sem agendamento ativo"}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">Confirmar/Reagendar</Button>
                </section>

                <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">O.S.</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {selectedConversation.serviceOrder
                      ? `Status atual: ${String(selectedConversation.serviceOrder?.status ?? "OPEN")}`
                      : "Sem ordem em andamento"}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">Abrir O.S.</Button>
                </section>

                <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Financeiro</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {selectedConversation.hasOverdueCharge
                      ? "Cobrança pendente detectada. Priorize envio de cobrança/link."
                      : "Sem cobrança crítica vinculada"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => void sendMessage("Olá! Reforçando a pendência em aberto. Posso te apoiar com o pagamento agora?")}
                    disabled={!selectedConversation.hasOverdueCharge || sendMutation.isPending}
                  >
                    Cobrar / reenviar link
                  </Button>
                </section>

                <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Timeline e risco</p>
                  <ul className="mt-1 space-y-1 text-xs text-[var(--text-secondary)]">
                    <li>• Último evento em {fmtDateTime(sortedMessages[sortedMessages.length - 1]?.createdAt ?? selectedCustomer?.lastContactAt)}</li>
                    <li>• Leitura de risco: {riskLabel(selectedConversation.severity)}</li>
                    <li>• Follow-up: {selectedConversation.noReplyDays >= 3 ? `pendente há ${selectedConversation.noReplyDays} dia(s)` : "em dia"}</li>
                  </ul>
                </section>
              </div>
            )}
          </AppSectionBlock>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Button type="button" variant="outline" onClick={() => setActiveFilter("all")} className="justify-start">
            <Search className="mr-2 size-4" /> Ver inbox completa
          </Button>
          <Button type="button" variant="outline" onClick={() => setActiveFilter("billing")} className="justify-start">
            <Siren className="mr-2 size-4" /> Abrir cobranças críticas
          </Button>
          <Button type="button" variant="outline" onClick={() => setActiveFilter("no_reply")} className="justify-start">
            <MessageCircleWarning className="mr-2 size-4" /> Ver não respondidos
          </Button>
          <Button type="button" variant="outline" onClick={() => setActiveFilter("failures")} className="justify-start">
            <AlertTriangle className="mr-2 size-4" /> Ver falhas de entrega
          </Button>
        </div>
      </section>
    </PageWrapper>
  );
}
