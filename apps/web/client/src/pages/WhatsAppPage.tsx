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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground">
              Esta conversa só pode ser aberta a partir de uma ordem de serviço
              ou cobrança.
            </p>
          </div>

          <Button variant="outline" onClick={() => navigate("/service-orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para ordens
          </Button>
        </div>

        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          Selecione um cliente a partir de uma ordem de serviço ou cobrança para
          abrir uma conversa contextual.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Conversa operacional com contexto do cliente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void messagesQuery.refetch()}
            disabled={messagesQuery.isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar conversa
          </Button>

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
                navigate(buildServiceOrdersDeepLink(route.serviceOrderId))
              }
            >
              Ver ordem
            </Button>
          )}
        </div>
      </div>

      {customer && (
        <div className="space-y-3 rounded-xl border bg-gray-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{customer.name}</p>
              <p className="text-sm text-gray-400">
                {getWhatsAppContextLabel(route.context)}
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                const msg = getWhatsAppPrefilledMessage(customer, route);
                setMessageInput(msg);
              }}
              disabled={sendMutation.isPending}
            >
              Recarregar mensagem
            </Button>
          </div>

          <p className="text-sm text-gray-400">
            {getWhatsAppContextDescription(route)}
          </p>

          <div className="flex flex-wrap gap-3 text-sm">
            {amountLabel && (
              <span className="rounded-md border px-3 py-1 text-green-400">
                Valor: {amountLabel}
              </span>
            )}

            {dueDateLabel && (
              <span className="rounded-md border px-3 py-1 text-amber-400">
                Vencimento: {dueDateLabel}
              </span>
            )}

            {route.chargeId && (
              <span className="rounded-md border px-3 py-1 text-gray-300">
                Cobrança vinculada
              </span>
            )}

            {route.serviceOrderId && (
              <span className="rounded-md border px-3 py-1 text-gray-300">
                Ordem vinculada
              </span>
            )}
          </div>
        </div>
      )}

      <div className="max-h-[420px] min-h-[280px] space-y-3 overflow-y-auto rounded-xl border p-4">
        {messagesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando conversa...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem encontrada para este cliente.
          </p>
        ) : (
          messages.map((msg: any) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.fromMe ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.fromMe
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p>{msg.content}</p>

                {msg.createdAt && (
                  <p className="mt-1 text-[11px] opacity-70">
                    {formatDate(msg.createdAt)}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div>
          <p className="font-medium">Mensagem</p>
          <p className="text-sm text-muted-foreground">
            Ajuste o texto antes de enviar.
          </p>
        </div>

        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Digite a mensagem para o cliente"
          disabled={isLoading}
        />

        <div className="flex flex-wrap gap-2">
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

          <Button
            variant="outline"
            onClick={() => {
              if (!customer) return;
              setMessageInput(getWhatsAppPrefilledMessage(customer, route));
            }}
            disabled={!customer || sendMutation.isPending}
          >
            Restaurar sugestão
          </Button>
        </div>
      </div>
    </div>
  );
}
