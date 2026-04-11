import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/design-system";
import {
  MessageCircle,
  RefreshCw,
  ArrowLeft,
  Send,
  Clock3,
  Zap,
  Phone,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  parseWhatsAppRoute,
  getWhatsAppPrefilledMessage,
  getWhatsAppContextLabel,
  getWhatsAppContextDescription,
  formatCurrency,
  formatDate,
  buildFinanceChargeUrl,
  buildServiceOrdersDeepLink,
} from "@/lib/operations/operations.utils";
import { EmptyState } from "@/components/EmptyState";
import { SmartPage, SurfaceSection } from "@/components/PagePattern";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { getQueryUiState } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { resolveOperationFeedback } from "@/lib/operations/operation-feedback";
import {
  NexoContextBlock,
  NexoEntityRow,
  NexoMessageBubble,
  NexoMetricCard,
} from "@/components/operating-system/InternalBlocks";

function getMessageTypeFromContext(context: string) {
  if (context === "overdue_charge") return "PAYMENT_REMINDER";
  if (context === "charge_pending") return "PAYMENT_REMINDER";
  if (context === "service_order_followup") return "SERVICE_UPDATE";
  return "CUSTOMER_NOTIFICATION";
}

function getEntityType(route: ReturnType<typeof parseWhatsAppRoute>) {
  if (route.chargeId) return "CHARGE";
  if (route.serviceOrderId) return "SERVICE_ORDER";
  return "CUSTOMER";
}

function getEntityId(route: ReturnType<typeof parseWhatsAppRoute>) {
  return route.chargeId || route.serviceOrderId || route.customerId;
}

function resolveBack(route: ReturnType<typeof parseWhatsAppRoute>) {
  if (route.returnTo) {
    return route.returnTo;
  }

  if (route.serviceOrderId) {
    return buildServiceOrdersDeepLink(route.serviceOrderId, "operations");
  }

  if (route.chargeId) {
    return buildFinanceChargeUrl(route.chargeId);
  }

  return "/service-orders";
}

type WhatsAppMessage = {
  id: string;
  content: string;
};

