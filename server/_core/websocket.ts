import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

/**
 * WebSocket Server para sincronização em tempo real
 * Usado para notificar clientes sobre novas mensagens WhatsApp
 */

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] Cliente conectado: ${socket.id}`);

    // Usuário se junta a uma sala para receber mensagens
    socket.on("join-organization", (organizationId: number) => {
      const room = `org-${organizationId}`;
      socket.join(room);
      console.log(`[WebSocket] Cliente ${socket.id} entrou na sala ${room}`);
    });

    // Usuário se junta a uma sala de conversa com cliente
    socket.on("join-conversation", (customerId: number) => {
      const room = `conversation-${customerId}`;
      socket.join(room);
      console.log(`[WebSocket] Cliente ${socket.id} entrou na conversa ${room}`);
    });

    // Sair de uma sala
    socket.on("leave-conversation", (customerId: number) => {
      const room = `conversation-${customerId}`;
      socket.leave(room);
      console.log(`[WebSocket] Cliente ${socket.id} saiu da conversa ${room}`);
    });

    // Desconexão
    socket.on("disconnect", () => {
      console.log(`[WebSocket] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getWebSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emitir nova mensagem para todos os clientes em uma conversa
 */
export function broadcastNewMessage(
  customerId: number,
  message: {
    id: string;
    content: string;
    direction: "inbound" | "outbound";
    status: string;
    timestamp: Date;
    mediaUrl?: string;
  }
) {
  if (!io) return;

  const room = `conversation-${customerId}`;
  io.to(room).emit("new-message", {
    customerId,
    message,
  });

  console.log(`[WebSocket] Nova mensagem emitida para ${room}`);
}

/**
 * Emitir atualização de status de mensagem
 */
export function broadcastMessageStatusUpdate(
  customerId: number,
  messageId: string,
  status: "sent" | "delivered" | "read" | "failed"
) {
  if (!io) return;

  const room = `conversation-${customerId}`;
  io.to(room).emit("message-status-update", {
    customerId,
    messageId,
    status,
    timestamp: new Date(),
  });

  console.log(`[WebSocket] Status de mensagem atualizado: ${messageId} -> ${status}`);
}

/**
 * Emitir notificação de nova conversa
 */
export function broadcastNewConversation(
  organizationId: number,
  conversation: {
    customerId: number;
    customerName: string;
    lastMessage: string;
    timestamp: Date;
  }
) {
  if (!io) return;

  const room = `org-${organizationId}`;
  io.to(room).emit("new-conversation", conversation);

  console.log(`[WebSocket] Nova conversa emitida para ${room}`);
}

/**
 * Emitir notificação de digitação
 */
export function broadcastTypingIndicator(
  customerId: number,
  isTyping: boolean,
  senderName?: string
) {
  if (!io) return;

  const room = `conversation-${customerId}`;
  io.to(room).emit("typing-indicator", {
    customerId,
    isTyping,
    senderName,
    timestamp: new Date(),
  });
}

/**
 * Emitir notificação de leitura de mensagem
 */
export function broadcastMessageRead(customerId: number, messageId: string) {
  if (!io) return;

  const room = `conversation-${customerId}`;
  io.to(room).emit("message-read", {
    customerId,
    messageId,
    timestamp: new Date(),
  });
}
