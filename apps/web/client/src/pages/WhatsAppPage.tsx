import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/operations/operations.utils";

type Message = {
  id: string;
  content: string;
  createdAt: string;
  fromMe: boolean;
};

type WhatsAppContextParams = {
  customerId: string | null;
  context: string | null;
  amountCents: number | null;
  dueDate: string | null;
};

function normalizeCustomerById(payload: any): any | null {
  if (!payload) return null;
  if (payload?.data?.id) return payload.data;
  if (payload?.id) return payload;
  return null;
}

function normalizeMessages(payload: any): Message[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.items)
    ? payload.data.items
    : Array.isArray(payload?.items)
    ? payload.items
    : [];

  return raw.map((message: any) => ({
    id: String(message.id),
    content: String(message.content ?? ""),
    createdAt: String(message.createdAt ?? ""),
    fromMe: Boolean(
      message.fromMe ??
        message.isFromMe ??
        (message.direction === "OUTBOUND")
    ),
  }));
}

function parseLocationParams(location: string): WhatsAppContextParams {
  const params = new URLSearchParams(location.split("?")[1] || "");

  const rawAmount = params.get("amountCents");

  return {
    customerId: params.get("customerId")?.trim() || null,
    context: params.get("context")?.trim() || null,
    amountCents:
      rawAmount !== null && !Number.isNaN(Number(rawAmount))
        ? Number(rawAmount)
        : null,
    dueDate: params.get("dueDate") || null,
  };
}

function buildContextMessage(args: {
  customerName: string;
  context: string | null;
  amountCents: number | null;
}) {
  const firstName = args.customerName?.split(" ")[0] || "cliente";
  const amount =
    args.amountCents !== null
      ? formatCurrency(args.amountCents)
      : "";

  if (args.context === "overdue_charge") {
    return `Olá ${firstName}, tudo bem? Identificamos uma cobrança vencida no valor de ${amount}. Posso te enviar o link de pagamento?`;
  }

  if (args.context === "charge_pending") {
    return `Olá ${firstName}, tudo bem? Lembrete de pagamento no valor de ${amount}. Posso te enviar o link?`;
  }

  return `Olá ${firstName}, tudo bem?`;
}

export default function WhatsAppPage() {
  const [location] = useLocation();
  const routeParams = useMemo(() => parseLocationParams(location), [location]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    routeParams.customerId
  );
  const [messageInput, setMessageInput] = useState("");

  const customerByIdQuery = trpc.nexo.customers.getById.useQuery(
    { id: selectedCustomerId || "" },
    { enabled: Boolean(selectedCustomerId) }
  );

  const whatsappMessagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId || "" },
    { enabled: Boolean(selectedCustomerId) }
  );

  const sendMessageMutation = trpc.nexo.whatsapp.send.useMutation({
    onSuccess: async () => {
      await whatsappMessagesQuery.refetch();
      setMessageInput("");
      toast.success("Mensagem enviada");
    },
  });

  useEffect(() => {
    if (routeParams.customerId) {
      setSelectedCustomerId(routeParams.customerId);
    }
  }, [routeParams.customerId]);

  // 🔥 PREENCHE SÓ SE ESTIVER VAZIO
  useEffect(() => {
    if (!customerByIdQuery.data) return;
    if (messageInput) return;

    const customer = normalizeCustomerById(customerByIdQuery.data);
    if (!customer) return;

    const message = buildContextMessage({
      customerName: customer.name,
      context: routeParams.context,
      amountCents: routeParams.amountCents,
    });

    setMessageInput(message);
  }, [
    customerByIdQuery.data,
    routeParams.context,
    routeParams.amountCents,
    messageInput,
  ]);

  const messages = normalizeMessages(whatsappMessagesQuery.data);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        WhatsApp
      </h1>

      <div className="border rounded-lg p-4 space-y-2 max-h-[400px] overflow-y-auto">
        {messages.map((msg) => (
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

      <div className="flex gap-2">
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
        />

        <Button
          onClick={() =>
            sendMessageMutation.mutate({
              customerId: selectedCustomerId!,
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
