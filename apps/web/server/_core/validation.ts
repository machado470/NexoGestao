import { z } from "zod";

export const emailSchema = z.string().email();
export const phoneSchema = z.string().min(10).max(11).regex(/^\d+$/);

export function validateCPF(cpf: string): boolean {
  const numbers = (cpf || "").replace(/\D/g, "");
  if (numbers.length !== 11) return false;
  
  // Elimina CPFs conhecidos inválidos
  if (/^(\d)\1{10}$/.test(numbers)) return false;

  const calc = (size: number) => {
    let sum = 0;
    for (let i = 1; i <= size; i++) {
      sum = sum + parseInt(numbers.substring(i - 1, i)) * (size + 2 - i);
    }
    let rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    return rest;
  };

  const d1 = calc(9);
  if (d1 !== parseInt(numbers.substring(9, 10))) return false;

  const d2 = calc(10);
  if (d2 !== parseInt(numbers.substring(10, 11))) return false;

  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  const numbers = (cnpj || "").replace(/\D/g, "");
  if (numbers.length !== 14) return false;

  // Elimina CNPJs conhecidos inválidos
  if (/^(\d)\1{13}$/.test(numbers)) return false;

  const calc = (size: number) => {
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(12);
  if (d1 !== parseInt(numbers.charAt(12))) return false;

  const d2 = calc(13);
  if (d2 !== parseInt(numbers.charAt(13))) return false;

  return true;
}

export function sanitizeString(str: string): string {
  if (!str) return "";
  
  let sanitized = str
    .replace(/<[^>]*>?/gm, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+="[^"]*"/gi, "") // Remove event handlers like onclick="..."
    .replace(/on\w+='[^']*'/gi, "") // Remove event handlers like onclick='...'
    .trim();

  // Limit length to 1000 characters as per test requirement
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }

  return sanitized;
}
