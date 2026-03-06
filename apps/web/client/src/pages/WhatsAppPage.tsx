import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Phone, MessageCircle, Search, Plus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface ConversationThread {
  customerId: string;
  customerName: string;
  whatsappNumber?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  messages: any[];
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationThread | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Queries
  const customersQuery = trpc.nexo.customers.list.useQuery();
  const whatsappMessagesQuery = trpc.contact.getWhatsappMessages.useQuery(
    { customerId: selectedCustomerId || "" },
    { enabled: !!selectedCustomerId }
  );

  // Mutations
  const createMessageMutation = trpc.contact.createWhatsappMessage.useMutation();
  const updateStatusMutation = trpc.contact.updateWhatsappMessageStatus.useMutation();

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  // Carregar conversas quando clientes mudam
  useEffect(() => {
    const customerList = (customersQuery.data as any)?.data ?? customersQuery.data ?? [];
    if (Array.isArray(customerList)) {
      const convos = customerList.map((customer: any) => ({
        customerId: customer.id,
        customerName: customer.name,
        whatsappNumber: customer.phone,
        messages: [],
      }));
      setConversations(convos);
    }
  }, [customersQuery.data]);

  // Atualizar conversa selecionada com mensagens
  useEffect(() => {
    if (selectedCustomerId && whatsappMessagesQuery.data) {
      const updated = conversations.map((conv) =>
        conv.customerId === selectedCustomerId
          ? { ...conv, messages: whatsappMessagesQuery.data || [] }
          : conv
      );
      setConversations(updated);

      const selected = updated.find((c) => c.customerId === selectedCustomerId);
      if (selected) {
        setSelectedConversation(selected);
      }
    }
  }, [whatsappMessagesQuery.data, selectedCustomerId]);

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedCustomerId) return;

    try {
      await createMessageMutation.mutateAsync({
        customerId: selectedCustomerId,
        direction: "outbound",
        content: messageInput,
        senderNumber: "+55 (seu número)",
        receiverNumber: selectedConversation?.whatsappNumber,
      });

      setMessageInput("");
      // Refetch mensagens
      await whatsappMessagesQuery.refetch();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  // Filtrar conversas
  const filteredConversations = conversations.filter((conv) =>
    conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.whatsappNumber?.includes(searchQuery)
  );

  // Formatar hora
  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Formatar data
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Lista de Conversas */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">WhatsApp</h1>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-100 dark:bg-gray-700 border-0"
            />
          </div>
        </div>

        {/* Conversas */}
        <div className="flex-1 overflow-y-auto">
          {customersQuery.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.customerId}
                onClick={() => setSelectedCustomerId(conv.customerId)}
                className={`w-full p-4 border-b border-gray-100 dark:border-gray-700 text-left transition-colors ${
                  selectedCustomerId === conv.customerId
                    ? "bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {conv.customerName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {conv.whatsappNumber || "Sem número"}
                    </p>
                    {conv.messages && conv.messages.length > 0 && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-1">
                        {conv.messages[conv.messages.length - 1]?.content}
                      </p>
                    )}
                  </div>
                  {conv.unreadCount && conv.unreadCount > 0 && (
                    <span className="bg-orange-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center ml-2">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-orange-500" />
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
                <Phone className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
              {whatsappMessagesQuery.isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : selectedConversation.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                </div>
              ) : (
                selectedConversation.messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.direction === "outbound"
                          ? "bg-orange-500 text-white rounded-br-none"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
                      }`}
                    >
                      <p className="break-words">{msg.content}</p>
                      {msg.mediaUrl && (
                        <a
                          href={msg.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs mt-2 underline opacity-75 hover:opacity-100"
                        >
                          📎 Mídia anexada
                        </a>
                      )}
                      <p className="text-xs mt-1 opacity-75">
                        {formatTime(msg.createdAt)}
                      </p>
                      {msg.direction === "outbound" && (
                        <p className="text-xs opacity-75">
                          {msg.status === "delivered" && "✓✓"}
                          {msg.status === "read" && "✓✓"}
                          {msg.status === "sent" && "✓"}
                          {msg.status === "pending" && "⏱"}
                          {msg.status === "failed" && "✗"}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={createMessageMutation.isPending || !messageInput.trim()}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {createMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-semibold">Selecione uma conversa</p>
            <p className="text-sm">Escolha um cliente para começar a conversar</p>
          </div>
        )}
      </div>
    </div>
  );
}
