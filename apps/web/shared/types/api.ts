/**
 * Padrões de resposta de API - Todos os endpoints devem seguir estes padrões
 */

export enum ErrorCode {
  // Autenticação (1000-1099)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Autorização (1100-1199)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validação (1200-1299)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  
  // Recursos (1300-1399)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Negócio (1400-1499)
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_STATUS = 'INVALID_STATUS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  
  // Sistema (1500-1599)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface CursorPaginationMeta {
  cursor?: string;
  nextCursor?: string;
  hasMore: boolean;
  count: number;
}

export interface CursorPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: CursorPaginationMeta;
  error?: ApiError;
}

// Status enums
export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum ServiceOrderStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD',
}

export enum ChargeStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIAL = 'PARTIAL',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CASH = 'CASH',
  CHECK = 'CHECK',
}

// Status labels em pt-BR
export const statusLabels: Record<string, string> = {
  [CustomerStatus.ACTIVE]: 'Ativo',
  [CustomerStatus.INACTIVE]: 'Inativo',
  [CustomerStatus.SUSPENDED]: 'Suspenso',
  [CustomerStatus.ARCHIVED]: 'Arquivado',
  
  [AppointmentStatus.SCHEDULED]: 'Agendado',
  [AppointmentStatus.CONFIRMED]: 'Confirmado',
  [AppointmentStatus.IN_PROGRESS]: 'Em Andamento',
  [AppointmentStatus.COMPLETED]: 'Concluído',
  [AppointmentStatus.CANCELLED]: 'Cancelado',
  [AppointmentStatus.NO_SHOW]: 'Não Compareceu',
  
  [ServiceOrderStatus.OPEN]: 'Aberto',
  [ServiceOrderStatus.IN_PROGRESS]: 'Em Andamento',
  [ServiceOrderStatus.COMPLETED]: 'Concluído',
  [ServiceOrderStatus.CANCELLED]: 'Cancelado',
  [ServiceOrderStatus.ON_HOLD]: 'Em Espera',
  
  [ChargeStatus.PENDING]: 'Pendente',
  [ChargeStatus.PAID]: 'Pago',
  [ChargeStatus.OVERDUE]: 'Vencido',
  [ChargeStatus.CANCELLED]: 'Cancelado',
  [ChargeStatus.REFUNDED]: 'Reembolsado',
  [ChargeStatus.PARTIAL]: 'Parcial',
};

// Status colors
export const statusColors: Record<string, string> = {
  [CustomerStatus.ACTIVE]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [CustomerStatus.INACTIVE]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  [CustomerStatus.SUSPENDED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  [CustomerStatus.ARCHIVED]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  
  [AppointmentStatus.SCHEDULED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  [AppointmentStatus.CONFIRMED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [AppointmentStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  [AppointmentStatus.COMPLETED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [AppointmentStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  [AppointmentStatus.NO_SHOW]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  
  [ServiceOrderStatus.OPEN]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  [ServiceOrderStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  [ServiceOrderStatus.COMPLETED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [ServiceOrderStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  [ServiceOrderStatus.ON_HOLD]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  
  [ChargeStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  [ChargeStatus.PAID]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [ChargeStatus.OVERDUE]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  [ChargeStatus.CANCELLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  [ChargeStatus.REFUNDED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  [ChargeStatus.PARTIAL]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};
