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
export const appointmentSchema = z.object({
  customerId: z.string().min(1, 'Selecione um cliente'),
  serviceType: z.string().min(1, 'Selecione um tipo de serviço'),
  date: z.string().min(1, 'Selecione uma data'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
  duration: z.number().positive('Duração deve ser maior que 0'),
  notes: z.string().optional(),
  status: z
    .enum(['SCHEDULED', 'CONFIRMED', 'DONE', 'CANCELED', 'NO_SHOW'])
    .default('SCHEDULED'),
})

export type AppointmentFormData = z.infer<typeof appointmentSchema>

// Service Order validation
export const serviceOrderSchema = z.object({
  customerId: z.string().min(1, 'Selecione um cliente'),
  appointmentId: z.string().optional(),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  value: z.number().positive('Valor deve ser maior que 0'),
  status: z
    .enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELED'])
    .default('OPEN'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export type ServiceOrderFormData = z.infer<typeof serviceOrderSchema>

// Charge validation
export const chargeSchema = z.object({
  customerId: z.string().min(1, 'Selecione um cliente'),
  serviceOrderId: z.string().optional(),
  amount: z.number().positive('Valor deve ser maior que 0'),
  dueDate: z.string().min(1, 'Selecione uma data de vencimento'),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELED']).default('PENDING'),
  paymentMethod: z.enum(['PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER']).optional(),
  notes: z.string().optional(),
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
