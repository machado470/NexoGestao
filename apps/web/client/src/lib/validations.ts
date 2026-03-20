import { z } from "zod";

// Customer validation
export const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().min(10, "Telefone inválido"),
  notes: z.string().trim().optional(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// Appointment validation
export const appointmentSchema = z
  .object({
    customerId: z.string().trim().min(1, "Selecione um cliente"),
    startsAt: z.string().trim().min(1, "Selecione a data/hora de início"),
    endsAt: z.string().trim().optional().or(z.literal("")),
    status: z
      .enum(["SCHEDULED", "CONFIRMED", "DONE", "CANCELED", "NO_SHOW"])
      .default("SCHEDULED"),
    notes: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (!data.endsAt) return true;
      return new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime();
    },
    {
      message: "Data/hora final deve ser maior que a inicial",
      path: ["endsAt"],
    }
  );

export type AppointmentFormData = z.infer<typeof appointmentSchema>;

// Service Order validation
export const serviceOrderSchema = z.object({
  customerId: z.string().trim().min(1, "Selecione um cliente"),
  assignedToPersonId: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().min(2, "Título deve ter pelo menos 2 caracteres"),
  description: z.string().trim().optional(),
  priority: z.number().int().min(1).max(5).default(2),
  scheduledFor: z.string().trim().optional().or(z.literal("")),
  amountCents: z.number().int().positive("Valor deve ser maior que 0").optional(),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export type ServiceOrderFormData = z.infer<typeof serviceOrderSchema>;

// Service Order edit validation
export const serviceOrderEditSchema = z
  .object({
    title: z.string().trim().min(2, "Título deve ter pelo menos 2 caracteres"),
    description: z.string().trim().optional(),
    priority: z.number().int().min(1).max(5).default(2),
    scheduledFor: z.string().trim().optional().or(z.literal("")),
    status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]),
    assignedToPersonId: z.string().trim().nullable().optional().or(z.literal("")),
    amountCents: z.number().int().positive("Valor deve ser maior que 0").optional(),
    dueDate: z.string().trim().optional().or(z.literal("")),
    cancellationReason: z.string().trim().max(400, "Motivo deve ter no máximo 400 caracteres").optional().or(z.literal("")),
    outcomeSummary: z.string().trim().max(4000, "Resumo deve ter no máximo 4000 caracteres").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.status === "CANCELED" && !data.cancellationReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o motivo do cancelamento",
        path: ["cancellationReason"],
      });
    }

    if (data.status === "DONE" && !data.outcomeSummary?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o resumo da execução concluída",
        path: ["outcomeSummary"],
      });
    }

    if (data.status !== "CANCELED" && data.cancellationReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Motivo de cancelamento só pode ser usado em O.S. cancelada",
        path: ["cancellationReason"],
      });
    }

    if (data.status !== "DONE" && data.outcomeSummary?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Resumo final só pode ser usado em O.S. concluída",
        path: ["outcomeSummary"],
      });
    }

    if (
      (data.status === "ASSIGNED" || data.status === "IN_PROGRESS") &&
      !data.assignedToPersonId?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Defina um responsável antes de usar esse status",
        path: ["assignedToPersonId"],
      });
    }
  });

export type ServiceOrderEditFormData = z.infer<typeof serviceOrderEditSchema>;

// Charge validation
export const chargeSchema = z.object({
  customerId: z.string().trim().min(1, "Selecione um cliente"),
  serviceOrderId: z.string().trim().optional().or(z.literal("")),
  amountCents: z.number().int().positive("Valor deve ser maior que 0"),
  dueDate: z.string().trim().min(1, "Selecione uma data de vencimento"),
  notes: z.string().trim().optional(),
  paymentMethod: z.enum(["PIX", "CASH", "CARD", "TRANSFER", "OTHER"]).optional(),
});

export type ChargeFormData = z.infer<typeof chargeSchema>;

// Charge edit validation
export const chargeEditSchema = z.object({
  amountCents: z.number().int().positive("Valor deve ser maior que 0"),
  dueDate: z.string().trim().min(1, "Selecione uma data de vencimento"),
  status: z.enum(["PENDING", "CANCELED"]).default("PENDING"),
  notes: z.string().trim().optional(),
});

export type ChargeEditFormData = z.infer<typeof chargeEditSchema>;

// Person validation
export const personSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]).default("STAFF"),
  active: z.boolean().default(true),
});

export type PersonFormData = z.infer<typeof personSchema>;

// Login validation
export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Register validation
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().trim().email("Email inválido"),
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string(),
    organizationName: z
      .string()
      .trim()
      .min(2, "Nome da organização deve ter pelo menos 2 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;
