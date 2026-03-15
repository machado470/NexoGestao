import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Send,
  Phone,
  MessageCircle,
  Search,
  AlertTriangle,
} from "lucide-react";

interface ConversationMessage {
  id: string;
  customerId?: string;
  direction: "inbound" | "outbound";
  content: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  createdAt: string;
  mediaUrl?: string;
  senderNumber?: string;
  receiverNumber?: string;
}

interface ConversationThread {
  customerId: string;
  customerName: string;
  whatsappNumber?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  messages: ConversationMessage[];
}

function mapStatus(value: unknown): ConversationMessage["status"] {
  const status = String(value ?? "").toUpperCase();

  if (status === "QUEUED" || status === "SENDING") return "pending";
  if (status === "SENT") return "sent";
  if (status === "DELIVERED") return "delivered";
  if (status === "READ") return "read";
  if (status === "FAILED" || status === "CANCELED") return "failed";

  return "sent";
}

function normalizeMessages(payload: any): ConversationMessage[] {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return rows.map((msg: any) => ({
    id: String(msg?.id ?? crypto.randomUUID()),
    customerId: msg?.customerId ? String(msg.customerId) : undefined,
    direction: "outbound",
    content: String(msg?.renderedText ?? msg?.content ?? ""),
    status: mapStatus(msg?.status),
    createdAt: msg?.createdAt
      ? String(msg.createdAt)
      : new Date().toISOString(),
    mediaUrl: msg?.mediaUrl ? String(msg.mediaUrl) : undefined,
    senderNumber: undefined,
    receiverNumber: msg?.toPhone ? String(msg.toPhone) : undefined,
  }));
}

function normalizeCustomers(payload: any): any[] {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return rows;
}

export default function WhatsAppPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const customersQuery = trpc.nexo.customers.list.useQuery();

  const whatsappMessagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId || "" },
    { enabled: !!selectedCustomerId }
  );

  const createMessageMutation = trpc.nexo.whatsapp.send.useMutation({
    onSuccess: () => {
      toast.success("Mensagem enviada.");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar mensagem.");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [whatsappMessagesQuery.data]);

  useEffect(() => {
    const customerList = normalizeCustomers(customersQuery.data);

    const convos: ConversationThread[] = customerList.map((customer: any) => ({
      customerId: String(customer.id),
      customerName: customer.name,
      whatsappNumber: customer.phone || undefined,
      unreadCount: 0,
      messages: [],
    }));

    setConversations(convos);

    if (!selectedCustomerId && convos.length > 0) {
      setSelectedCustomerId(convos[0].customerId);
    }
  }, [customersQuery.data, selectedCustomerId]);

  useEffect(() => {
    if (!selectedCustomerId) return;

    const messages = normalizeMessages(whatsappMessagesQuery.data);

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.customerId !== selectedCustomerId) return conv;

        const lastMessage = messages[messages.length - 1];

        return {
          ...conv,
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
      conversations.find((conversation) => {
        return conversation.customerId === selectedCustomerId;
      }) ?? null
    );
  }, [conversations, selectedCustomerId]);

  const filteredConversations = useMemo(() => {
    const term = searchQuery.toLowerCase();

    return conversations.filter((conversation) => {
      return (
        conversation.customerName.toLowerCase().includes(term) ||
        conversation.whatsappNumber?.includes(searchQuery)
      );
    });
  }, [conversations, searchQuery]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedCustomerId) return;

    if (!selectedConversation?.whatsappNumber) {
      toast.error("Este cliente não possui número de WhatsApp.");
      return;
    }

    try {
      await createMessageMutation.mutateAsync({
        customerId: selectedCustomerId,
        content: messageInput.trim(),
        toPhone: selectedConversation.whatsappNumber,
      });

      setMessageInput("");
      await whatsappMessagesQuery.refetch();
    } catch {
      // toast já tratado no mutation
    }
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (customersQuery.isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (customersQuery.isError) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar conversas
          </div>
          <p className="mt-2 text-sm">
            Não foi possível carregar os clientes para o módulo de WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex w-80 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            WhatsApp
          </h1>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-gray-100 pl-10 dark:bg-gray-700"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <MessageCircle className="mb-2 h-12 w-12 opacity-50" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.customerId}
                onClick={() => setSelectedCustomerId(conversation.customerId)}
                className={`w-full border-b border-gray-100 p-4 text-left transition-colors dark:border-gray-700 ${
                  selectedCustomerId === conversation.customerId
                    ? "border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-white">
                      {conversation.customerName}
                    </h3>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {conversation.whatsappNumber || "Sem número"}
                    </p>

                    {conversation.lastMessage && (
                      <p className="mt-1 truncate text-xs text-gray-600 dark:text-gray-300">
                        {conversation.lastMessage}
                      </p>
                    )}
                  </div>

                  {conversation.unreadCount && conversation.unreadCount > 0 && (
                    <span className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-white dark:bg-gray-800">
        {selectedConversation ? (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                  <MessageCircle className="h-6 w-6 text-orange-500" />
                </div>

                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {selectedConversation.customerName}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedConversation.whatsappNumber || "Sem número"}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="icon">
                <Phone className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900">
              {whatsappMessagesQuery.isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
              ) : whatsappMessagesQuery.isError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  Erro ao carregar mensagens desta conversa.
                </div>
              ) : selectedConversation.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-gray-500">
                  <MessageCircle className="mb-2 h-12 w-12 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                </div>
              ) : (
                selectedConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.direction === "outbound"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                        message.direction === "outbound"
                          ? "rounded-br-none bg-orange-500 text-white"
                          : "rounded-bl-none bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                      }`}
                    >
                      <p className="break-words">{message.content}</p>

                      {message.mediaUrl && (
                        <a
                          href={message.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block text-xs underline opacity-75 hover:opacity-100"
                        >
                          📎 Mídia anexada
                        </a>
                      )}

                      <p className="mt-1 text-xs opacity-75">
                        {formatTime(message.createdAt)}
                      </p>

                      {message.direction === "outbound" && (
                        <p className="text-xs opacity-75">
                          {message.status === "delivered" && "✓✓"}
                          {message.status === "read" && "✓✓"}
                          {message.status === "sent" && "✓"}
                          {message.status === "pending" && "⏱"}
                          {message.status === "failed" && "✗"}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />

                <Button
                  onClick={() => void handleSendMessage()}
                  disabled={
                    createMessageMutation.isPending || !messageInput.trim()
                  }
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {createMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-gray-500">
            <MessageCircle className="mb-4 h-16 w-16 opacity-50" />
            <p className="text-lg font-semibold">Selecione uma conversa</p>
            <p className="text-sm">
              Escolha um cliente para começar a conversar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
