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
  RefreshCcw,
  UserCircle2,
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

function mapDirection(value: unknown): ConversationMessage["direction"] {
  const direction = String(value ?? "").toUpperCase();

  if (direction === "INBOUND" || direction === "RECEIVED") return "inbound";
  return "outbound";
}

function normalizeMessages(payload: any): ConversationMessage[] {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return rows.map((msg: any, index: number) => ({
    id: String(msg?.id ?? `${msg?.createdAt ?? "msg"}-${index}`),
    customerId: msg?.customerId ? String(msg.customerId) : undefined,
    direction: mapDirection(msg?.direction),
    content: String(msg?.renderedText ?? msg?.content ?? "").trim(),
    status: mapStatus(msg?.status),
    createdAt: msg?.createdAt
      ? String(msg.createdAt)
      : new Date().toISOString(),
    mediaUrl: msg?.mediaUrl ? String(msg.mediaUrl) : undefined,
    senderNumber: msg?.fromPhone ? String(msg.fromPhone) : undefined,
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

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(value?: string | null, max = 52) {
  const text = (value ?? "").trim();
  if (!text) return "Sem mensagem";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function getMessageStatusLabel(status: ConversationMessage["status"]) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "sent":
      return "Enviada";
    case "delivered":
      return "Entregue";
    case "read":
      return "Lida";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

export default function WhatsAppPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const whatsappMessagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId || "" },
    {
      enabled: Boolean(selectedCustomerId),
      retry: false,
      refetchOnWindowFocus: false,
    }
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
  }, [whatsappMessagesQuery.data, selectedCustomerId]);

  useEffect(() => {
    if (customersQuery.error) {
      toast.error("Erro ao carregar clientes: " + customersQuery.error.message);
    }
  }, [customersQuery.error]);

  useEffect(() => {
    if (whatsappMessagesQuery.error) {
      toast.error("Erro ao carregar mensagens: " + whatsappMessagesQuery.error.message);
    }
  }, [whatsappMessagesQuery.error]);

  useEffect(() => {
    const customerList = normalizeCustomers(customersQuery.data);

    const convos: ConversationThread[] = customerList.map((customer: any) => ({
      customerId: String(customer.id),
      customerName: String(customer.name ?? "Cliente"),
      whatsappNumber: customer.phone ? String(customer.phone) : undefined,
      unreadCount: 0,
      messages: [],
    }));

    setConversations((prev) => {
      const messagesByCustomer = new Map(
        prev.map((conversation) => [conversation.customerId, conversation.messages])
      );

      return convos.map((conversation) => {
        const existingMessages = messagesByCustomer.get(conversation.customerId) ?? [];
        const lastMessage = existingMessages[existingMessages.length - 1];

        return {
          ...conversation,
          messages: existingMessages,
          lastMessage: lastMessage?.content,
          lastMessageTime: lastMessage?.createdAt,
          unreadCount: 0,
        };
      });
    });

    if (!selectedCustomerId && convos.length > 0) {
      setSelectedCustomerId(convos[0].customerId);
    }
  }, [customersQuery.data, selectedCustomerId]);

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
      conversations.find((conversation) => {
        return conversation.customerId === selectedCustomerId;
      }) ?? null
    );
  }, [conversations, selectedCustomerId]);

  const filteredConversations = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    if (!term) return conversations;

    return conversations.filter((conversation) => {
      return (
        conversation.customerName.toLowerCase().includes(term) ||
        String(conversation.whatsappNumber ?? "").includes(searchQuery)
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
      // toast já tratado
    }
  };

  const handleRefreshConversation = async () => {
    if (!selectedCustomerId) return;
    await whatsappMessagesQuery.refetch();
  };

  const handleRefreshCustomers = async () => {
    await customersQuery.refetch();
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
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex w-full max-w-sm flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                WhatsApp
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Conversas operacionais com clientes
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void handleRefreshCustomers()}
              className="shrink-0"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

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
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-500">
              <MessageCircle className="mb-2 h-12 w-12 opacity-50" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isSelected = selectedCustomerId === conversation.customerId;

              return (
                <button
                  key={conversation.customerId}
                  type="button"
                  onClick={() => setSelectedCustomerId(conversation.customerId)}
                  className={`w-full border-b border-gray-100 p-4 text-left transition-colors dark:border-gray-700 ${
                    isSelected
                      ? "border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-gray-900 dark:text-white">
                        {conversation.customerName}
                      </h3>

                      <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                        {conversation.whatsappNumber || "Sem número"}
                      </p>

                      <p className="mt-1 truncate text-xs text-gray-600 dark:text-gray-300">
                        {truncateText(conversation.lastMessage)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {conversation.lastMessageTime
                          ? formatTime(conversation.lastMessageTime)
                          : "—"}
                      </span>

                      {conversation.unreadCount && conversation.unreadCount > 0 ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-gray-800">
        {selectedConversation ? (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                  <UserCircle2 className="h-6 w-6 text-orange-500" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-gray-900 dark:text-white">
                    {selectedConversation.customerName}
                  </h2>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                    {selectedConversation.whatsappNumber || "Sem número"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void handleRefreshConversation()}
                  disabled={!selectedCustomerId || whatsappMessagesQuery.isFetching}
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${whatsappMessagesQuery.isFetching ? "animate-spin" : ""}`}
                  />
                </Button>

                <Button type="button" variant="ghost" size="icon" disabled>
                  <Phone className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              Última atualização:{" "}
              {selectedConversation.lastMessageTime
                ? formatDateTime(selectedConversation.lastMessageTime)
                : "sem mensagens"}
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
                <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                  <MessageCircle className="mb-2 h-12 w-12 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="mt-1 text-sm">
                    Envie a primeira mensagem para iniciar o histórico.
                  </p>
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
                      className={`max-w-xs rounded-lg px-4 py-3 shadow-sm lg:max-w-md ${
                        message.direction === "outbound"
                          ? "rounded-br-none bg-orange-500 text-white"
                          : "rounded-bl-none bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                      }`}
                    >
                      <p className="break-words text-sm">{message.content || "Mensagem vazia"}</p>

                      {message.mediaUrl ? (
                        <a
                          href={message.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block text-xs underline opacity-80 hover:opacity-100"
                        >
                          📎 Mídia anexada
                        </a>
                      ) : null}

                      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] opacity-80">
                        <span>{formatTime(message.createdAt)}</span>

                        {message.direction === "outbound" ? (
                          <span>{getMessageStatusLabel(message.status)}</span>
                        ) : (
                          <span>Recebida</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              {!selectedConversation.whatsappNumber ? (
                <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/30 dark:text-yellow-300">
                  Este cliente não possui número de WhatsApp cadastrado.
                </div>
              ) : null}

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
                  disabled={!selectedConversation.whatsappNumber}
                />

                <Button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={
                    createMessageMutation.isPending ||
                    !messageInput.trim() ||
                    !selectedConversation.whatsappNumber
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
          <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-500">
            <MessageCircle className="mb-4 h-16 w-16 opacity-50" />
            <p className="text-lg font-semibold">Selecione uma conversa</p>
            <p className="text-sm">
              Escolha um cliente para ver o histórico e enviar mensagens.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
