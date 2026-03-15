import { z } from 'zod'

// Customer validation
export const customerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  phone: z.string().min(10, 'Telefone inválido'),
  notes: z.string().optional(),
})

export type CustomerFormData = z.infer<typeof customerSchema>

// Appointment validation
export const appointmentSchema = z
  .object({
    customerId: z.string().min(1, 'Selecione um cliente'),
    startsAt: z.string().min(1, 'Selecione a data/hora de início'),
    endsAt: z.string().optional().or(z.literal('')),
    status: z
      .enum(['SCHEDULED', 'CONFIRMED', 'DONE', 'CANCELED', 'NO_SHOW'])
      .default('SCHEDULED'),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.endsAt) return true
      return new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime()
    },
    {
      message: 'Data/hora final deve ser maior que a inicial',
      path: ['endsAt'],
    },
  )

export type AppointmentFormData = z.infer<typeof appointmentSchema>

// Service Order validation
export const serviceOrderSchema = z.object({
  customerId: z.string().min(1, 'Selecione um cliente'),
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(5).default(2),
  scheduledFor: z.string().optional().or(z.literal('')),
  amount: z.number().positive('Valor deve ser maior que 0').optional(),
  dueDate: z.string().optional().or(z.literal('')),
})

export type ServiceOrderFormData = z.infer<typeof serviceOrderSchema>

// Charge validation
export const chargeSchema = z.object({
  customerId: z.string().min(1, 'Selecione um cliente'),
  serviceOrderId: z.string().optional(),
  amount: z.number().positive('Valor deve ser maior que 0'),
  dueDate: z.string().min(1, 'Selecione uma data de vencimento'),
  notes: z.string().optional(),
  paymentMethod: z.enum(['PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER']).optional(),
})

export type ChargeFormData = z.infer<typeof chargeSchema>

// Person validation
export const personSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER']).default('STAFF'),
  active: z.boolean().default(true),
})

export type PersonFormData = z.infer<typeof personSchema>

// Login validation
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export type LoginFormData = z.infer<typeof loginSchema>

// Register validation
export const registerSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string(),
    organizationName: z
      .string()
      .min(2, 'Nome da organização deve ter pelo menos 2 caracteres'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
