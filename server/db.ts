import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, plans, subscriptions, transactions, planUsage } from "../drizzle/schema";
import { ENV } from './_core/env';
import { eq, and, gt, lt, sql } from "drizzle-orm";

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
import { gte, lte } from "drizzle-orm";

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


// ===== Referrals =====
import { referrals, credits, passwordResetTokens, InsertReferral, InsertCredit, InsertPasswordResetToken, expenses, invoices } from "../drizzle/schema";

export async function createReferral(data: InsertReferral) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(referrals).values(data);
  return result;
}

export async function getReferralByCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(referrals).where(eq(referrals.referralCode, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getReferralsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(referrals).where(eq(referrals.referrerId, userId));
}

export async function updateReferral(id: number, data: Partial<InsertReferral>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(referrals).set(data).where(eq(referrals.id, id));
  return result;
}

export async function getReferralStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, userId));
  const completedReferrals = userReferrals.filter(r => r.status === 'completed').length;
  const totalCredits = userReferrals.reduce((sum, r) => sum + (Number(r.creditAmount) || 0), 0);
  const claimedCredits = userReferrals.filter(r => r.creditClaimed).reduce((sum, r) => sum + (Number(r.creditAmount) || 0), 0);
  
  return {
    totalReferrals: userReferrals.length,
    completedReferrals,
    totalCredits,
    claimedCredits,
    availableCredits: totalCredits - claimedCredits,
  };
}

// ===== Credits =====
export async function createCredit(data: InsertCredit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(credits).values(data);
  return result;
}

export async function getCreditsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(credits).where(eq(credits.userId, userId));
}

export async function getUserCreditsBalance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const userCredits = await db.select().from(credits).where(eq(credits.userId, userId));
  const total = userCredits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const used = userCredits.filter(c => c.used).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  
  return {
    total,
    used,
    available: total - used,
  };
}

export async function useCredit(creditId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(credits).set({ used: true, usedAt: new Date() }).where(eq(credits.id, creditId));
  return result;
}

// ===== Password Reset =====
export async function createPasswordResetToken(data: InsertPasswordResetToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(passwordResetTokens).values(data);
  return result;
}

export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function markPasswordResetTokenAsUsed(tokenId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(passwordResetTokens).set({ used: true, usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenId));
  return result;
}

export async function getValidPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(passwordResetTokens).where(
    and(
      eq(passwordResetTokens.token, token),
      eq(passwordResetTokens.used, false),
      gt(passwordResetTokens.expiresAt, new Date())
    )
  ).limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteExpiredPasswordResetTokens() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
  return result;
}


export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}


// ===== Expenses (Despesas) =====
export async function createExpense(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(expenses).values(data);
  const result = await db.select().from(expenses).where(eq(expenses.organizationId, data.organizationId)).orderBy((t) => t.id).limit(1);
  return result[0];
}

export async function getExpensesByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get expenses: database not available");
    return [];
  }

  const result = await db.select().from(expenses).where(eq(expenses.organizationId, organizationId));
  return result;
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateExpense(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(expenses).set(data).where(eq(expenses.id, id));
  const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return result[0];
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(expenses).where(eq(expenses.id, id));
}


// ===== Invoices (Notas Fiscais) =====
export async function createInvoice(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(invoices).values(data);
  const result = await db.select().from(invoices).where(eq(invoices.organizationId, data.organizationId)).orderBy((t) => t.id).limit(1);
  return result[0];
}

export async function getInvoicesByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get invoices: database not available");
    return [];
  }

  const result = await db.select().from(invoices).where(eq(invoices.organizationId, organizationId));
  return result;
}

export async function getInvoiceById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateInvoice(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(invoices).set(data).where(eq(invoices.id, id));
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result[0];
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(invoices).where(eq(invoices.id, id));
}


// ===== Plans =====
export async function createPlan(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(plans).values(data);
  const result = await db.select().from(plans).where(eq(plans.name, data.name)).limit(1);
  return result[0];
}

export async function getAllPlans() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(plans).orderBy(plans.id);
}

export async function getPlanById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  return result[0];
}

export async function getPlanByName(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(plans).where(eq(plans.name, name)).limit(1);
  return result[0];
}

// ===== Subscriptions =====
export async function createSubscription(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(subscriptions).values(data);
  const result = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, data.organizationId)).orderBy((t) => t.id).limit(1);
  return result[0];
}

export async function getSubscriptionByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).limit(1);
  return result[0];
}

export async function updateSubscription(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
  const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return result[0];
}

export async function cancelSubscription(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.id, id));
  return { success: true };
}

// ===== Transactions =====
export async function createTransaction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(transactions).values(data);
  const result = await db.select().from(transactions).where(eq(transactions.organizationId, data.organizationId)).orderBy((t) => t.id).limit(1);
  return result[0];
}

export async function getTransactionsByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(transactions).where(eq(transactions.organizationId, organizationId)).orderBy((t) => t.createdAt);
}

export async function updateTransaction(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transactions).set(data).where(eq(transactions.id, id));
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result[0];
}

// ===== Plan Usage =====
export async function getPlanUsage(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(planUsage).where(eq(planUsage.organizationId, organizationId)).limit(1);
  return result[0];
}

export async function updatePlanUsage(organizationId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getPlanUsage(organizationId);
  if (existing) {
    await db.update(planUsage).set(data).where(eq(planUsage.organizationId, organizationId));
  } else {
    await db.insert(planUsage).values({ organizationId, ...data });
  }
  return await getPlanUsage(organizationId);
}

// ===== Helper: Get Active Plan for Organization =====
export async function getActivePlan(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const subscription = await getSubscriptionByOrg(organizationId);
  if (!subscription || subscription.status !== "active") {
    // Return free plan as default
    return await getPlanByName("free");
  }
  
  return await getPlanById(subscription.planId);
}
