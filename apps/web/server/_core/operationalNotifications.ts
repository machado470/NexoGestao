import prismaClientPkg from "@prisma/client";
import { emitNotificationCenterEvent } from "./notificationCenterEvents";

const { PrismaClient } = prismaClientPkg as unknown as {
  PrismaClient: new () => any;
};

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

export type NotificationCategory = "appointments" | "finance" | "risk";

const CATEGORY_TYPES: Record<NotificationCategory, OperationalEventType[]> = {
  appointments: [
    "APPOINTMENT_CONFIRMED",
    "APPOINTMENT_NO_SHOW",
    "SERVICE_ORDER_COMPLETED",
  ],
  finance: ["PAYMENT_OVERDUE"],
  risk: ["RISK_LEVEL_CHANGED"],
};

export type NotificationListParams = {
  orgId: string | number;
  limit?: number;
  page?: number;
  category?: NotificationCategory | "all";
};

export type NotificationListResult = {
  items: OperationalNotification[];
  total: number;
  page: number;
  pages: number;
  unreadCount: number;
};

const globalForOperationalNotifications = globalThis as unknown as {
  operationalNotificationsPrisma?: any;
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

  const created = await prisma.notification.create({
    data: {
      orgId,
      type: input.type,
      title: payload.title,
      message: payload.message,
      metadata: (input.metadata as unknown) ?? undefined,
      read: false,
    },
  });

  emitNotificationCenterEvent({
    orgId,
    type: "created",
    notificationId: created.id,
  });
}

export async function listOperationalNotifications(
  orgId: string | number,
  limit = 20
) {
  const rows = await prisma.notification.findMany({
    where: { orgId: String(orgId) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row: any) => ({
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

export async function listOperationalNotificationsPaginated(
  params: NotificationListParams
): Promise<NotificationListResult> {
  const orgId = String(params.orgId);
  const limit = Math.max(1, Math.min(params.limit ?? 10, 50));
  const page = Math.max(1, params.page ?? 1);

  const where = {
    orgId,
    ...(params.category && params.category !== "all"
      ? { type: { in: CATEGORY_TYPES[params.category] } }
      : {}),
  };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { orgId, read: false } }),
  ]);

  return {
    items: rows.map((row: any) => ({
      id: row.id,
      orgId: row.orgId,
      type: asOperationalEventType(row.type),
      title: row.title,
      message: row.message,
      createdAt: row.createdAt,
      read: row.read,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    unreadCount,
  };
}

export async function markNotificationAsRead(input: {
  id: string;
  orgId: string | number;
}) {
  const orgId = String(input.orgId);

  const updated = await prisma.notification.updateMany({
    where: {
      id: input.id,
      orgId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  if (updated.count > 0) {
    emitNotificationCenterEvent({
      orgId,
      type: "updated",
      notificationId: input.id,
    });
  }

  return { success: updated.count > 0 };
}

export async function countUnreadOperationalNotifications(
  orgId: string | number
) {
  return prisma.notification.count({
    where: {
      orgId: String(orgId),
      read: false,
    },
  });
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
