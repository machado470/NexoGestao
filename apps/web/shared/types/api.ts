// apps/web/shared/types/api.ts
// Shared usado por client/server. Mantém enums + helpers + contrato de resposta.

export enum ServiceOrderStatus {
  OPEN = "OPEN",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
  CANCELED = "CANCELED"
}

export enum ChargeStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
  CANCELED = "CANCELED"
}

export enum AppointmentStatus {
  SCHEDULED = "SCHEDULED",
  CONFIRMED = "CONFIRMED",
  CANCELED = "CANCELED",
  DONE = "DONE",
  NO_SHOW = "NO_SHOW"
}

export const SERVICE_ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  [ServiceOrderStatus.OPEN]: "Aberta",
  [ServiceOrderStatus.ASSIGNED]: "Atribuída",
  [ServiceOrderStatus.IN_PROGRESS]: "Em Andamento",
  [ServiceOrderStatus.DONE]: "Concluída",
  [ServiceOrderStatus.CANCELED]: "Cancelada"
};

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  [ChargeStatus.PENDING]: "Pendente",
  [ChargeStatus.PAID]: "Paga",
  [ChargeStatus.OVERDUE]: "Vencida",
  [ChargeStatus.CANCELED]: "Cancelada"
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: "Agendado",
  [AppointmentStatus.CONFIRMED]: "Confirmado",
  [AppointmentStatus.CANCELED]: "Cancelado",
  [AppointmentStatus.DONE]: "Realizado",
  [AppointmentStatus.NO_SHOW]: "Não Compareceu"
};

export const SERVICE_ORDER_STATUS_BADGE: Record<ServiceOrderStatus, string> = {
  [ServiceOrderStatus.OPEN]: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  [ServiceOrderStatus.ASSIGNED]: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  [ServiceOrderStatus.IN_PROGRESS]: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  [ServiceOrderStatus.DONE]: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  [ServiceOrderStatus.CANCELED]: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
};

export const CHARGE_STATUS_BADGE: Record<ChargeStatus, string> = {
  [ChargeStatus.PENDING]: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  [ChargeStatus.PAID]: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  [ChargeStatus.OVERDUE]: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  [ChargeStatus.CANCELED]: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
};

// --------------------
// API response helpers (server espera isso)
// --------------------

export enum ErrorCode {
  // genéricos
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  VALIDATION_ERROR = "VALIDATION_ERROR",

  // auth/token
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // validação/domínio
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_FIELD = "MISSING_FIELD",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  INVALID_STATUS = "INVALID_STATUS",
  OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",

  // financeiro/exemplos do teu mapping
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",

  // infra
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
}

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
  timestamp?: string;
};

export type ApiMeta = {
  requestId?: string;
  timestamp?: string;
  [k: string]: unknown;
};

// server tá usando { success: true/false } e adiciona meta em sucesso
export type ApiResponse<T> =
  | { success: true; data: T; meta?: ApiMeta }
  | { success: false; error: ApiError };

// Paginação (server usa hasPrev/hasNext) e embrulha com success também
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  meta?: ApiMeta;
};
