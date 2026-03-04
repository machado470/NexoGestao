import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Named export esperado pelos routers:
 *   import { db } from "../db";
 *
 * Observação: se DATABASE_URL não existir, vira null (mas não derruba o server no boot).
 * As rotas que usam `db.query.*` podem falhar quando forem chamadas — mas o server sobe.
 */
export const db = await (async () => {
  const instance = await getDb();
  if (!instance) {
    console.warn("[Database] db export is null (DATABASE_URL missing or failed).");
  }
  return instance as any;
})();

export default db;

// =============================================================================
// USERS (drizzle if available)
// =============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const d = await getDb();
  if (!d) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await d.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const d = await getDb();
  if (!d) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await d.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// =============================================================================
// DEV STORE HELPERS
// =============================================================================

function now() {
  return new Date();
}

function okDelete(existed: boolean, id: number) {
  return existed ? ({ ok: true, id } as const) : ({ ok: false, id } as const);
}

// =============================================================================
// CUSTOMERS (DEV MODE) — In-memory fallback
// =============================================================================

export type Customer = {
  id: number;
  organizationId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  active: number; // 1/0 (como você está usando nos routers)
  createdAt: Date;
  updatedAt: Date;
};

type CreateCustomerInput = Omit<Customer, "id" | "createdAt" | "updatedAt">;

let _customerSeq = 1;
const _customers = new Map<number, Customer>();

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const t = now();
  const id = _customerSeq++;
  const c: Customer = {
    id,
    createdAt: t,
    updatedAt: t,
    email: input.email ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    ...input,
  };
  _customers.set(id, c);
  return c;
}

export async function getCustomersByOrg(organizationId: number): Promise<Customer[]> {
  const list = Array.from(_customers.values()).filter((c) => c.organizationId === organizationId);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  return _customers.get(id) ?? null;
}

export async function updateCustomer(id: number, data: Partial<Customer>): Promise<Customer | null> {
  const current = _customers.get(id);
  if (!current) return null;
  const updated: Customer = { ...current, ...data, updatedAt: now() };
  _customers.set(id, updated);
  return updated;
}

export async function deleteCustomer(id: number) {
  return okDelete(_customers.delete(id), id);
}

// =============================================================================
// APPOINTMENTS (DEV MODE) — In-memory fallback
// =============================================================================

export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "CANCELED" | "DONE" | "NO_SHOW";

export type Appointment = {
  id: number;
  organizationId: number;
  customerId: number;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  status: AppointmentStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateAppointmentInput = Omit<Appointment, "id" | "createdAt" | "updatedAt">;

let _appointmentSeq = 1;
const _appointments = new Map<number, Appointment>();

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const t = now();
  const id = _appointmentSeq++;
  const a: Appointment = {
    id,
    createdAt: t,
    updatedAt: t,
    description: input.description ?? null,
    endsAt: input.endsAt ?? null,
    notes: input.notes ?? null,
    ...input,
  };
  _appointments.set(id, a);
  return a;
}

export async function getAppointmentsByOrg(organizationId: number): Promise<Appointment[]> {
  const list = Array.from(_appointments.values()).filter((a) => a.organizationId === organizationId);
  list.sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  return list;
}

export async function getAppointmentById(id: number): Promise<Appointment | null> {
  return _appointments.get(id) ?? null;
}

export async function updateAppointment(id: number, data: Partial<Appointment>): Promise<Appointment | null> {
  const current = _appointments.get(id);
  if (!current) return null;
  const updated: Appointment = { ...current, ...data, updatedAt: now() };
  _appointments.set(id, updated);
  return updated;
}

export async function deleteAppointment(id: number) {
  return okDelete(_appointments.delete(id), id);
}

// =============================================================================
// SERVICE ORDERS (DEV MODE) — In-memory fallback
// =============================================================================

export type ServiceOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ServiceOrderStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "DONE" | "CANCELED";

