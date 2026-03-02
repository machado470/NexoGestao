import { describe, it, expect, beforeEach } from "vitest";
import { ensureOrgAccess, ensureAdminAccess } from "./_core/security";
import { TRPCError } from "@trpc/server";
import { emailSchema, phoneSchema, validateCPF, validateCNPJ, sanitizeString } from "./_core/validation";
import { createRateLimiter, resetRateLimit } from "./_core/rateLimit";
import { recordAudit, getAuditLogs, detectSuspiciousActivity, cleanupOldLogs } from "./_core/audit";

describe("Security - Multi-Tenant Access Control", () => {
  it("deve permitir acesso quando orgId é igual", () => {
    const ctx = {
      user: { id: 1, organizationId: 1, role: "user" },
      req: { headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      res: {},
    } as any;

    expect(() => ensureOrgAccess(ctx, 1)).not.toThrow();
  });

  it("deve negar acesso quando orgId é diferente", () => {
    const ctx = {
      user: { id: 1, organizationId: 1, role: "user" },
      req: { headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      res: {},
    } as any;

    expect(() => ensureOrgAccess(ctx, 2)).toThrow(TRPCError);
  });

  it("deve negar acesso quando usuário não está autenticado", () => {
    const ctx = {
      user: null,
      req: { headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      res: {},
    } as any;

    expect(() => ensureOrgAccess(ctx, 1)).toThrow(TRPCError);
  });

  it("deve permitir acesso admin quando role é admin", () => {
    const ctx = {
      user: { id: 1, organizationId: 1, role: "admin" },
      req: { headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      res: {},
    } as any;

    expect(() => ensureAdminAccess(ctx)).not.toThrow();
  });

  it("deve negar acesso admin quando role é user", () => {
    const ctx = {
      user: { id: 1, organizationId: 1, role: "user" },
      req: { headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      res: {},
    } as any;

    expect(() => ensureAdminAccess(ctx)).toThrow(TRPCError);
  });
});

describe("Security - Input Validation", () => {
  it("deve validar email corretamente", () => {
    expect(() => emailSchema.parse("test@example.com")).not.toThrow();
    expect(() => emailSchema.parse("invalid-email")).toThrow();
    expect(() => emailSchema.parse("")).toThrow();
  });

  it("deve validar telefone brasileiro", () => {
    expect(() => phoneSchema.parse("11987654321")).not.toThrow();
    expect(() => phoneSchema.parse("1198765432")).not.toThrow();
    expect(() => phoneSchema.parse("invalid")).toThrow();
  });

  it("deve validar CPF", () => {
    expect(validateCPF("11144477735")).toBe(true);
    expect(validateCPF("11111111111")).toBe(false);
    expect(validateCPF("11144477736")).toBe(false);
  });

  it("deve validar CNPJ", () => {
    expect(validateCNPJ("11222333000181")).toBe(true);
    expect(validateCNPJ("11111111111111")).toBe(false);
  });
});

describe("Security - Sanitization", () => {
  it("deve remover tags HTML", () => {
    const input = "Hello <script>alert('xss')</script> World";
    const output = sanitizeString(input);

    expect(output).not.toContain("<");
    expect(output).not.toContain(">");
  });

  it("deve remover javascript: protocol", () => {
    const input = "javascript:alert('xss')";
    const output = sanitizeString(input);

    expect(output).not.toContain("javascript:");
  });

  it("deve remover event handlers", () => {
    const input = 'onclick="alert(\'xss\')"';
    const output = sanitizeString(input);

    expect(output).not.toContain("onclick");
  });

  it("deve limitar tamanho de string", () => {
    const input = "a".repeat(2000);
    const output = sanitizeString(input);

    expect(output.length).toBeLessThanOrEqual(1000);
  });
});

describe("Security - Rate Limiting", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("deve permitir requisições dentro do limite", () => {
    const limiter = createRateLimiter({
      limit: 5,
      windowMs: 60000,
      keyGenerator: () => "test-user",
    });

    const ctx = { user: { id: 1 }, req: { headers: {}, socket: {} } };

    for (let i = 0; i < 5; i++) {
      const result = limiter(ctx);
      expect(result.allowed).toBe(true);
    }
  });

  it("deve bloquear requisições acima do limite", () => {
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 60000,
      keyGenerator: () => "test-user-2",
    });

    const ctx = { user: { id: 2 }, req: { headers: {}, socket: {} } };

    limiter(ctx);
    limiter(ctx);

    expect(() => limiter(ctx)).toThrow();
  });
});

describe("Security - Audit Logging", () => {
  beforeEach(() => {
    cleanupOldLogs(0);
  });

  it("deve registrar ações de auditoria", async () => {
    const ctx = {
      user: { id: 1, organizationId: 1 },
      req: { headers: { "x-forwarded-for": "127.0.0.1" }, socket: {} },
    } as any;

    const log = await recordAudit(ctx, "CREATE", "CUSTOMER", 123, {
      entityName: "John Doe",
      status: "SUCCESS",
    });

    expect(log).toBeDefined();
    expect(log.action).toBe("CREATE");
    expect(log.entity).toBe("CUSTOMER");
    expect(log.entityId).toBe(123);
    expect(log.status).toBe("SUCCESS");

    const logs = await getAuditLogs({ organizationId: 1 });
    expect(logs.length).toBeGreaterThan(0);
  });

  it("deve detectar atividades suspeitas", async () => {
    const ctx = {
      user: { id: 1, organizationId: 1 },
      req: { headers: { "x-forwarded-for": "127.0.0.1" }, socket: {} },
    } as any;

    for (let i = 0; i < 15; i++) {
      await recordAudit(ctx, "DELETE", "CUSTOMER", i, {
        status: "SUCCESS",
      });
    }

    const alerts = await detectSuspiciousActivity(1);
    expect(alerts.length).toBeGreaterThan(0);
  });
});
