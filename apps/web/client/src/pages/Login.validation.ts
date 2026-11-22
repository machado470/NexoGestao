import { z } from "zod";

/**
 * Client-side validation of the login form.
 *
 * The form uses `noValidate`, so this is the only validation before submit. It mirrors the BFF
 * input schema of `auth.login` (`z.string().email()` and a password of at least 6 characters),
 * so whatever passes here is accepted by the BFF and every rejection has a readable message.
 * Native browser validation is not used because some iOS in-app browsers block the submit
 * without showing any message.
 */
export const LOGIN_PASSWORD_MIN_LENGTH = 6;

const emailSchema = z.string().email();

export type LoginField = "email" | "password";
export type LoginValidationError = { field: LoginField; message: string };

export const LOGIN_VALIDATION_MESSAGES = {
  emailRequired: "Informe seu e-mail.",
  emailInvalid: "Informe um e-mail válido, como voce@empresa.com.",
  passwordRequired: "Informe sua senha.",
  passwordTooShort: `A senha deve ter pelo menos ${LOGIN_PASSWORD_MIN_LENGTH} caracteres.`,
} as const;

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns the first problem in field order (e-mail, then password), or null when valid. */
export function validateLoginInput(email: string, password: string): LoginValidationError | null {
  const normalizedEmail = normalizeLoginEmail(email);
  if (!normalizedEmail) return { field: "email", message: LOGIN_VALIDATION_MESSAGES.emailRequired };
  if (!emailSchema.safeParse(normalizedEmail).success) {
    return { field: "email", message: LOGIN_VALIDATION_MESSAGES.emailInvalid };
  }
  if (!password) return { field: "password", message: LOGIN_VALIDATION_MESSAGES.passwordRequired };
  if (password.length < LOGIN_PASSWORD_MIN_LENGTH) {
    return { field: "password", message: LOGIN_VALIDATION_MESSAGES.passwordTooShort };
  }
  return null;
}
