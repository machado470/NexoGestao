import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

import { InsertCustomer, customers, InsertAppointment, appointments, InsertServiceOrder, serviceOrders } from "../drizzle/schema";

// ===== Customers =====
export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(customers).values(data);
  return result;
}

export async function getCustomersByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(customers).where(eq(customers.organizationId, organizationId));
}

// ===== Appointments =====
export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(appointments).values(data);
  return result;
}

export async function getAppointmentsByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(appointments).where(eq(appointments.organizationId, organizationId));
}

// ===== Service Orders =====
export async function createServiceOrder(data: InsertServiceOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(serviceOrders).values(data);
  return result;
}

export async function getServiceOrdersByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(serviceOrders).where(eq(serviceOrders.organizationId, organizationId));
}

// ===== UPDATE Functions =====
export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function updateAppointment(id: number, data: Partial<InsertAppointment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(appointments).set(data).where(eq(appointments.id, id));
}

export async function updateServiceOrder(id: number, data: Partial<InsertServiceOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(serviceOrders).set(data).where(eq(serviceOrders.id, id));
}

// ===== DELETE Functions =====
export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(customers).where(eq(customers.id, id));
}

export async function deleteAppointment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(appointments).where(eq(appointments.id, id));
}

export async function deleteServiceOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(serviceOrders).where(eq(serviceOrders.id, id));
}

// ===== GET by ID Functions =====
export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAppointmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getServiceOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ===== Charges =====
import { InsertCharge, charges } from "../drizzle/schema";

export async function createCharge(data: InsertCharge) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(charges).values(data);
}

export async function getChargesByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(charges).where(eq(charges.organizationId, organizationId));
}

export async function getChargeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(charges).where(eq(charges.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateCharge(id: number, data: Partial<InsertCharge>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(charges).set(data).where(eq(charges.id, id));
}

export async function deleteCharge(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(charges).where(eq(charges.id, id));
}

// ===== People =====
import { InsertPerson, people } from "../drizzle/schema";

export async function createPerson(data: InsertPerson) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(people).values(data);
}

export async function getPeopleByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(people).where(eq(people.organizationId, organizationId));
}

export async function getPersonById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(people).where(eq(people.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updatePerson(id: number, data: Partial<InsertPerson>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(people).set(data).where(eq(people.id, id));
}

export async function deletePerson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(people).where(eq(people.id, id));
}

// ===== Governance =====
import { InsertGovernance, governance } from "../drizzle/schema";

export async function createGovernance(data: InsertGovernance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(governance).values(data);
}

export async function getGovernanceByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(governance).where(eq(governance.organizationId, organizationId));
}

export async function getGovernanceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(governance).where(eq(governance.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateGovernance(id: number, data: Partial<InsertGovernance>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(governance).set(data).where(eq(governance.id, id));
}

export async function deleteGovernance(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(governance).where(eq(governance.id, id));
}