export type ServiceOrder = {
  id: number;
  organizationId: number;
  customerId: number;
  title: string;
  description?: string | null;
  priority: ServiceOrderPriority;
  status: ServiceOrderStatus;
  assignedTo?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateServiceOrderInput = Omit<ServiceOrder, "id" | "createdAt" | "updatedAt">;

let _soSeq = 1;
const _serviceOrders = new Map<number, ServiceOrder>();

export async function createServiceOrder(input: CreateServiceOrderInput): Promise<ServiceOrder> {
  const t = now();
  const id = _soSeq++;
  const s: ServiceOrder = {
    id,
    createdAt: t,
    updatedAt: t,
    description: input.description ?? null,
    assignedTo: input.assignedTo ?? null,
    notes: input.notes ?? null,
    ...input,
  };
  _serviceOrders.set(id, s);
  return s;
}

export async function getServiceOrdersByOrg(organizationId: number): Promise<ServiceOrder[]> {
  const list = Array.from(_serviceOrders.values()).filter((s) => s.organizationId === organizationId);
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return list;
}

export async function getServiceOrderById(id: number): Promise<ServiceOrder | null> {
  return _serviceOrders.get(id) ?? null;
}

export async function updateServiceOrder(id: number, data: Partial<ServiceOrder>): Promise<ServiceOrder | null> {
  const current = _serviceOrders.get(id);
  if (!current) return null;
  const updated: ServiceOrder = { ...current, ...data, updatedAt: now() };
  _serviceOrders.set(id, updated);
  return updated;
}

export async function deleteServiceOrder(id: number) {
  return okDelete(_serviceOrders.delete(id), id);
}

// =============================================================================
// FINANCE / CHARGES (DEV MODE) — In-memory fallback
// =============================================================================

type ChargeStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELED";

export type Charge = {
  id: number;
  organizationId: number;
  customerId: number;
  description: string;
  amount: number; // centavos
  dueDate: Date;
  paidDate?: Date | null;
  status: ChargeStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateChargeInput = Omit<Charge, "id" | "createdAt" | "updatedAt">;

let _chargeSeq = 1;
const _charges = new Map<number, Charge>();

export async function createCharge(input: CreateChargeInput): Promise<Charge> {
  const t = now();
  const id = _chargeSeq++;
  const c: Charge = {
    id,
    createdAt: t,
    updatedAt: t,
    paidDate: input.paidDate ?? null,
    notes: input.notes ?? null,
    ...input,
  };
  _charges.set(id, c);
  return c;
}

export async function getChargesByOrg(organizationId: number): Promise<Charge[]> {
  const list = Array.from(_charges.values()).filter((c) => c.organizationId === organizationId);

  // Auto-overdue
  const t = now();
  const normalized = list.map((c) => {
    if (c.status === "PENDING" && new Date(c.dueDate) < t) {
      return { ...c, status: "OVERDUE" as const };
    }
    return c;
  });

  normalized.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  return normalized;
}

export async function getChargeById(id: number): Promise<Charge | null> {
  return _charges.get(id) ?? null;
}

export async function updateCharge(id: number, data: Partial<Charge>): Promise<Charge | null> {
  const current = _charges.get(id);
  if (!current) return null;

  const updated: Charge = {
    ...current,
    ...data,
    paidDate:
      data.status === "PAID"
        ? (data.paidDate ?? current.paidDate ?? now())
        : (data.paidDate ?? current.paidDate ?? null),
    updatedAt: now(),
  };

  _charges.set(id, updated);
  return updated;
}

export async function deleteCharge(id: number) {
  return okDelete(_charges.delete(id), id);
}

// =============================================================================
// PEOPLE (DEV MODE) — In-memory fallback
// =============================================================================

export type Person = {
  id: number;
  organizationId: number;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreatePersonInput = Omit<Person, "id" | "createdAt" | "updatedAt">;

let _personSeq = 1;
const _people = new Map<number, Person>();

export async function createPerson(input: CreatePersonInput): Promise<Person> {
  const t = now();
  const id = _personSeq++;
  const p: Person = {
    id,
    createdAt: t,
    updatedAt: t,
    role: input.role ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    status: input.status ?? "ACTIVE",
    ...input,
  };
  _people.set(id, p);
  return p;
}

export async function getPeopleByOrg(organizationId: number): Promise<Person[]> {
  const list = Array.from(_people.values()).filter((p) => p.organizationId === organizationId);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

export async function getPersonById(id: number): Promise<Person | null> {
  return _people.get(id) ?? null;
}

export async function updatePerson(id: number, data: Partial<Person>): Promise<Person | null> {
  const current = _people.get(id);
  if (!current) return null;
  const updated: Person = { ...current, ...data, updatedAt: now() };
  _people.set(id, updated);
  return updated;
}

export async function deletePerson(id: number) {
  return okDelete(_people.delete(id), id);
}

// =============================================================================
// GOVERNANCE (DEV MODE) — In-memory fallback
// =============================================================================

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ComplianceStatus = "compliant" | "warning" | "non_compliant";

export type Governance = {
  id: number;
  organizationId: number;

  customerId?: number | null;
  appointmentId?: number | null;
  serviceOrderId?: number | null;
  chargeId?: number | null;

  riskScore: number;
  riskLevel: RiskLevel;
  complianceStatus: ComplianceStatus;

  issues?: string | null; // JSON string
  recommendations?: string | null; // JSON string

  notes?: string | null;
  evaluatedBy?: string | null;
  lastEvaluated?: Date | null;

  createdAt: Date;
  updatedAt: Date;
};

type CreateGovernanceInput = Omit<Governance, "id" | "createdAt" | "updatedAt">;

let _govSeq = 1;
const _governance = new Map<number, Governance>();

export async function createGovernance(input: CreateGovernanceInput): Promise<Governance> {
  const t = now();
  const id = _govSeq++;

  const g: Governance = {
    id,
    createdAt: t,
    updatedAt: t,
    customerId: input.customerId ?? null,
    appointmentId: input.appointmentId ?? null,
    serviceOrderId: input.serviceOrderId ?? null,
    chargeId: input.chargeId ?? null,
    issues: input.issues ?? null,
    recommendations: input.recommendations ?? null,
    notes: input.notes ?? null,
    evaluatedBy: input.evaluatedBy ?? null,
    lastEvaluated: input.lastEvaluated ?? null,
    ...input,
  };

  _governance.set(id, g);
  return g;
}

export async function getGovernanceByOrg(organizationId: number): Promise<Governance[]> {
  const list = Array.from(_governance.values()).filter((g) => g.organizationId === organizationId);
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return list;
}

export async function getGovernanceById(id: number): Promise<Governance | null> {
  return _governance.get(id) ?? null;
}

export async function updateGovernance(id: number, data: Partial<Governance>): Promise<Governance | null> {
  const current = _governance.get(id);
  if (!current) return null;
  const updated: Governance = { ...current, ...data, updatedAt: now() };
  _governance.set(id, updated);
  return updated;
}

export async function deleteGovernance(id: number) {
  return okDelete(_governance.delete(id), id);
}

// =============================================================================
// CONTACT HISTORY (DEV MODE) — In-memory fallback
// =============================================================================

export type ContactHistory = {
  id: number;
  organizationId: number;
  customerId: number;
  contactType: "phone" | "email" | "whatsapp" | "in_person" | "other";
  subject: string;
  description?: string | null;
  notes?: string | null;
  contactedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateContactHistoryInput = Omit<ContactHistory, "id" | "createdAt" | "updatedAt">;

let _contactHistorySeq = 1;
const _contactHistory = new Map<number, ContactHistory>();

export async function createContactHistory(input: CreateContactHistoryInput): Promise<ContactHistory> {
  const t = now();
  const id = _contactHistorySeq++;
  const c: ContactHistory = {
    id,
    createdAt: t,
    updatedAt: t,
    description: input.description ?? null,
    notes: input.notes ?? null,
    contactedBy: input.contactedBy ?? null,
    ...input,
  };
  _contactHistory.set(id, c);
  return c;
}

export async function getContactHistoryByCustomer(customerId: number): Promise<ContactHistory[]> {
  const list = Array.from(_contactHistory.values()).filter((c) => c.customerId === customerId);
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return list;
}

export async function deleteContactHistory(id: number) {
  return okDelete(_contactHistory.delete(id), id);
}

// =============================================================================
// WHATSAPP MESSAGES (DEV MODE) — In-memory fallback
// =============================================================================

export type WhatsAppMessage = {
  id: number;
  organizationId: number;
  customerId: number;
  direction: "inbound" | "outbound";
  content: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  senderNumber?: string | null;
  receiverNumber?: string | null;
  mediaUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateWhatsAppMessageInput = Omit<WhatsAppMessage, "id" | "createdAt" | "updatedAt">;

let _whatsappSeq = 1;
const _whatsappMessages = new Map<number, WhatsAppMessage>();

export async function createWhatsappMessage(input: CreateWhatsAppMessageInput): Promise<WhatsAppMessage> {
  const t = now();
  const id = _whatsappSeq++;
  const w: WhatsAppMessage = {
    id,
    createdAt: t,
    updatedAt: t,
    senderNumber: input.senderNumber ?? null,
    receiverNumber: input.receiverNumber ?? null,
    mediaUrl: input.mediaUrl ?? null,
    ...input,
  };
  _whatsappMessages.set(id, w);
  return w;
}

export async function getWhatsappMessagesByCustomer(customerId: number): Promise<WhatsAppMessage[]> {
  const list = Array.from(_whatsappMessages.values()).filter((w) => w.customerId === customerId);
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return list;
}

export async function updateWhatsappMessageStatus(id: number, status: string): Promise<WhatsAppMessage | null> {
  const current = _whatsappMessages.get(id);
  if (!current) return null;
  const updated: WhatsAppMessage = { ...current, status: status as any, updatedAt: now() };
  _whatsappMessages.set(id, updated);
  return updated;
}

export async function deleteWhatsappMessage(id: number) {
  return okDelete(_whatsappMessages.delete(id), id);
}
