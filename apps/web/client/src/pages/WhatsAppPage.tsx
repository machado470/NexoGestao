import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  buildWhatsAppConversationUrl,
  formatCurrency,
  formatDate,
} from "@/lib/operations/operations.utils";

type Message = {
  id: string;
  content: string;
  createdAt: string;
  fromMe: boolean;
};

type Conversation = {
  customerId: string;
  customerName: string;
  whatsappNumber?: string | null;
  messages: Message[];
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
};

type WhatsAppContextParams = {
  customerId: string | null;
  context: string | null;
  chargeId: string | null;
  serviceOrderId: string | null;
  amountCents: number | null;
  dueDate: string | null;
};

function normalizeCustomerList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

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

  const customerId = params.get("customerId")?.trim() || null;
  const context = params.get("context")?.trim() || null;
  const chargeId = params.get("chargeId")?.trim() || null;
  const serviceOrderId = params.get("serviceOrderId")?.trim() || null;
  const dueDate = params.get("dueDate")?.trim() || null;

  const rawAmountCents = params.get("amountCents")?.trim() || "";
  const amountCents =
    rawAmountCents && !Number.isNaN(Number(rawAmountCents))
      ? Number(rawAmountCents)
      : null;

  return {
    customerId,
    context,
    chargeId,
    serviceOrderId,
    amountCents,
    dueDate,
  };
}

function buildContextMessage(args: {
  customerName: string;
  context: string | null;
  amountCents: number | null;
  dueDate: string | null;
}) {
  const firstName = args.customerName?.trim()?.split(" ")[0] || "cliente";
  const amountLabel =
    args.amountCents != null ? formatCurrency(args.amountCents) : null;
  const dueDateLabel = args.dueDate ? formatDate(args.dueDate) : null;

  if (args.context === "overdue_charge") {
    if (amountLabel && dueDateLabel) {
      return `Olá ${firstName}, tudo bem? Identificamos uma cobrança pendente no valor de ${amountLabel}, com vencimento em ${dueDateLabel}. Posso te enviar o link para regularização?`;
    }

    if (amountLabel) {
      return `Olá ${firstName}, tudo bem? Identificamos uma cobrança pendente no valor de ${amountLabel}. Posso te enviar o link para regularização?`;
    }

    return `Olá ${firstName}, tudo bem? Identificamos uma cobrança pendente. Posso te enviar o link para regularização?`;
  }

  if (args.context === "service_order_followup") {
    return `Olá ${firstName}, tudo bem? Estou entrando em contato sobre o seu atendimento para alinhar os próximos passos.`;
  }

  return `Olá ${firstName}, tudo bem? Posso te ajudar com seu atendimento?`;
}

