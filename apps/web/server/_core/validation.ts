import { z } from "zod";

/**
 * Schemas de validação reutilizáveis
 */

export const emailSchema = z
  .string()
  .email("Email inválido")
  .toLowerCase()
  .trim();

export const phoneSchema = z
  .string()
  .regex(/^(\+55)?(\d{2})?9?\d{8,9}$/, "Telefone inválido")
  .transform((val) => val.replace(/\D/g, ""));

export const cpfSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido")
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => validateCPF(val), "CPF inválido");

export const cnpjSchema = z
  .string()
  .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido")
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => validateCNPJ(val), "CNPJ inválido");

export const dateSchema = z
  .string()
  .datetime()
  .transform((val) => new Date(val));

export const currencySchema = z
  .number()
  .positive("Valor deve ser positivo")
  .transform((val) => Math.round(val * 100)); // Converte para centavos

export const percentSchema = z
  .number()
  .min(0, "Percentual não pode ser negativo")
  .max(100, "Percentual não pode ser maior que 100");

/**
 * Validadores customizados
 */

export function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, "");

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // Todos os dígitos iguais

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, "");

  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // Todos os dígitos iguais

  let size = cnpj.length - 2;
  let numbers = cnpj.substring(0, size);
  let digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Schemas de entidades comuns
 */

export const customerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  email: emailSchema,
  phone: phoneSchema.optional(),
  cpf: cpfSchema.optional(),
  cnpj: cnpjSchema.optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido").optional(),
  notes: z.string().max(1000).optional(),
});

export const appointmentSchema = z.object({
  customerId: z.number().positive(),
  serviceType: z.string().min(1, "Tipo de serviço é obrigatório"),
  startTime: z.date(),
  endTime: z.date(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]),
  notes: z.string().max(1000).optional(),
  remindBefore: z.number().min(0).optional(), // Minutos antes do agendamento
});

export const serviceOrderSchema = z.object({
  customerId: z.number().positive(),
  description: z.string().min(1, "Descrição é obrigatória"),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.date().optional(),
  assignedTo: z.number().optional(),
  notes: z.string().max(1000).optional(),
});

export const financeSchema = z.object({
  customerId: z.number().positive(),
  amount: currencySchema,
  type: z.enum(["INVOICE", "PAYMENT", "CREDIT", "REFUND"]),
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]),
  dueDate: z.date(),
  description: z.string().min(1, "Descrição é obrigatória"),
  notes: z.string().max(1000).optional(),
});

/**
 * Sanitiza strings para prevenir XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove < e >
    .replace(/javascript:/gi, "") // Remove javascript:
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim()
    .substring(0, 1000); // Limita a 1000 caracteres
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj !== null && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Valida tamanho de arquivo
 */
export function validateFileSize(
  sizeInBytes: number,
  maxSizeInMB: number = 10
): boolean {
  return sizeInBytes <= maxSizeInMB * 1024 * 1024;
}

/**
 * Valida tipo de arquivo
 */
export function validateFileType(
  mimeType: string,
  allowedTypes: string[] = ["image/jpeg", "image/png", "application/pdf"]
): boolean {
  return allowedTypes.includes(mimeType);
}

/**
 * Gera slug a partir de string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove caracteres especiais
    .replace(/\s+/g, "-") // Substitui espaços por hífen
    .replace(/-+/g, "-"); // Remove hífens duplicados
}

/**
 * Formata valores monetários
 */
export function formatCurrency(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Formata datas
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR");
}
