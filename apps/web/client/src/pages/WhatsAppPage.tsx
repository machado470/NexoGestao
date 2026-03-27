import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/operations/operations.utils";

function parseLocationParams(location: string) {
  const params = new URLSearchParams(location.split("?")[1] || "");

  return {
    customerId: params.get("customerId"),
    context: params.get("context"),
    amountCents: params.get("amountCents")
      ? Number(params.get("amountCents"))
      : null,
    dueDate: params.get("dueDate"),
    chargeId: params.get("chargeId"),
    serviceOrderId: params.get("serviceOrderId"),
  };
}

export default function WhatsAppPage() {
  const [location, navigate] = useLocation();
  const route = useMemo(() => parseLocationParams(location), [location]);

  const [messageInput, setMessageInput] = useState("");

  const customerQuery = trpc.nexo.customers.getById.useQuery(
    { id: route.customerId || "" },
    { enabled: !!route.customerId }
  );

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: route.customerId || "" },
    { enabled: !!route.customerId }
  );

  const sendMutation = trpc.nexo.whatsapp.send.useMutation({
    onSuccess: async () => {
      await messagesQuery.refetch();
      setMessageInput("");
      toast.success("Mensagem enviada");
    },
  });

  const customer = customerQuery.data?.data || customerQuery.data;

  useEffect(() => {
    if (!customer || messageInput) return;

    const firstName = customer.name?.split(" ")[0] || "cliente";
    const amount =
      route.amountCents !== null
        ? formatCurrency(route.amountCents)
        : "";

    if (route.context === "overdue_charge") {
      setMessageInput(
        `Olá ${firstName}, identificamos um pagamento vencido de ${amount}. Posso te enviar o link?`
      );
      return;
    }

    if (route.context === "charge_pending") {
      setMessageInput(
        `Olá ${firstName}, lembrando do pagamento de ${amount}. Posso te enviar o link?`
      );
      return;
    }

    setMessageInput(`Olá ${firstName}, tudo bem?`);
  }, [customer, route, messageInput]);

  const messages = useMemo(() => {
    const raw = messagesQuery.data?.data || messagesQuery.data || [];
    return Array.isArray(raw) ? raw : [];
  }, [messagesQuery.data]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        WhatsApp
      </h1>

      {/* CONTEXTO */}
      {customer && (
        <div className="border p-3 rounded bg-gray-900 space-y-1">
          <p className="font-semibold">{customer.name}</p>

          {route.context && (
            <p className="text-sm text-gray-400">
              Contexto: {route.context}
            </p>
          )}

          {route.amountCents && (
            <p className="text-sm text-green-400">
              Valor: {formatCurrency(route.amountCents)}
            </p>
          )}
        </div>
      )}

      {/* AÇÕES RÁPIDAS */}
      <div className="flex gap-2">
        {route.chargeId && (
          <Button onClick={() => navigate(`/finances?chargeId=${route.chargeId}`)}>
            Ver cobrança
          </Button>
        )}

        {route.serviceOrderId && (
          <Button onClick={() => navigate(`/service-orders?os=${route.serviceOrderId}`)}>
            Ver ordem
          </Button>
        )}
      </div>

      {/* MENSAGENS */}
      <div className="border rounded-lg p-4 space-y-2 max-h-[400px] overflow-y-auto">
        {messages.map((msg: any) => (
          <div
            key={msg.id}
            className={`text-sm ${
              msg.fromMe ? "text-right" : "text-left"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div className="flex gap-2">
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
        />

        <Button
          onClick={() =>
            sendMutation.mutate({
              customerId: route.customerId!,
              content: messageInput,
            })
          }
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}
