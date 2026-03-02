import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  organizationId: int("organizationId").notNull().default(1), // Default organization
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here
// Organizations table
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  adminName: varchar("adminName", { length: 255 }).notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// Accounts table (para rastrear contas criadas)
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId"),
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

// Customers table
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  street: varchar("street", { length: 255 }),
  number: varchar("number", { length: 20 }),
  complement: varchar("complement", { length: 255 }),
  zipCode: varchar("zipCode", { length: 10 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  country: varchar("country", { length: 100 }).default("Brasil"),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  notes: text("notes"),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// Appointments table
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  status: mysqlEnum("status", ["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).default("SCHEDULED").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

// Service Orders table
export const serviceOrders = mysqlTable("serviceOrders", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }), // Valor estimado da ordem de serviço
  priority: mysqlEnum("priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM").notNull(),
  status: mysqlEnum("status", ["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]).default("OPEN").notNull(),
  assignedTo: varchar("assignedTo", { length: 255 }),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  notes: text("notes"),
  chargeId: int("chargeId"), // Referência à cobrança criada automaticamente
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

// Charges table (Cobranças)
export const charges = mysqlTable("charges", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: int("amount").notNull(), // Valor em centavos (ex: 10000 = R$ 100,00)
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  status: mysqlEnum("status", ["PENDING", "PAID", "OVERDUE", "CANCELED"]).default("PENDING").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Charge = typeof charges.$inferSelect;
export type InsertCharge = typeof charges.$inferInsert;

// People table (Pessoas/Colaboradores)
export const people = mysqlTable("people", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  role: mysqlEnum("role", ["admin", "manager", "collaborator", "viewer"]).default("collaborator").notNull(),
  department: varchar("department", { length: 255 }),
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof people.$inferInsert;

// Governance table (Governança)
export const governance = mysqlTable("governance", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId"),
  appointmentId: int("appointmentId"),
  serviceOrderId: int("serviceOrderId"),
  chargeId: int("chargeId"),
  riskScore: int("riskScore").default(0).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"]).default("low").notNull(),
  complianceStatus: mysqlEnum("complianceStatus", ["compliant", "warning", "non_compliant"]).default("compliant").notNull(),
  issues: text("issues"),
  recommendations: text("recommendations"),
  lastEvaluated: timestamp("lastEvaluated").defaultNow().notNull(),
  evaluatedBy: varchar("evaluatedBy", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Governance = typeof governance.$inferSelect;
export type InsertGovernance = typeof governance.$inferInsert;

// Contact History table (Rastreamento de Contatos)
export const contactHistory = mysqlTable("contactHistory", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  contactType: mysqlEnum("contactType", ["phone", "email", "whatsapp", "in_person", "other"]).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  contactedBy: varchar("contactedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactHistory = typeof contactHistory.$inferSelect;
export type InsertContactHistory = typeof contactHistory.$inferInsert;

// WhatsApp Messages table (Mensagens WhatsApp)
export const whatsappMessages = mysqlTable("whatsappMessages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  messageId: varchar("messageId", { length: 255 }).unique(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "read", "failed"]).default("pending").notNull(),
  senderNumber: varchar("senderNumber", { length: 20 }),
  receiverNumber: varchar("receiverNumber", { length: 20 }),
  mediaUrl: text("mediaUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;


// Service Tracking table (Rastreamento de Serviços)
export const serviceTracking = mysqlTable("serviceTracking", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  collaboratorId: int("collaboratorId").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  status: mysqlEnum("status", ["started", "paused", "completed", "canceled"]).default("started").notNull(),
  hoursWorked: decimal("hoursWorked", { precision: 10, scale: 2 }),
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).notNull(), // Valor por hora em reais
  amountEarned: decimal("amountEarned", { precision: 10, scale: 2 }), // Valor total a receber
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceTracking = typeof serviceTracking.$inferSelect;
export type InsertServiceTracking = typeof serviceTracking.$inferInsert;

// Discounts table (Descontos em Rastreamento)
export const discounts = mysqlTable("discounts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  serviceTrackingId: int("serviceTrackingId").notNull(),
  reason: varchar("reason", { length: 255 }).notNull(), // Motivo do desconto
  amount: decimal("amount", { precision: 10, scale: 2 }), // Valor do desconto em reais
  percentage: decimal("percentage", { precision: 5, scale: 2 }), // Percentual do desconto
  approvedBy: int("approvedBy"), // ID da pessoa que aprovou o desconto
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Discount = typeof discounts.$inferSelect;
export type InsertDiscount = typeof discounts.$inferInsert;

// Launches table (Lançamentos - Receitas e Despesas)
export const launches = mysqlTable("launches", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  chargeId: int("chargeId"), // Referência a cobrança (se for receita)
  type: mysqlEnum("type", ["income", "expense"]).notNull(), // Tipo: receita ou despesa
  category: varchar("category", { length: 100 }).notNull(), // Categoria (ex: Salário, Aluguel, Venda)
  description: varchar("description", { length: 255 }).notNull(), // Descrição
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Valor em reais
  dueDate: timestamp("dueDate").notNull(), // Data de vencimento
  paidDate: timestamp("paidDate"), // Data de pagamento (null se não pago)
  status: mysqlEnum("status", ["pending", "paid", "overdue", "canceled"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // Método de pagamento (dinheiro, cartão, transferência, etc)
  notes: text("notes"), // Observações
  createdBy: int("createdBy"), // ID do usuário que criou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Launch = typeof launches.$inferSelect;
export type InsertLaunch = typeof launches.$inferInsert;

// Invoices table (Notas Fiscais)
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  chargeId: int("chargeId"), // Referência a cobrança
  customerId: int("customerId").notNull(), // Cliente
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  seriesNumber: varchar("seriesNumber", { length: 20 }),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  issueDate: timestamp("issueDate").notNull(),
  dueDate: timestamp("dueDate"),
  status: mysqlEnum("status", ["draft", "issued", "paid", "canceled"]).default("draft").notNull(),
  pdfUrl: text("pdfUrl"), // URL do PDF armazenado
  notes: text("notes"),
  createdBy: int("createdBy"), // Usuário que criou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// Expenses table (Despesas)
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // Categoria (Aluguel, Salário, etc)
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"), // Data de pagamento
  status: mysqlEnum("status", ["pending", "paid", "overdue", "canceled"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // Método de pagamento
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;


// Referrals table (Sistema de Referência)
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(), // Usuário que fez a referência
  referredId: int("referredId"), // Usuário referenciado (pode ser null se ainda não se cadastrou)
  referralCode: varchar("referralCode", { length: 50 }).notNull().unique(), // Código único de referência
  referralEmail: varchar("referralEmail", { length: 255 }), // Email da pessoa referenciada
  status: mysqlEnum("status", ["pending", "completed", "canceled"]).default("pending").notNull(),
  creditAmount: decimal("creditAmount", { precision: 10, scale: 2 }).default("0"), // Crédito ganho
  creditClaimed: boolean("creditClaimed").default(false), // Se o crédito foi utilizado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"), // Data de conclusão
});
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// Credits table (Créditos do sistema)
export const credits = mysqlTable("credits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  source: varchar("source", { length: 100 }).notNull(), // "referral", "promotion", "admin", etc
  sourceId: int("sourceId"), // ID da referência ou promoção
  description: text("description"),
  used: boolean("used").default(false),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt"), // Data de expiração
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Credit = typeof credits.$inferSelect;
export type InsertCredit = typeof credits.$inferInsert;

// Password Reset Tokens
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;


// ===== Plans (Planos) =====
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // "free", "pro", "enterprise"
  displayName: varchar("displayName", { length: 100 }).notNull(), // "Plano Gratuito", "Plano Pro", etc
  description: text("description"),
  priceMonthly: decimal("priceMonthly", { precision: 10, scale: 2 }).default("0"), // 0 for free
  priceYearly: decimal("priceYearly", { precision: 10, scale: 2 }),
  maxClients: int("maxClients").notNull(), // -1 for unlimited
  maxAppointments: int("maxAppointments").notNull(),
  maxServiceOrders: int("maxServiceOrders").notNull(),
  maxCharges: int("maxCharges").notNull(),
  maxPeople: int("maxPeople").notNull(),
  features: json("features").$type<string[]>().default(sql`json_array()`), // ["whatsapp", "invoices", "reports"]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

// ===== Subscriptions (Assinaturas) =====
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  planId: int("planId").notNull(),
  status: mysqlEnum("status", ["active", "canceled", "expired", "pending"]).default("active").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  autoRenew: boolean("autoRenew").default(true),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly"),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }), // Stripe subscription ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ===== Transactions (Transações) =====
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  subscriptionId: int("subscriptionId"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending"),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // "stripe", "mercado_pago", "credit"
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ===== Plan Usage Tracking =====
export const planUsage = mysqlTable("planUsage", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  clientsCount: int("clientsCount").default(0),
  appointmentsCount: int("appointmentsCount").default(0),
  serviceOrdersCount: int("serviceOrdersCount").default(0),
  chargesCount: int("chargesCount").default(0),
  peopleCount: int("peopleCount").default(0),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow(),
});
export type PlanUsage = typeof planUsage.$inferSelect;
export type InsertPlanUsage = typeof planUsage.$inferInsert;
