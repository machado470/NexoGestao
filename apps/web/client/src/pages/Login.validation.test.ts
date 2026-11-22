import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { LOGIN_VALIDATION_MESSAGES as M, validateLoginInput } from "./Login.validation";

// The login form is noValidate (iOS in-app browsers can block native validation silently), so
// every invalid input must produce a visible message here, and valid input must match the BFF.
describe("login form validation", () => {
  it.each([
    ["", "senha-ficticia", "email", M.emailRequired],
    ["   ", "senha-ficticia", "email", M.emailRequired],
    ["teste exemplo.test", "senha-ficticia", "email", M.emailInvalid],
    ["teste@", "senha-ficticia", "email", M.emailInvalid],
    ["teste@exemplo", "senha-ficticia", "email", M.emailInvalid],
    ["teste@exemplo.test", "", "password", M.passwordRequired],
    ["teste@exemplo.test", "12345", "password", M.passwordTooShort],
    ["", "", "email", M.emailRequired],
  ])("%j / %j → %s", (email, password, field, message) => {
    expect(validateLoginInput(email, password)).toEqual({ field, message });
  });

  it("accepts valid input, normalizing case and surrounding spaces of the e-mail", () => {
    expect(validateLoginInput("  Teste@Exemplo.TEST ", "senha-ficticia")).toBeNull();
    expect(validateLoginInput("teste@exemplo.test", "123456")).toBeNull();
  });

  it("accepts exactly what the BFF auth.login input schema accepts", () => {
    const bff = z.object({ email: z.string().email(), password: z.string().min(6) });
    const samples: Array<[string, string]> = [
      ["teste@exemplo.test", "senha-ficticia"], ["a@b.co", "123456"], ["teste@exemplo", "123456"],
      ["teste@@exemplo.test", "123456"], ["teste@exemplo.test", "12345"], ["", "123456"],
    ];
    for (const [email, password] of samples) {
      expect(validateLoginInput(email, password) === null).toBe(bff.safeParse({ email, password }).success);
    }
  });

  it("the form disables native validation and announces errors", () => {
    const page = readFileSync(resolve(__dirname, "Login.tsx"), "utf8");
    expect(page).toContain("<form onSubmit={submit} noValidate");
    expect(page).toContain("validateLoginInput(email, password)");
    expect(page).toMatch(/id="login-error"\s+role="alert"/);
    expect(page).toContain('aria-invalid={invalidField === "email" || undefined}');
  });
});
