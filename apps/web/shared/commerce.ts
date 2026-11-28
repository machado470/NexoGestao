import { z } from "zod";
const id = z.string().min(1).max(100);
const cents = z.number().int().min(0).max(2147483647);
const money = z.number().int().safe();
const currency = z.string().regex(/^[A-Z]{3}$/);
const key = z.string().min(8).max(100);
export const productKind = z.enum(["SIMPLE", "PARENT", "VARIANT", "RAW_MATERIAL"]);
export const rawMaterialUnit = z.enum(["KG", "L", "M"]);
export const productInput = z.object({
  kind: productKind.optional(),
  rawMaterialUnit: rawMaterialUnit.optional(),
  parentSku: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i).optional(),
  expectedCurrency: currency,
  sku: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i),
  name: z.string().trim().min(2).max(180),
  barcode: z.string().trim().max(64).optional(),
  variant: z.string().trim().max(100).optional(),
  minQuantity: z.number().int().min(0).max(1000000000),
  costCents: cents,
  saleCents: cents,
});
export const productSchema = productInput
  .omit({ expectedCurrency: true, parentSku: true })
  .extend({
    id,
    kind: z.enum(["SIMPLE", "PARENT", "VARIANT", "KIT", "RAW_MATERIAL"]).default("SIMPLE"),
    rawMaterialUnit: rawMaterialUnit.nullable().optional(),
    availableKits: z.number().int().min(0).optional(),
    components: z.array(z.object({ sku: z.string(), name: z.string(), quantity: z.number().int().positive() })).optional(),
    parentId: id.nullable().optional(),
    currency,
    barcode: z.string().nullable(),
    variant: z.string().nullable(),
    onHand: z.number().int().min(0),
    reservedQuantity: z.number().int().min(0).default(0),
    createdAt: z.string(),
  });
export const productsSchema = z.object({
  items: z.array(productSchema),
  total: z.number().int().min(0),
  page: z.number().int().positive(),
  pages: z.number().int().positive(),
});
export const kitInput = productInput.pick({ expectedCurrency: true, sku: true, name: true, saleCents: true })
  .extend({
    components: z.array(z.object({
      sku: productInput.shape.sku,
      quantity: z.number().int().min(1).max(1000000000),
    })).min(1).max(30),
  });
export const kitWithdrawalInput = z.object({
  kitId: id,
  entryKey: key,
  quantity: z.number().int().min(1).max(1000000000),
  reason: z.string().trim().min(3).max(500),
});
export const reservationInput = z.object({
  productId: id,
  serviceOrderId: id,
  quantity: z.number().int().min(1).max(1000000000),
  entryKey: key,
});
export const reservationSchema = z.object({
  id,
  productId: id,
  serviceOrderId: id,
  quantity: z.number().int().positive(),
  releasedAt: z.string().nullable(),
  consumedAt: z.string().nullable(),
});
export const reservationListItem = reservationSchema.extend({
  product: z.object({ name: z.string(), sku: z.string() }),
});
export const movementInput = z.object({
  productId: id,
  quantityScale: z.literal("THOUSANDTHS").optional(),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number().int().min(1).max(1000000000),
  reason: z.string().trim().min(3).max(500),
  serviceOrderId: id.optional(),
  entryKey: key,
});
export const movementSchema = z.object({
  id,
  productId: id,
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number().int().positive(),
  reason: z.string(),
  serviceOrderId: id.nullable(),
  createdAt: z.string(),
  product: z.object({ name: z.string(), sku: z.string(), rawMaterialUnit: rawMaterialUnit.nullable().optional() }).optional(),
});
export const fiscalInput = z.object({
  expectedCurrency: currency,
  customerId: id,
  serviceOrderId: id.optional(),
  description: z.string().trim().min(5).max(3000),
  amountCents: cents.min(1),
  entryKey: key,
});
export const fiscalSchema = z.object({
  id,
  customerId: id,
  serviceOrderId: id.nullable(),
  description: z.string(),
  amountCents: cents,
  currency,
  createdAt: z.string(),
  customer: z
    .object({ name: z.string(), cpfCnpj: z.string().nullable() })
    .optional(),
});
export const fiscalListSchema = z.object({
  emissionAvailable: z.literal(false),
  items: z.array(fiscalSchema),
});
export const expenseInput = z.object({
  expectedCurrency: currency,
  title: z.string().trim().min(2).max(180),
  amountCents: cents.min(1),
  occurredAt: z.string().datetime(),
  entryKey: key,
});
export const expenseSchema = z.object({
  id,
  title: z.string(),
  amountCents: cents,
  currency,
  occurredAt: z.string(),
});
export const healthSchema = z.object({
  month: z.string(),
  timezone: z.string(),
  unclassifiedExpenseCount: z.number().int().min(0),
  recentExpenses: z.array(
    z.object({
      id,
      title: z.string(),
      amountCents: cents,
      currency: currency.nullable(),
      occurredAt: z.string(),
      recurrence: z.string(),
    })
  ),
  currencies: z.array(
    z.object({
      currency,
      receivedCents: money,
      refundedCents: money,
      expensesCents: money,
      openCents: money,
      overdueCents: money,
      recordedResultCents: money.nullable(),
    })
  ),
});
export type Product = z.infer<typeof productSchema>;
