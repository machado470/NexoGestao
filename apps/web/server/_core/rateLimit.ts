import { TRPCError } from "@trpc/server";

/**
 * Rate limiter em memória (para produção, usar Redis)
 * Estrutura: { key: { count, resetAt } }
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Limpa entradas expiradas periodicamente
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Limpa a cada minuto

export interface RateLimitConfig {
  limit: number; // Número máximo de requisições
  windowMs: number; // Janela de tempo em ms
  keyGenerator?: (context: any) => string; // Função para gerar chave
}

/**
 * Middleware de rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (context: any) => {
    const key = config.keyGenerator ? config.keyGenerator(context) : `${context.user?.id || "anonymous"}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Nova janela ou expirou
      rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
      return { allowed: true, remaining: config.limit - 1 };
    }

    if (entry.count >= config.limit) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit excedido (${config.limit} requisições por ${config.windowMs / 1000}s). Tente novamente em ${resetIn}s.`,
      });
    }

    entry.count++;
    return { allowed: true, remaining: config.limit - entry.count };
  };
}

/**
 * Configurações padrão de rate limiting
 */
export const RATE_LIMIT_CONFIGS = {
  // Geral: 1000 requisições por minuto
  DEFAULT: {
    limit: 1000,
    windowMs: 60000,
  },

  // Operações de escrita: 100 por minuto
  MUTATION: {
    limit: 100,
    windowMs: 60000,
  },

  // Login: 5 tentativas por 15 minutos
  LOGIN: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  },

  // Operações pesadas: 10 por hora
  HEAVY: {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  },

  // API pública: 100 por hora
  PUBLIC: {
    limit: 100,
    windowMs: 60 * 60 * 1000,
  },
};

/**
 * Middleware para aplicar rate limiting por organização
 */
export function createOrgRateLimiter(config: RateLimitConfig) {
  return (context: any) => {
    const orgId = context.user?.organizationId || "anonymous";
    const key = `org:${orgId}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
      return { allowed: true, remaining: config.limit - 1 };
    }

    if (entry.count >= config.limit) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Limite de requisições da organização excedido. Tente novamente em ${resetIn}s.`,
      });
    }

    entry.count++;
    return { allowed: true, remaining: config.limit - entry.count };
  };
}

/**
 * Middleware para aplicar rate limiting por IP
 */
export function createIpRateLimiter(config: RateLimitConfig) {
  return (context: any) => {
    const ip = context.req?.headers["x-forwarded-for"] || context.req?.socket?.remoteAddress || "unknown";
    const key = `ip:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
      return { allowed: true, remaining: config.limit - 1 };
    }

    if (entry.count >= config.limit) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Muitas requisições deste IP. Tente novamente em ${resetIn}s.`,
      });
    }

    entry.count++;
    return { allowed: true, remaining: config.limit - entry.count };
  };
}

/**
 * Função para resetar rate limit (útil para testes)
 */
export function resetRateLimit(key?: string) {
  if (key) {
    rateLimitStore.delete(key);
  } else {
    rateLimitStore.clear();
  }
}

/**
 * Função para obter status do rate limit
 */
export function getRateLimitStatus(key: string) {
  const entry = rateLimitStore.get(key);
  if (!entry) {
    return { limited: false, remaining: null };
  }

  const now = Date.now();
  if (entry.resetAt < now) {
    rateLimitStore.delete(key);
    return { limited: false, remaining: null };
  }

  return {
    limited: true,
    remaining: entry.count,
    resetAt: new Date(entry.resetAt),
  };
}
