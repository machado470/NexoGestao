import { Prisma, PrismaClient } from "@prisma/client";

export type OperationalEventType =
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_NO_SHOW"
  | "SERVICE_ORDER_COMPLETED"
  | "PAYMENT_OVERDUE"
  | "RISK_LEVEL_CHANGED";

export type OperationalNotification = {
  id: string;
  orgId: string;
  type: OperationalEventType;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  metadata?: Record<string, unknown>;
};

const globalForOperationalNotifications = globalThis as unknown as {
  operationalNotificationsPrisma?: PrismaClient;
};

const prisma =
  globalForOperationalNotifications.operationalNotificationsPrisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForOperationalNotifications.operationalNotificationsPrisma = prisma;
}

function asOperationalEventType(type: string): OperationalEventType {
  return type as OperationalEventType;
}

function toNotificationPayload(input: {
  type: OperationalEventType;
  metadata?: Record<string, unknown>;
}) {
  switch (input.type) {
    case "APPOINTMENT_CONFIRMED":
      return {
        title: "Agendamento confirmado",
        message: "Um agendamento foi confirmado.",
      };
    case "APPOINTMENT_NO_SHOW":
      return {
        title: "No-show registrado",
        message: "Um cliente não compareceu ao agendamento.",
      };
    case "SERVICE_ORDER_COMPLETED":
      return {
        title: "Ordem de serviço concluída",
        message: "Uma ordem de serviço foi finalizada.",
      };
    case "PAYMENT_OVERDUE":
      return {
        title: "Pagamento em atraso",
        message: "Uma cobrança venceu e está em atraso.",
      };
    case "RISK_LEVEL_CHANGED":
      return {
        title: "Mudança de nível de risco",
        message: "O nível de risco foi alterado.",
      };
    default:
      return null;
  }
}

export async function emitOperationalNotification(input: {
  orgId: string | number;
  type: OperationalEventType;
  metadata?: Record<string, unknown>;
}) {
  const orgId = String(input.orgId);
  const payload = toNotificationPayload(input);

  if (!payload) return;

  await prisma.notification.create({
    data: {
      orgId,
      type: input.type,
      title: payload.title,
      message: payload.message,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      read: false,
    },
  });
}

export async function listOperationalNotifications(orgId: string | number, limit = 20) {
  const rows = await prisma.notification.findMany({
    where: { orgId: String(orgId) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    orgId: row.orgId,
    type: asOperationalEventType(row.type),
    title: row.title,
    message: row.message,
    createdAt: row.createdAt,
    read: row.read,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  }));
}

export async function __resetOperationalNotificationsForTests() {
  await prisma.notification.deleteMany({
    where: {
      type: {
        in: [
          "APPOINTMENT_CONFIRMED",
          "APPOINTMENT_NO_SHOW",
          "SERVICE_ORDER_COMPLETED",
          "PAYMENT_OVERDUE",
          "RISK_LEVEL_CHANGED",
        ],
      },
    },
  });
}