export default function WhatsAppPage() {
  const [location, navigate] = useLocation();

  const routeParams = useMemo(() => parseLocationParams(location), [location]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    routeParams.customerId
  );
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!routeParams.customerId) return;

    setSelectedCustomerId((current) =>
      current === routeParams.customerId ? current : routeParams.customerId
    );
  }, [routeParams.customerId]);

  const customersQuery = trpc.nexo.customers.list.useQuery();

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
      toast.success("Mensagem enviada");
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível enviar a mensagem.");
    },
  });

  useEffect(() => {
    const customerList = normalizeCustomerList(customersQuery.data);

    const convos: Conversation[] = customerList.map((customer: any) => ({
      customerId: String(customer.id),
      customerName: String(customer.name ?? "Cliente"),
      whatsappNumber: customer.whatsappNumber ?? customer.phone ?? null,
      messages: [],
      unreadCount: 0,
    }));

    setConversations((prev) => {
      const messagesByCustomer = new Map(
        prev.map((conversation) => [conversation.customerId, conversation.messages])
      );

      let updated: Conversation[] = convos.map((conversation) => {
        const existingMessages =
          messagesByCustomer.get(conversation.customerId) ?? [];
        const lastMessage = existingMessages[existingMessages.length - 1];

        return {
          ...conversation,
          messages: existingMessages,
          lastMessage: lastMessage?.content,
          lastMessageTime: lastMessage?.createdAt,
          unreadCount: 0,
        };
      });

      if (
        selectedCustomerId &&
        !updated.some((conversation) => conversation.customerId === selectedCustomerId)
      ) {
        const customer = normalizeCustomerById(customerByIdQuery.data);

        updated = [
          {
            customerId: selectedCustomerId,
            customerName: customer?.name ? String(customer.name) : "Carregando...",
            whatsappNumber: customer?.whatsappNumber ?? customer?.phone ?? "",
            messages: [],
            unreadCount: 0,
          },
          ...updated,
        ];
      }

      if (selectedCustomerId) {
        updated = updated.sort((a, b) => {
          if (a.customerId === selectedCustomerId) return -1;
          if (b.customerId === selectedCustomerId) return 1;
          return 0;
        });
      }

      return updated;
    });

    if (!selectedCustomerId && !routeParams.customerId && convos.length > 0) {
      setSelectedCustomerId(convos[0].customerId);
    }
  }, [
    customersQuery.data,
    selectedCustomerId,
    customerByIdQuery.data,
    routeParams.customerId,
  ]);

  useEffect(() => {
    if (!selectedCustomerId) return;

    const messages = normalizeMessages(whatsappMessagesQuery.data);

    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.customerId !== selectedCustomerId) return conversation;

        const lastMessage = messages[messages.length - 1];

        return {
          ...conversation,
          messages,
          lastMessage: lastMessage?.content,
          lastMessageTime: lastMessage?.createdAt,
          unreadCount: 0,
        };
      })
    );
  }, [whatsappMessagesQuery.data, selectedCustomerId]);

  const selectedConversation = useMemo(() => {
    return (
      conversations.find((conversation) => conversation.customerId === selectedCustomerId) ??
      null
    );
  }, [conversations, selectedCustomerId]);

  const filteredConversations = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    if (!term) return conversations;

    return conversations.filter((conversation) =>
      conversation.customerName.toLowerCase().includes(term)
    );
  }, [conversations, searchQuery]);

  const contextSummary = useMemo(() => {
    if (!selectedConversation) {
      return null;
    }

    if (routeParams.context === "overdue_charge") {
      const parts: string[] = ["Cobrança pendente em aberto"];

      if (routeParams.amountCents != null) {
        parts.push(formatCurrency(routeParams.amountCents));
      }

      if (routeParams.dueDate) {
        parts.push(`vencimento ${formatDate(routeParams.dueDate)}`);
      }

      return parts.join(" • ");
    }

    if (routeParams.context === "service_order_followup") {
      const parts: string[] = ["Acompanhamento da ordem de serviço"];

      if (routeParams.serviceOrderId) {
        parts.push(`O.S. ${routeParams.serviceOrderId.slice(0, 8)}`);
      }

      return parts.join(" • ");
    }

    return null;
  }, [
    selectedConversation,
    routeParams.context,
    routeParams.amountCents,
    routeParams.dueDate,
    routeParams.serviceOrderId,
  ]);

  useEffect(() => {
    if (!selectedConversation) return;

    setMessageInput((prev) => {
      if (prev.trim()) return prev;

      return buildContextMessage({
        customerName: selectedConversation.customerName,
        context: routeParams.context,
        amountCents: routeParams.amountCents,
        dueDate: routeParams.dueDate,
      });
    });
  }, [
    selectedConversation,
    routeParams.context,
    routeParams.amountCents,
    routeParams.dueDate,
  ]);

  const handleSelectConversation = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setMessageInput("");

    const conversationUrl = buildWhatsAppConversationUrl({
      customerId,
    });

    if (conversationUrl) {
      navigate(conversationUrl, { replace: true });
    }
  };

  const handleSendMessage = async () => {
    const content = messageInput.trim();

    if (!content || !selectedCustomerId) return;

    if (!selectedConversation?.whatsappNumber) {
      toast.error("Este cliente não possui número de WhatsApp.");
      return;
    }

    await sendMessageMutation.mutateAsync({
      customerId: selectedCustomerId,
      content,
      toPhone: selectedConversation.whatsappNumber,
    });

    setMessageInput("");
  };

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-gray-200 bg-white p-4">
        <Input
          placeholder="Buscar..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="mt-4 space-y-2">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-sm text-gray-500">
              <MessageCircle className="mb-2 h-10 w-10 opacity-50" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isSelected = selectedCustomerId === conversation.customerId;

              return (
                <button
                  key={conversation.customerId}
                  type="button"
                  onClick={() => handleSelectConversation(conversation.customerId)}
                  className={`block w-full rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-orange-500 bg-orange-50"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <div className="truncate font-semibold text-gray-900">
                    {conversation.customerName}
                  </div>
                  <div className="truncate text-sm text-gray-500">
                    {conversation.whatsappNumber || "Sem número"}
                  </div>
                  <div className="mt-1 truncate text-xs text-gray-500">
                    {conversation.lastMessage || "Sem mensagens"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {selectedConversation ? (
          <>
            <div className="border-b border-gray-200 p-4">
              <h2 className="truncate font-semibold text-gray-900">
                {selectedConversation.customerName}
              </h2>
              <p className="truncate text-sm text-gray-500">
                {selectedConversation.whatsappNumber || "Sem número"}
              </p>

              {contextSummary ? (
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                  {contextSummary}
                </div>
              ) : null}
            </div>

            <div className="flex-1 overflow-auto p-4">
              {whatsappMessagesQuery.isLoading ? (
                <div className="text-sm text-gray-500">Carregando mensagens...</div>
              ) : selectedConversation.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                  <MessageCircle className="mb-2 h-12 w-12 opacity-50" />
                  <p>Nenhuma mensagem</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          message.fromMe
                            ? "bg-orange-500 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <p
                          className={`mt-1 text-[11px] ${
                            message.fromMe ? "text-orange-100" : "text-gray-500"
                          }`}
                        >
                          {message.createdAt || "Agora"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-4">
              {!selectedConversation.whatsappNumber ? (
                <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                  Este cliente não possui número de WhatsApp cadastrado.
                </div>
              ) : null}

              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Digite sua mensagem"
                  disabled={
                    sendMessageMutation.isPending || !selectedConversation.whatsappNumber
                  }
                />

                <Button
                  onClick={() => void handleSendMessage()}
                  disabled={
                    sendMessageMutation.isPending ||
                    !messageInput.trim() ||
                    !selectedConversation.whatsappNumber
                  }
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Enviar
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Nenhuma conversa selecionada
          </div>
        )}
      </div>
    </div>
  );
}
