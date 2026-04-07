import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
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

// 🔥 NOVO: resolve retorno inteligente
function resolveBack(route: ReturnType<typeof parseWhatsAppRoute>) {
  if (route.serviceOrderId) {
    return buildServiceOrdersDeepLink(route.serviceOrderId, "operations");
  }

  if (route.chargeId) {
    return buildFinanceChargeUrl(route.chargeId);
  }

  return "/service-orders";
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

  const sendMutation = trpc.nexo.whatsapp.send.useMutation({
    onSuccess: async () => {
      await messagesQuery.refetch();
      setMessageInput("");
      toast.success("Mensagem enviada");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar mensagem");
    },
  });

  const customer = customerQuery.data?.data || customerQuery.data;

  useEffect(() => {
    if (!customer || messageInput) return;

    const msg = getWhatsAppPrefilledMessage(customer, route);
    setMessageInput(msg);
  }, [customer, route, messageInput]);

  const messages = useMemo(() => {
    const raw = messagesQuery.data?.data || messagesQuery.data || [];
    return Array.isArray(raw) ? raw : [];
  }, [messagesQuery.data]);

  const isLoading =
    !!route.customerId &&
    (customerQuery.isLoading ||
      messagesQuery.isLoading ||
      sendMutation.isPending);

  const canSend =
    Boolean(route.customerId) &&
    messageInput.trim().length > 0 &&
    !sendMutation.isPending;

  const amountLabel =
    route.amountCents !== null ? formatCurrency(route.amountCents) : null;

  const dueDateLabel = route.dueDate ? formatDate(route.dueDate) : null;

  if (!route.customerId) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground">
              Acesse via ordem ou cobrança para manter o contexto operacional.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate("/service-orders")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <DemoEnvironmentCta />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Conversa com contexto operacional.
          </p>
        </div>

        {/* 🔥 BOTÃO CORRIGIDO */}
        <Button
          variant="outline"
          onClick={() => navigate(resolveBack(route))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

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

      <div className="rounded-xl border p-4">
        {messages.length === 0 ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Ainda não há mensagens. Esta conversa será alimentada por contexto
              de cobrança, execução e acompanhamento.
            </p>
            <DemoEnvironmentCta />
          </div>
        ) : (
          messages.map((msg: any) => <div key={msg.id}>{msg.content}</div>)
        )}
      </div>

      <Input
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
      />

      <Button
        onClick={() =>
          sendMutation.mutate({
            customerId: route.customerId!,
            content: messageInput.trim(),
            entityType: getEntityType(route),
            entityId: getEntityId(route),
            messageType: getMessageTypeFromContext(route.context),
            chargeId: route.chargeId,
            serviceOrderId: route.serviceOrderId,
          })
        }
        disabled={!canSend}
      >
        <ArrowRight className="mr-2 h-4 w-4" />
        Enviar
      </Button>
    </div>
  );
}
