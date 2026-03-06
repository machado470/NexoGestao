import { randomUUID } from "crypto";

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
  metadata?: Record<string, unknown>;
};

const store = new Map<string, OperationalNotification[]>();

function pushNotification(notification: OperationalNotification) {
  const current = store.get(notification.orgId) ?? [];
  store.set(notification.orgId, [notification, ...current].slice(0, 100));
}

export function emitOperationalNotification(input: {
  orgId: string | number;
  type: OperationalEventType;
  metadata?: Record<string, unknown>;
}) {
  const orgId = String(input.orgId);

  const base = {
    id: randomUUID(),
    orgId,
    type: input.type,
    createdAt: new Date(),
    metadata: input.metadata,
  };

  switch (input.type) {
    case "APPOINTMENT_CONFIRMED":
      pushNotification({
        ...base,
        title: "Agendamento confirmado",
        message: "Um agendamento foi confirmado.",
      });
      break;
    case "APPOINTMENT_NO_SHOW":
      pushNotification({
        ...base,
        title: "No-show registrado",
        message: "Um cliente não compareceu ao agendamento.",
      });
      break;
    case "SERVICE_ORDER_COMPLETED":
      pushNotification({
        ...base,
        title: "Ordem de serviço concluída",
        message: "Uma ordem de serviço foi finalizada.",
      });
      break;
    case "PAYMENT_OVERDUE":
      pushNotification({
        ...base,
        title: "Pagamento em atraso",
        message: "Uma cobrança venceu e está em atraso.",
      });
      break;
    case "RISK_LEVEL_CHANGED":
      pushNotification({
        ...base,
        title: "Mudança de nível de risco",
        message: "O nível de risco foi alterado.",
      });
      break;
    default:
      return;
  }
}

export function listOperationalNotifications(orgId: string | number, limit = 20) {
  return (store.get(String(orgId)) ?? []).slice(0, limit);
}

export function __resetOperationalNotificationsForTests() {
  store.clear();
}
