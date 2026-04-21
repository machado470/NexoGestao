import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  CircleArrowRight,
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
import {
  AppPageShell,
  AppSectionCard,
  AppSkeleton,
  AppTimeline,
  AppTimelineItem,
  AppToolbar,
} from "@/components/app-system";
import {
  AppEmptyState,
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
  | "failures"
  | "resolved";
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
  { value: "no_reply", label: "Não respondidos" },
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

function toneFromSeverity(severity: Severity) {
  if (severity === "critical") return "danger" as const;
  if (severity === "attention") return "warning" as const;
  return "success" as const;
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
        if (activeFilter === "service_order") return conversation.hasServiceOrderRisk;
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
    const critical = conversations.filter(item => item.severity === "critical").length;

    return [
      {
        id: "waiting",
        title: `${noReply} cliente(s) aguardando resposta`,
        description: "Follow-up pendente vira perda de contexto e atraso de operação.",
        severity: noReply > 0 ? "attention" : "healthy",
        cta: "Ver não respondidos",
        action: () => setActiveFilter("no_reply"),
      },
      {
        id: "failures",
        title: `${failures} falha(s) de envio`,
        description: "Mensagens não entregues exigem retry imediato.",
        severity: failures > 0 ? "critical" : "healthy",
        cta: "Abrir falhas",
        action: () => setActiveFilter("failures"),
      },
      {
        id: "billing",
        title: `${billing} cobrança(s) ignorada(s)`,
        description: "Financeiro em risco com conversa sem conclusão.",
        severity: billing > 0 ? "critical" : "healthy",
        cta: "Abrir cobranças",
        action: () => setActiveFilter("billing"),
      },
      {
        id: "appointments",
        title: `${appointments} confirmação(ões) pendente(s)`,
        description: "Confirme agora para reduzir no-show e retrabalho.",
        severity: appointments > 0 ? "attention" : "healthy",
        cta: "Ver agendamentos",
        action: () => setActiveFilter("appointment"),
      },
      {
        id: "critical",
        title: `${critical} conversa(s) crítica(s)`,
        description: "Maior risco combinado de relacionamento, execução e caixa.",
        severity: critical > 0 ? "critical" : "healthy",
        cta: "Prioridade máxima",
        action: () => setActiveFilter("all"),
      },
    ] as const;
  }, [conversations]);

  const conversationPeriodLabel = useMemo(() => {
    const total = conversations.length;
    const pending = conversations.filter(item => !item.isResolved).length;
    const critical = conversations.filter(item => item.severity === "critical").length;
    return `Hoje · ${total} conversas monitoradas · ${pending} pendências · ${critical} críticas`;
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
      <AppPageHeader
        title="WhatsApp"
        description="Camada de execução da comunicação operacional: prioridade, contexto e ação em um único fluxo."
        secondaryActions={<p className="text-xs text-[var(--text-muted)]">{conversationPeriodLabel}</p>}
        cta={
          <Button
            type="button"
            onClick={() => setContent("Olá! Iniciando atendimento operacional contextual pelo Nexo.")}
          >
            Nova comunicação operacional
          </Button>
        }
      />

      <AppSectionBlock title="Alertas e prioridade" subtitle="Curto, acionável e orientado à execução." compact>
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

      <div className="grid min-h-[72vh] gap-4 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
        <AppSectionBlock title="Lista de conversas" subtitle="Inbox inteligente, priorizada por consequência operacional." className="h-full">
          <AppToolbar className="mb-3 items-center gap-2 px-3 py-2">
            <p className="text-xs text-[var(--text-muted)]">{filteredConversations.length} conversa(s) neste recorte</p>
            <div className="ml-auto flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveFilter("all")}>
                Todas
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveFilter("resolved")}>
                Resolvidas
              </Button>
            </div>
          </AppToolbar>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2">
            <div className="mb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max items-center gap-1.5">
                {FILTERS.map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      activeFilter === filter.value
                        ? "border-[color-mix(in_srgb,var(--accent-primary)_72%,black)] bg-[var(--accent-primary)] text-white"
                        : "border-[var(--border-subtle)] bg-[var(--surface-primary)]/45 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar cliente ou telefone"
                className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-emphasis)]"
              />
            </div>
          </div>

          <div className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
            {customersQuery.isFetching ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <AppSkeleton key={idx} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <AppEmptyState
                title="Nenhuma conversa nesse filtro"
                description="Ajuste o recorte para voltar ao atendimento prioritário." 
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
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{conversation.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{conversation.phone}</p>
                    </div>
                    <div className="text-right">
                      <AppPriorityBadge label={riskLabel(conversation.severity)} />
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{fmtTime(conversation.lastMessageAt)}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AppStatusBadge label={conversation.contextType} />
                    <AppStatusBadge
                      label={conversation.hasFailed ? "Falha de envio" : conversation.isAwaitingReply ? "Sem resposta" : "Em dia"}
                    />
                    {conversation.hasOverdueCharge ? <AppStatusBadge label="Cobrança ignorada" /> : null}
                    {conversation.hasScheduled ? <AppStatusBadge label="Confirmação pendente" /> : null}
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">{conversation.snippet}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[var(--text-muted)]">Próxima ação: {conversation.bestAction.title}</p>
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{conversation.bestAction.cta}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </AppSectionBlock>

        <AppSectionCard className="space-y-3 p-0">
          <AppSectionBlock
            title="Área de conversa"
            subtitle="Menos chat, mais execução contextual com status de envio e CTA operacional."
            className="h-full border-0 bg-transparent p-4"
          >
            {!selectedConversation ? (
              <AppEmptyState
                title="Selecione uma conversa"
                description="Escolha um cliente para executar confirmação, cobrança, atualização de O.S. ou follow-up."
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
                    <AppEmptyState
                      title="Conversa sem mensagens"
                      description="Use templates operacionais para iniciar contato com objetivo claro."
                    />
                  ) : (
                    sortedMessages.map(message => {
                      if (message._kind === "event") {
                        return (
                          <div key={String(message?.id)} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
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
                              "max-w-[85%] rounded-xl border px-3 py-2",
                              incoming
                                ? "border-[var(--border-subtle)] bg-[var(--surface-primary)]"
                                : "border-[var(--border-emphasis)] bg-[var(--surface-elevated)]/45"
                            )}
                          >
                            <div className="mb-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                              <UserRound className="size-3" />
                              <span>{incoming ? "Cliente" : message._kind === "automation" ? "Automação" : "Operação"}</span>
                            </div>
                            <p className="text-sm text-[var(--text-primary)]">{String(message?.content ?? "")}</p>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
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
                            {status === "failed" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-2 h-7"
                                onClick={() => void sendMessage(String(message?.content ?? ""))}
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
                      placeholder="Mensagem com objetivo operacional e vínculo explícito..."
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
        </AppSectionCard>

        <AppSectionBlock
          title="Contexto operacional"
          subtitle="Cliente, agenda, O.S., financeiro e histórico em paralelo à conversa."
          className="h-full"
        >
          {!selectedConversation ? (
            <AppEmptyState
              title="Sem contexto ativo"
              description="Selecione uma conversa para exibir os vínculos operacionais laterais."
            />
          ) : (
            <div className="space-y-3 text-sm">
              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Cliente</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedConversation.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{selectedConversation.phone}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <AppStatusBadge label={riskLabel(selectedConversation.severity)} />
                  <AppStatusBadge label={selectedConversation.isAwaitingReply ? "Aguardando resposta" : "Contato em dia"} />
                </div>
                <div className="mt-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/customers/${selectedConversation.id}`)}>
                    Abrir cliente
                  </Button>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Agendamento</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {selectedConversation.hasScheduled
                    ? `Próximo atendimento vinculado · ${String(selectedConversation.serviceOrder?.status ?? "SCHEDULED")}`
                    : "Sem agendamento confirmado"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate("/appointments")}>Confirmar/Reagendar</Button>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">O.S.</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {selectedConversation.serviceOrder
                    ? `Status atual: ${String(selectedConversation.serviceOrder?.status ?? "OPEN")}`
                    : "Sem O.S. em andamento"}
                </p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => navigate("/service-orders")}>Abrir O.S.</Button>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Financeiro</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {selectedConversation.hasOverdueCharge
                    ? `${selectedConversation.overdueCharges.length} cobrança(s) vencida(s) · ${fmtCurrency(selectedConversation.financialPendingCents)}`
                    : selectedConversation.pendingCharges.length > 0
                      ? `${selectedConversation.pendingCharges.length} cobrança(s) pendente(s) · ${fmtCurrency(selectedConversation.financialPendingCents)}`
                      : "Sem pendência financeira crítica"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Vencimento mais próximo: {fmtDateTime(selectedConversation.overdueCharges[0]?.dueDate ?? selectedConversation.pendingCharges[0]?.dueDate)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void sendMessage("Olá! Reforçando a pendência em aberto. Posso te apoiar com o pagamento agora?")}>Reenviar link</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate("/finances")}>Abrir financeiro</Button>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Timeline operacional</p>
                <AppTimeline className="mt-2 space-y-2">
                  <AppTimelineItem className="p-2.5">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">Mensagem enviada</p>
                    <p className="text-xs text-[var(--text-secondary)]">Último envio em {fmtDateTime(sortedMessages[sortedMessages.length - 1]?.createdAt ?? selectedCustomer?.lastContactAt)}.</p>
                  </AppTimelineItem>
                  {selectedConversation.hasFailed ? (
                    <AppTimelineItem className="p-2.5">
                      <p className="text-xs font-semibold text-rose-500">Falha de envio identificada</p>
                      <p className="text-xs text-[var(--text-secondary)]">Retry disponível na conversa para restauração do fluxo.</p>
                    </AppTimelineItem>
                  ) : null}
                  {selectedConversation.hasOverdueCharge ? (
                    <AppTimelineItem className="p-2.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Cobrança enviada</p>
                      <p className="text-xs text-[var(--text-secondary)]">Pendência financeira segue aberta e requer follow-up.</p>
                    </AppTimelineItem>
                  ) : null}
                  {selectedConversation.hasScheduled ? (
                    <AppTimelineItem className="p-2.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Confirmação de agendamento pendente</p>
                      <p className="text-xs text-[var(--text-secondary)]">Acione template de confirmação para fechar presença.</p>
                    </AppTimelineItem>
                  ) : null}
                </AppTimeline>
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

      <AppToolbar className="mt-3 gap-2 px-3 py-2">
        <p className="text-xs text-[var(--text-secondary)]">Preparado para automações: confirmação de agenda, lembrete, cobrança, retry, follow-up e registro em timeline.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => selectedConversation && void sendMessage(selectedConversation.bestAction.description)} disabled={!selectedConversation}>
          <CircleArrowRight className="mr-1 size-4" /> Executar próxima ação
        </Button>
      </AppToolbar>
    </AppPageShell>
  );
}
