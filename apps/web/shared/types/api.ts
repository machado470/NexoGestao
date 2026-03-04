// apps/web/shared/types/api.ts
// Shared usado por client/server. Mantém enums + helpers + contrato de resposta.

export enum ServiceOrderStatus {
  DRAFT = "DRAFT",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum ChargeStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  PAID = "PAID",
  CANCELLED = "CANCELLED"
}

export const SERVICE_ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  [ServiceOrderStatus.DRAFT]: "Rascunho",
  [ServiceOrderStatus.IN_PROGRESS]: "Em Andamento",
  [ServiceOrderStatus.COMPLETED]: "Concluído",
  [ServiceOrderStatus.CANCELLED]: "Cancelado"
};

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  [ChargeStatus.DRAFT]: "Rascunho",
  [ChargeStatus.ISSUED]: "Emitida",
  [ChargeStatus.PAID]: "Paga",
  [ChargeStatus.CANCELLED]: "Cancelada"
};

export const SERVICE_ORDER_STATUS_BADGE: Record<ServiceOrderStatus, string> = {
  [ServiceOrderStatus.DRAFT]: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  [ServiceOrderStatus.IN_PROGRESS]:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  [ServiceOrderStatus.COMPLETED]:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  [ServiceOrderStatus.CANCELLED]: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
};

export const CHARGE_STATUS_BADGE: Record<ChargeStatus, string> = {
  [ChargeStatus.DRAFT]: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  [ChargeStatus.ISSUED]: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  [ChargeStatus.PAID]: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  [ChargeStatus.CANCELLED]: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
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
