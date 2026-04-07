import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  RefreshCw,
  ArrowLeft,
  Send,
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
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";
import { EmptyState } from "@/components/EmptyState";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import { getQueryUiState } from "@/lib/query-helpers";

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
    !sendMutation.isPending;

  const amountLabel =
    route.amountCents !== null ? formatCurrency(route.amountCents) : null;

  const dueDateLabel = route.dueDate ? formatDate(route.dueDate) : null;

  const nonBlockingErrorMessage =
    customerQuery.error?.message ||
    messagesQuery.error?.message ||
    "Falha ao atualizar contexto de WhatsApp.";

  if (!route.customerId) {
    return (
      <PageShell>
        <PageHero
          eyebrow="WhatsApp"
          title="WhatsApp"
          description="Comunique com contexto comercial: veja o cenário, entenda o impacto e execute a mensagem certa agora."
          actions={
            <Button variant="outline" onClick={() => navigate("/service-orders")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />
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
        <DemoEnvironmentCta />
      </PageShell>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageShell>
        <PageHero eyebrow="WhatsApp" title="WhatsApp" description="Preparando contexto da conversa para você agir em segundos." />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Carregando conversa e próxima ação...
        </SurfaceSection>
      </PageShell>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageShell>
        <PageHero eyebrow="WhatsApp" title="WhatsApp" description="Não foi possível carregar o contexto da conversa." />
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">
          {nonBlockingErrorMessage}
        </SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell>
        <PageHero
          eyebrow="WhatsApp"
          title="WhatsApp"
          description="Transforme conversa em fechamento: o contexto já mostra o que aconteceu, por que importa e o que enviar agora."
        actions={
          <Button variant="outline" onClick={() => navigate(resolveBack(route))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        }
      />

      {queryState.hasBackgroundUpdate ? (
        <SurfaceSection className="border-blue-500/30 bg-blue-500/10 text-sm text-blue-200">
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

      <div className="flex gap-2">
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

      <SurfaceSection className="space-y-3">
        <div className="text-sm text-muted-foreground">
          <strong>{getWhatsAppContextLabel(route.context)}:</strong>{" "}
          {getWhatsAppContextDescription(route)}
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
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="rounded border p-3 text-sm">
                {msg.content}
              </div>
            ))}
          </div>
        )}
      </SurfaceSection>

      <SurfaceSection className="space-y-3">
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Digite a mensagem"
        />

        <Button
          onClick={async () => {
            if (!hasCustomer) {
              toast.error("Cliente inválido para envio de mensagem");
              return;
            }

            try {
              await sendMutation.mutateAsync({
                customerId: route.customerId!,
                content: messageInput.trim(),
                entityType: getEntityType(route),
                entityId: getEntityId(route) ?? undefined,
                messageType: getMessageTypeFromContext(route.context),
                chargeId: route.chargeId ?? undefined,
                serviceOrderId: route.serviceOrderId ?? undefined,
              });
              await messagesQuery.refetch();
              setMessageInput("");
              toast.success("Mensagem enviada");
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
      </SurfaceSection>

      <DemoEnvironmentCta />
    </PageShell>
  );
}
