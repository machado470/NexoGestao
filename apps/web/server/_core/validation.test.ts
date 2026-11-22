import { describe, it, expect } from "vitest";
import { emailSchema, phoneSchema, validateCPF, validateCNPJ, sanitizeString } from "./validation";

// Moved unchanged from server/security.test.ts (C8 PR1), which also covered legacy IP modules
// that were removed. These cases keep the coverage of ./validation.

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
