import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

interface Message {
  id: number;
  organizationId: number;
  customerId: number;
  messageId: string | null;
  direction: "inbound" | "outbound";
  content: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  senderNumber?: string | null;
  receiverNumber?: string | null;
  mediaUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function WhatsAppChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading } =
    trpc.whatsapp.getMessages.useQuery(
      { limit: 50, offset: 0 },
      { enabled: isOpen }
    );

  // Send message mutation
  const sendMessageMutation = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => {
      setNewMessage("");
      // Refetch messages
      refetchMessages();
    },
  });

  const refetchMessages = () => {
    // TODO: Implement refetch logic
  };

  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages as any);
    }
  }, [messagesData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPhone.trim()) return;

    setIsLoading(true);
    try {
      await sendMessageMutation.mutateAsync({
        phoneNumber: selectedPhone,
        message: newMessage,
        customerId: 1, // TODO: Get from context
      });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const groupedMessages = messages.reduce(
    (acc, msg) => {
      const phone = msg.senderNumber || msg.receiverNumber || "Unknown";
      if (!acc[phone]) {
        acc[phone] = [];
      }
      acc[phone].push(msg);
      return acc;
    },
    {} as Record<string, Message[]>
  );

  const currentMessages = selectedPhone ? groupedMessages[selectedPhone] || [] : [];

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full p-4 shadow-lg transition-all duration-300 z-40"
        title="WhatsApp Chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col z-40 border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="bg-orange-500 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <h3 className="font-semibold">WhatsApp Chat</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-orange-600 p-1 rounded transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Phone Selection */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="Número do telefone"
                value={selectedPhone}
                onChange={(e) => setSelectedPhone(e.target.value)}
                className="flex-1"
              />
            </div>
            {Object.keys(groupedMessages).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.keys(groupedMessages).map((phone) => (
                  <button
                    key={phone}
                    onClick={() => setSelectedPhone(phone)}
                    className={`text-sm px-3 py-1 rounded transition ${
                      selectedPhone === phone
                        ? "bg-orange-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    {phone}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : currentMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p className="text-center">
                  {selectedPhone
                    ? "Nenhuma mensagem"
                    : "Selecione um número para ver mensagens"}
                </p>
              </div>
            ) : (
              <>
                {currentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.direction === "outbound"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg ${
                        msg.direction === "outbound"
                          ? "bg-orange-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <Input
              type="text"
              placeholder="Digite uma mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading || !selectedPhone}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !newMessage.trim() || !selectedPhone}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
