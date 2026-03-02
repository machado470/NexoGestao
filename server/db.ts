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


// ===== Contact History =====
import { InsertContactHistory, contactHistory } from "../drizzle/schema";
import { desc } from "drizzle-orm";

export async function createContactHistory(data: InsertContactHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(contactHistory).values(data);
}

export async function getContactHistoryByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contactHistory).where(eq(contactHistory.customerId, customerId)).orderBy(desc(contactHistory.createdAt));
}

export async function deleteContactHistory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(contactHistory).where(eq(contactHistory.id, id));
}

// ===== WhatsApp Messages =====
import { InsertWhatsappMessage, whatsappMessages } from "../drizzle/schema";

export async function createWhatsappMessage(data: InsertWhatsappMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(whatsappMessages).values(data);
}

export async function getWhatsappMessagesByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(whatsappMessages).where(eq(whatsappMessages.customerId, customerId)).orderBy(desc(whatsappMessages.createdAt));
}

export async function updateWhatsappMessageStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(whatsappMessages).set({ status: status as any }).where(eq(whatsappMessages.id, id));
}

export async function deleteWhatsappMessage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(whatsappMessages).where(eq(whatsappMessages.id, id));
}


// ===== Service Tracking =====
import { InsertServiceTracking, serviceTracking, InsertDiscount, discounts, organizations } from "../drizzle/schema";
import { and, gte, lte, sql } from "drizzle-orm";

export async function createServiceTracking(data: InsertServiceTracking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(serviceTracking).values(data);
}

export async function getServiceTrackingByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceTracking).where(eq(serviceTracking.organizationId, organizationId));
}

export async function getServiceTrackingById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(serviceTracking).where(eq(serviceTracking.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getServiceTrackingByCollaborator(organizationId: number, collaboratorId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceTracking).where(
    and(
      eq(serviceTracking.organizationId, organizationId),
      eq(serviceTracking.collaboratorId, collaboratorId)
    )
  );
}

export async function getServiceTrackingByServiceOrder(serviceOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceTracking).where(eq(serviceTracking.serviceOrderId, serviceOrderId));
}

export async function updateServiceTracking(id: number, data: Partial<InsertServiceTracking>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(serviceTracking).set(data).where(eq(serviceTracking.id, id));
}

export async function deleteServiceTracking(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(serviceTracking).where(eq(serviceTracking.id, id));
}

// ===== Discounts =====
export async function createDiscount(data: InsertDiscount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(discounts).values(data);
}

export async function getDiscountsByServiceTracking(serviceTrackingId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(discounts).where(eq(discounts.serviceTrackingId, serviceTrackingId));
}

export async function getDiscountById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(discounts).where(eq(discounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateDiscount(id: number, data: Partial<InsertDiscount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(discounts).set(data).where(eq(discounts.id, id));
}

export async function deleteDiscount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(discounts).where(eq(discounts.id, id));
}

// ===== Organizations =====
export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ===== Earnings Calculation =====
export async function calculateCollaboratorEarnings(
  organizationId: number,
  collaboratorId: number,
  startDate?: Date,
  endDate?: Date
) {
  const db = await getDb();
  if (!db) return { totalEarned: 0, totalDiscounts: 0, totalHours: 0, trackingCount: 0 };

  let whereCondition = and(
    eq(serviceTracking.organizationId, organizationId),
    eq(serviceTracking.collaboratorId, collaboratorId),
    eq(serviceTracking.status, "completed")
  );

  if (startDate && endDate) {
    whereCondition = and(
      whereCondition,
      gte(serviceTracking.endTime, startDate),
      lte(serviceTracking.endTime, endDate)
    );
  }

  const result = await db
    .select({
      totalEarned: sql<number>`COALESCE(SUM(CAST(${serviceTracking.amountEarned} AS DECIMAL(10,2))), 0)`,
      totalDiscounts: sql<number>`COALESCE(SUM(CAST(${discounts.amount} AS DECIMAL(10,2))), 0)`,
      totalHours: sql<number>`COALESCE(SUM(CAST(${serviceTracking.hoursWorked} AS DECIMAL(10,2))), 0)`,
      trackingCount: sql<number>`COUNT(DISTINCT ${serviceTracking.id})`,
    })
    .from(serviceTracking)
    .leftJoin(discounts, eq(serviceTracking.id, discounts.serviceTrackingId))
    .where(whereCondition);

  return result[0] || { totalEarned: 0, totalDiscounts: 0, totalHours: 0, trackingCount: 0 };
}
