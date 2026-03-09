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
  readAt?: Date;
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
  operationalNotificationsMemoryStore?: OperationalNotification[];
};

const prisma =
  globalForOperationalNotifications.operationalNotificationsPrisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForOperationalNotifications.operationalNotificationsPrisma = prisma;
}

const memoryStore =
  globalForOperationalNotifications.operationalNotificationsMemoryStore ?? [];

if (process.env.NODE_ENV !== "production") {
  globalForOperationalNotifications.operationalNotificationsMemoryStore = memoryStore;
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

function generateNotificationId() {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function supportsPrismaNotificationDelegate() {
  return Boolean(prisma && prisma.notification);
}

function sortByCreatedAtDesc<T extends { createdAt: Date }>(items: T[]) {
  return [...items].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

function filterByCategory(
  items: OperationalNotification[],
  category?: NotificationCategory | "all"
) {
  if (!category || category === "all") return items;
  return items.filter((item) => CATEGORY_TYPES[category].includes(item.type));
}

async function createNotificationRecord(data: {
  orgId: string;
  type: OperationalEventType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  read: boolean;
}) {
  if (supportsPrismaNotificationDelegate()) {
    return prisma.notification.create({
      data: {
        orgId: data.orgId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: (data.metadata as unknown) ?? undefined,
        read: data.read,
      },
    });
  }

  const created: OperationalNotification = {
    id: generateNotificationId(),
    orgId: data.orgId,
    type: data.type,
    title: data.title,
    message: data.message,
    metadata: data.metadata,
    read: data.read,
    createdAt: new Date(),
  };

  memoryStore.push(created);
  return created;
}

async function findNotifications(params: {
  orgId: string;
  limit?: number;
  skip?: number;
  category?: NotificationCategory | "all";
}) {
  if (supportsPrismaNotificationDelegate()) {
    const where = {
      orgId: params.orgId,
      ...(params.category && params.category !== "all"
        ? { type: { in: CATEGORY_TYPES[params.category] } }
        : {}),
    };

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.skip,
    });
  }

  const filtered = filterByCategory(
    memoryStore.filter((item) => item.orgId === params.orgId),
    params.category
  );

  const sorted = sortByCreatedAtDesc(filtered);
  const start = params.skip ?? 0;
  const end = params.limit ? start + params.limit : undefined;

  return sorted.slice(start, end);
}

async function countNotifications(params: {
  orgId: string;
  unreadOnly?: boolean;
  category?: NotificationCategory | "all";
}) {
  if (supportsPrismaNotificationDelegate()) {
    const where = {
      orgId: params.orgId,
      ...(params.unreadOnly ? { read: false } : {}),
      ...(params.category && params.category !== "all"
        ? { type: { in: CATEGORY_TYPES[params.category] } }
        : {}),
    };

    return prisma.notification.count({ where });
  }

  return filterByCategory(
    memoryStore.filter(
      (item) =>
        item.orgId === params.orgId &&
        (!params.unreadOnly || item.read === false)
    ),
    params.category
  ).length;
}

async function markAsRead(params: { id: string; orgId: string }) {
  if (supportsPrismaNotificationDelegate()) {
    return prisma.notification.updateMany({
      where: {
        id: params.id,
        orgId: params.orgId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  let updatedCount = 0;

  for (const item of memoryStore) {
    if (item.id === params.id && item.orgId === params.orgId && item.read === false) {
      item.read = true;
      item.readAt = new Date();
      updatedCount += 1;
    }
  }

  return { count: updatedCount };
}

function normalizeRow(row: any): OperationalNotification {
  return {
    id: row.id,
    orgId: row.orgId,
    type: asOperationalEventType(row.type),
    title: row.title,
    message: row.message,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    read: Boolean(row.read),
    readAt: row.readAt ? new Date(row.readAt) : undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  };
}

export async function emitOperationalNotification(input: {
  orgId: string | number;
  type: OperationalEventType;
  metadata?: Record<string, unknown>;
}) {
  const orgId = String(input.orgId);
  const payload = toNotificationPayload(input);

  if (!payload) return;

  const created = await createNotificationRecord({
    orgId,
    type: input.type,
    title: payload.title,
    message: payload.message,
    metadata: input.metadata,
    read: false,
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
  const rows = await findNotifications({
    orgId: String(orgId),
    limit,
  });

  return rows.map(normalizeRow);
}

export async function listOperationalNotificationsPaginated(
  params: NotificationListParams
): Promise<NotificationListResult> {
  const orgId = String(params.orgId);
  const limit = Math.max(1, Math.min(params.limit ?? 10, 50));
  const page = Math.max(1, params.page ?? 1);

  const [rows, total, unreadCount] = await Promise.all([
    findNotifications({
      orgId,
      category: params.category,
      limit,
      skip: (page - 1) * limit,
    }),
    countNotifications({
      orgId,
      category: params.category,
    }),
    countNotifications({
      orgId,
      unreadOnly: true,
    }),
  ]);

  return {
    items: rows.map(normalizeRow),
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
  const updated = await markAsRead({
    id: input.id,
    orgId,
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
  return countNotifications({
    orgId: String(orgId),
    unreadOnly: true,
  });
}

export async function __resetOperationalNotificationsForTests() {
  if (supportsPrismaNotificationDelegate()) {
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
    return;
  }

  memoryStore.length = 0;
}
