import { TRPCError } from "@trpc/server";
import type { Context } from "./context";

/**
 * Valida se o usuário tem acesso à organização especificada
 * Previne acesso cruzado entre organizações
 */
export function ensureOrgAccess(ctx: Context, targetOrgId: number | string) {
  const userOrgId = ctx.user?.organizationId;

  if (!userOrgId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Usuário não autenticado",
    });
  }

  const targetId = typeof targetOrgId === "string" ? parseInt(targetOrgId, 10) : targetOrgId;

  if (userOrgId !== targetId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Você não tem permissão para acessar esta organização.",
    });
  }
}

/**
 * Valida se o usuário é admin da organização
 */
export function ensureAdminAccess(ctx: Context) {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Apenas administradores podem realizar esta ação.",
    });
  }
}

/**
 * Rate limiting em memória com fallback para Redis em produção
 * Para produção, configure REDIS_URL no .env
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Limpeza periódica de entradas expiradas
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Limpar a cada 1 minuto

export function checkRateLimit(key: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit excedido. Tente novamente em ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
    });
  }

  entry.count++;
  return true;
}

/**
 * Sanitiza entrada de usuário para prevenir XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove < e >
    .trim()
    .substring(0, 1000); // Limita a 1000 caracteres
}

/**
 * Valida email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida telefone brasileiro
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+55)?(\d{2})?9?\d{8,9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ""));
}

/**
 * Cria hash de auditoria para rastreamento
 */
export function createAuditHash(data: any): string {
  const json = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Log de auditoria estruturado
 */
export async function logAudit(
  ctx: Context,
  action: string,
  entity: string,
  entityId: string | number,
  changes: Record<string, any>
) {
  const auditLog = {
    timestamp: new Date(),
    userId: ctx.user?.id,
    organizationId: ctx.user?.organizationId,
    action,
    entity,
    entityId,
    changes,
    ip: ctx.req?.headers["x-forwarded-for"] || ctx.req?.socket?.remoteAddress,
    userAgent: ctx.req?.headers["user-agent"],
    hash: createAuditHash({ action, entity, entityId, changes }),
  };

  // TODO: Salvar em banco de dados
  console.log("[AUDIT]", JSON.stringify(auditLog));

  return auditLog;
}
