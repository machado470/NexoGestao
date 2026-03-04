// apps/web/server/_core/trpcResponse.ts
// Normaliza erros do TRPC pro teu contrato ApiResponse/ApiError.
// Importante: mapping é PARTIAL e tem fallback (senão o TS exige TODAS as chaves do enum).

import { ErrorCode } from "@shared/types/api";

type HttpStatus =
  | 200
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 409
  | 429
  | 500
  | 503;

const HTTP_FALLBACK: HttpStatus = 400;

// Mapeia ErrorCode -> HTTP status (parcial, com fallback)
const httpStatusByCode: Partial<Record<ErrorCode, HttpStatus>> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,

  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,

  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  [ErrorCode.NOT_FOUND]: 404,

  [ErrorCode.OPERATION_NOT_ALLOWED]: 405,

  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.ALREADY_EXISTS]: 409,

  [ErrorCode.INSUFFICIENT_BALANCE]: 402,

  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,

  [ErrorCode.SERVICE_UNAVAILABLE]: 503,

  [ErrorCode.INTERNAL_ERROR]: 500
};

// Mapeia ErrorCode -> “categoria” (parcial, com fallback)
const errorCategoryByCode: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.BAD_REQUEST]: "BAD_REQUEST",
  [ErrorCode.VALIDATION_ERROR]: "BAD_REQUEST",

  [ErrorCode.UNAUTHORIZED]: "UNAUTHORIZED",
  [ErrorCode.INVALID_TOKEN]: "UNAUTHORIZED",
  [ErrorCode.TOKEN_EXPIRED]: "UNAUTHORIZED",

  [ErrorCode.FORBIDDEN]: "FORBIDDEN",
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: "FORBIDDEN",

  [ErrorCode.NOT_FOUND]: "NOT_FOUND",

  [ErrorCode.CONFLICT]: "CONFLICT",
  [ErrorCode.ALREADY_EXISTS]: "CONFLICT",

  [ErrorCode.SERVICE_UNAVAILABLE]: "SERVICE_UNAVAILABLE",

  [ErrorCode.RATE_LIMIT_EXCEEDED]: "TOO_MANY_REQUESTS",

  [ErrorCode.INTERNAL_ERROR]: "INTERNAL_ERROR"
};

export function getHttpStatusFromErrorCode(code?: ErrorCode): HttpStatus {
  if (!code) return HTTP_FALLBACK;
  return httpStatusByCode[code] ?? HTTP_FALLBACK;
}

export function getErrorCategoryFromErrorCode(code?: ErrorCode): string {
  if (!code) return "BAD_REQUEST";
  return errorCategoryByCode[code] ?? "BAD_REQUEST";
}