function formatTimeLabel(index: number) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - Math.max(1, index * 7));
  return now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WhatsAppPage() {
  const [location, navigate] = useLocation();
  const route = useMemo(() => parseWhatsAppRoute(location), [location]);

  const [messageInput, setMessageInput] = useState("");

  const customerQuery = trpc.nexo.customers.getById.useQuery(
    { id: route.customerId || "" },
    { enabled: !!route.customerId, retry: false, refetchOnWindowFocus: false }
  );

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: route.customerId || "" },
    { enabled: !!route.customerId, retry: false, refetchOnWindowFocus: false }
  );

  const sendMutation = trpc.nexo.whatsapp.send.useMutation();
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, {
    retry: 1,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const customer = customerQuery.data?.data || customerQuery.data;
  const hasCustomer = Boolean(customer && typeof customer === "object");

  useEffect(() => {
    if (!customer || messageInput) return;

    const msg = getWhatsAppPrefilledMessage(customer, route);
    setMessageInput(msg);
  }, [customer, route, messageInput]);

  const messages = useMemo(() => {
    const raw = messagesQuery.data?.data || messagesQuery.data || [];
    return Array.isArray(raw) ? (raw as WhatsAppMessage[]) : [];
  }, [messagesQuery.data]);

  const hasRenderableData = customerQuery.data !== undefined || messagesQuery.data !== undefined;
  const queryState = getQueryUiState([customerQuery, messagesQuery], hasRenderableData);

  const canSend =
    Boolean(route.customerId) &&
    hasCustomer &&
    messageInput.trim().length > 0 &&
    !sendMutation.isPending &&
    readinessQuery.data?.integrations?.whatsapp === "configured";

  const amountLabel =
    route.amountCents !== null ? formatCurrency(route.amountCents) : null;

  const dueDateLabel = route.dueDate ? formatDate(route.dueDate) : null;
  const unresolvedMessages = messages.filter((msg) => !msg.content?.trim()).length;
  const customerName = typeof (customer as { name?: unknown })?.name === "string"
    ? (customer as { name: string }).name
    : "Cliente";
  const customerPhone = typeof (customer as { phone?: unknown })?.phone === "string"
    ? (customer as { phone: string }).phone
    : "Sem telefone";
  const smartPriorities = [
    {
      id: "wa-contact",
      type: "operational_risk" as const,
      title: "Contato com contexto pronto",
      count: hasCustomer ? 1 : 0,
      impactCents: 1500,
      ctaLabel: "Enviar mensagem",
      ctaPath: "/whatsapp",
      helperText: "Sem contato no momento certo, a conversão cai.",
    },
    {
      id: "wa-history",
      type: "stalled_service_orders" as const,
      title: "Mensagens no histórico",
      count: messages.length,
      impactCents: messages.length * 300,
      ctaLabel: "Revisar conversa",
      ctaPath: "/whatsapp",
      helperText: "Histórico recente evita retrabalho comercial.",
    },
    {
      id: "wa-finance",
      type: "overdue_charges" as const,
      title: "Cobrança em contexto",
      count: route.chargeId ? 1 : 0,
      impactCents: route.amountCents ?? 0,
      ctaLabel: "Abrir financeiro",
      ctaPath: "/finances",
      helperText: "Quando há cobrança, a mensagem precisa ser objetiva.",
    },
  ];

  const nonBlockingErrorMessage =
    customerQuery.error?.message ||
    messagesQuery.error?.message ||
    "Falha ao atualizar contexto de WhatsApp.";

  if (!route.customerId) {
    return (
      <PageWrapper
        title="Canal de execução • WhatsApp"
        subtitle="Abra conversas com contexto operacional pronto: quem contatar, por que agora e qual mensagem acelera a próxima etapa."
        primaryAction={
          <Button variant="outline" onClick={() => navigate("/service-orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        }
      >
        <SurfaceSection>
          <EmptyState
            icon={<MessageCircle className="h-7 w-7" />}
            title="Sem contexto selecionado"
            description="Abra o WhatsApp por uma O.S. ou cobrança para trazer cliente, impacto financeiro e mensagem sugerida sem improviso."
            action={{
              label: "Começar por Ordens de Serviço",
              onClick: () => navigate("/service-orders"),
            }}
          />
        </SurfaceSection>

      </PageWrapper>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageWrapper title="Canal de execução • WhatsApp" subtitle="Preparando contexto da conversa para você agir em segundos.">
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Carregando conversa e próxima ação...
        </SurfaceSection>
      </PageWrapper>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageWrapper title="Canal de execução • WhatsApp" subtitle="Não foi possível carregar o contexto da conversa.">
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">
          {nonBlockingErrorMessage}
        </SurfaceSection>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Canal de execução • WhatsApp"
      subtitle="Transforme conversa em fechamento: o contexto já mostra o que aconteceu, por que importa e o que enviar agora."
      primaryAction={
        <Button variant="outline" onClick={() => navigate(resolveBack(route))}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      <SmartPage
        pageContext="customers"
        headline="Conversa orientada por próxima ação"
        dominantProblem={getWhatsAppContextDescription(route)}
        dominantImpact={messages.length > 0 ? `${messages.length} mensagens no histórico` : "Sem histórico prévio"}
        dominantCta={{
          label: "Enviar mensagem agora",
          onClick: () => {
            const button = document.querySelector("button[data-whatsapp-send='true']") as HTMLButtonElement | null;
            button?.focus();
          },
          path: "/whatsapp",
        }}
        priorities={smartPriorities}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <NexoMetricCard
          label="Mensagens em histórico"
          value={messages.length}
          valueClassName="text-xl font-semibold"
          className="p-4"
        />
        <NexoMetricCard
          label="Mensagens sem conteúdo"
          value={unresolvedMessages}
          valueClassName="text-xl font-semibold"
          className="p-4"
        />
        <NexoMetricCard
          label="Vínculo de cobrança"
          value={route.chargeId ? "Ativo" : "Não"}
          valueClassName="text-xl font-semibold"
          className="p-4"
        />
        <NexoMetricCard
          label="Valor em contexto"
          value={amountLabel ?? "—"}
          valueClassName="nexo-text-wrap text-xl font-semibold"
          className="p-4"
        />
      </div>

      <NexoContextBlock
        className="border-orange-200/80 bg-orange-50/70 p-4 dark:border-orange-500/20 dark:bg-orange-500/10"
        text="Canal pronto para execução: mantenha a mensagem curta, contextual e orientada para próxima decisão."
        badges={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-orange-700 dark:bg-zinc-950/60 dark:text-orange-300">
              <Clock3 className="h-3.5 w-3.5" /> envio imediato
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-orange-700 dark:bg-zinc-950/60 dark:text-orange-300">
              <Zap className="h-3.5 w-3.5" /> ação contextual
            </span>
          </>
        }
      />

      {queryState.hasBackgroundUpdate ? (
        <SurfaceSection className="nexo-info-banner text-sm">
          Atualizando histórico de mensagens em segundo plano...
        </SurfaceSection>
      ) : null}

      {(customerQuery.isError || messagesQuery.isError) && !queryState.shouldBlockForError ? (
        <SurfaceSection className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
          {nonBlockingErrorMessage}
        </SurfaceSection>
      ) : null}

      {!hasCustomer ? (
        <SurfaceSection>
          <EmptyState
            icon={<MessageCircle className="h-7 w-7" />}
            title="Cliente não encontrado"
            description="Este link não encontrou um cliente válido. Volte para O.S. ou Financeiro e reabra o contexto."
            action={{
              label: "Voltar",
              onClick: () => navigate(resolveBack(route)),
            }}
          />
        </SurfaceSection>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {route.chargeId && (
          <Button
            variant="outline"
            onClick={() => navigate(buildFinanceChargeUrl(route.chargeId))}
          >
            Ver cobrança
          </Button>
        )}

        {route.serviceOrderId && (
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                buildServiceOrdersDeepLink(route.serviceOrderId, "operations")
              )
            }
          >
            Ver ordem
          </Button>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SurfaceSection className="space-y-3 p-0">
          <header className="border-b border-[var(--border-subtle)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Conversas ativas</p>
          </header>
          <div className="space-y-2 px-3 pb-3">
            <button
              type="button"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-2 text-left"
            >
              <NexoEntityRow
                title={customerName}
                subtitle={customerPhone}
                meta={messages.length > 0 ? `${messages.length} mensagens` : "Sem histórico"}
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {amountLabel ? `Cobrança em aberto: ${amountLabel}` : "Conversa operacional em andamento"}
              </p>
            </button>
          </div>
        </SurfaceSection>

        <SurfaceSection className="flex min-h-[560px] flex-col overflow-hidden p-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)]/55 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{customerName}</p>
              <p className="text-xs text-[var(--text-secondary)]">{getWhatsAppContextLabel(route.context)} • {customerPhone}</p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]">
              <Phone className="h-3 w-3" /> online no WhatsApp
            </div>
          </header>

          <div data-scrollbar="nexo" className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--bg-app)]/35 p-4">
            <div className="nexo-text-wrap text-xs text-[var(--text-muted)]">
              <strong>{getWhatsAppContextLabel(route.context)}:</strong> {getWhatsAppContextDescription(route)}
              {amountLabel ? ` • Valor: ${amountLabel}` : ""}
              {dueDateLabel ? ` • Vencimento: ${dueDateLabel}` : ""}
            </div>
            {messages.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="h-7 w-7" />}
                title="Nenhuma mensagem nesta conversa"
                description="Ainda não há mensagens neste contexto. Envie o primeiro contato para destravar a próxima etapa comercial."
                action={{
                  label: "Atualizar conversa",
                  onClick: () => void messagesQuery.refetch(),
                }}
              />
            ) : (
              messages.map((msg, idx) => (
                <div key={msg.id} className="space-y-1">
                  <NexoMessageBubble>{msg.content}</NexoMessageBubble>
                  <p className="inline-flex items-center gap-1 pl-3 text-[11px] text-[var(--text-muted)]">
                    {formatTimeLabel(idx)} <CheckCheck className="h-3 w-3" />
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        {readinessQuery.data?.integrations?.whatsapp !== "configured" ? (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
            Integração WhatsApp indisponível. Fallback: copie a mensagem contextual e envie manualmente.
          </div>
        ) : null}
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Escreva a próxima mensagem com contexto e objetivo claro"
        />

        <Button
          data-whatsapp-send="true"
          onClick={async () => {
            if (!hasCustomer) {
              toast.error("Cliente inválido para envio de mensagem");
              return;
            }

            try {
              const result = await sendMutation.mutateAsync({
                customerId: route.customerId!,
                content: messageInput.trim(),
                entityType: getEntityType(route),
                entityId: getEntityId(route) ?? undefined,
                messageType: getMessageTypeFromContext(route.context),
                chargeId: route.chargeId ?? undefined,
                serviceOrderId: route.serviceOrderId ?? undefined,
                idempotencyKey: buildIdempotencyKey(
                  "whatsapp.send_message",
                  getEntityId(route) ?? route.customerId
                ),
              });
              await messagesQuery.refetch();
              setMessageInput("");
              const operationStatus = String((result as any)?.operation?.status ?? "").toLowerCase();
              const executedMessage = operationStatus === "queued" ? "Mensagem enfileirada para envio." : "Mensagem enviada";
              toast.success(
                resolveOperationFeedback({
                  operationStatus,
                  degradedStatus: null,
                  executedMessage,
                  duplicateMessage: "Envio duplicado detectado: mensagem anterior reaproveitada.",
                  retryScheduledMessage: "Mensagem enfileirada para retry.",
                  blockedMessage: "Envio bloqueado por política operacional.",
                })
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Erro ao enviar mensagem";
              toast.error(message);
            }
          }}
          disabled={!canSend}
        >
          <Send className="mr-2 h-4 w-4" />
          {sendMutation.isPending ? "Enviando..." : "Enviar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(messageInput.trim());
              toast.success("Mensagem copiada para envio manual.");
            } catch {
              toast.error("Não foi possível copiar automaticamente.");
            }
          }}
          disabled={messageInput.trim().length === 0}
        >
          Copiar mensagem
        </Button>
          </div>
        </SurfaceSection>
      </section>


    </PageWrapper>
  );
}
