import { ApiError, ApiResponse, ErrorCode, PaginatedResponse, PaginationMeta } from '@shared/types/api';

/**
 * Wrapper para respostas de API padronizadas
 */

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, any>
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const pages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Classe para erros de API com código estruturado
 */
export class ApiErrorException extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiErrorException';
  }
}

/**
 * Helpers para erros comuns
 */
export const ApiErrors = {
  unauthorized: () =>
    new ApiErrorException(ErrorCode.UNAUTHORIZED, 'Não autenticado'),
  
  forbidden: () =>
    new ApiErrorException(ErrorCode.FORBIDDEN, 'Acesso negado'),
  
  notFound: (resource: string) =>
    new ApiErrorException(ErrorCode.NOT_FOUND, `${resource} não encontrado`),
  
  alreadyExists: (resource: string) =>
    new ApiErrorException(ErrorCode.ALREADY_EXISTS, `${resource} já existe`),
  
  validationError: (details: Record<string, any>) =>
    new ApiErrorException(ErrorCode.VALIDATION_ERROR, 'Erro de validação', details),
  
  insufficientPermissions: () =>
    new ApiErrorException(
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      'Permissões insuficientes'
    ),
  
  rateLimitExceeded: () =>
    new ApiErrorException(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Limite de requisições excedido. Tente novamente mais tarde.'
    ),
  
  internalError: (details?: Record<string, any>) =>
    new ApiErrorException(ErrorCode.INTERNAL_ERROR, 'Erro interno do servidor', details),
};
