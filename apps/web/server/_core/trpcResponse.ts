import { TRPCError } from '@trpc/server';
import { ApiErrorException, ApiErrors } from './apiResponse';
import { ErrorCode } from '@shared/types/api';

/**
 * Converte exceções de aplicação para TRPCError padronizado
 */
export function handleApiError(error: unknown): never {
  if (error instanceof ApiErrorException) {
    const statusCode = mapErrorCodeToHttpStatus(error.code);
    throw new TRPCError({
      code: mapErrorCodeToTRPCCode(error.code),
      message: error.message,
      cause: error.details,
    });
  }

  if (error instanceof TRPCError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor',
      cause: error,
    });
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Erro desconhecido',
  });
}

/**
 * Mapeia ErrorCode para código HTTP
 */
function mapErrorCodeToHttpStatus(code: ErrorCode): number {
  const mapping: Record<ErrorCode, number> = {
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.INVALID_TOKEN]: 401,
    [ErrorCode.TOKEN_EXPIRED]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.INVALID_INPUT]: 400,
    [ErrorCode.MISSING_FIELD]: 400,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.ALREADY_EXISTS]: 409,
    [ErrorCode.CONFLICT]: 409,
    [ErrorCode.INSUFFICIENT_BALANCE]: 402,
    [ErrorCode.INVALID_STATUS]: 400,
    [ErrorCode.OPERATION_NOT_ALLOWED]: 405,
    [ErrorCode.INTERNAL_ERROR]: 500,
    [ErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  };

  return mapping[code] || 500;
}

/**
 * Mapeia ErrorCode para código tRPC
 */
function mapErrorCodeToTRPCCode(code: ErrorCode): 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'PRECONDITION_FAILED' | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'UNPROCESSABLE_CONTENT' | 'TOO_MANY_REQUESTS' | 'CLIENT_CLOSED_REQUEST' | 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR' | 'NOT_IMPLEMENTED' | 'BAD_GATEWAY' | 'SERVICE_UNAVAILABLE' | 'GATEWAY_TIMEOUT' | 'PARSE_ERROR' {
  const mapping: Record<ErrorCode, any> = {
    [ErrorCode.UNAUTHORIZED]: 'UNAUTHORIZED',
    [ErrorCode.INVALID_TOKEN]: 'UNAUTHORIZED',
    [ErrorCode.TOKEN_EXPIRED]: 'UNAUTHORIZED',
    [ErrorCode.FORBIDDEN]: 'FORBIDDEN',
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'FORBIDDEN',
    [ErrorCode.VALIDATION_ERROR]: 'BAD_REQUEST',
    [ErrorCode.INVALID_INPUT]: 'BAD_REQUEST',
    [ErrorCode.MISSING_FIELD]: 'BAD_REQUEST',
    [ErrorCode.NOT_FOUND]: 'NOT_FOUND',
    [ErrorCode.ALREADY_EXISTS]: 'CONFLICT',
    [ErrorCode.CONFLICT]: 'CONFLICT',
    [ErrorCode.INSUFFICIENT_BALANCE]: 'PRECONDITION_FAILED',
    [ErrorCode.INVALID_STATUS]: 'BAD_REQUEST',
    [ErrorCode.OPERATION_NOT_ALLOWED]: 'UNSUPPORTED_MEDIA_TYPE',
    [ErrorCode.INTERNAL_ERROR]: 'INTERNAL_SERVER_ERROR',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'TOO_MANY_REQUESTS',
  };

  return mapping[code] || 'INTERNAL_SERVER_ERROR';
}

/**
 * Wrapper para procedures que converte erros automaticamente
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleApiError(error);
  }
}
