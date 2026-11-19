import { z } from "zod";
const uuid = z.string().uuid();
export const catalogValues = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{0,39}$/i),
    name: z.string().trim().min(2).max(140),
    description: z.string().trim().max(2000),
    priceCents: z.number().int().min(0).max(2147483647).nullable(),
    durationMinutes: z.number().int().min(1).max(10080).nullable(),
    expectedCurrency: z.string().regex(/^[A-Z]{3}$/),
  })
  .strict();
export const catalogCreate = catalogValues.extend({ entryKey: uuid }).strict();
export const catalogEdit = catalogValues
  .extend({
    id: uuid,
    active: z.boolean(),
    expectedVersion: z.number().int().min(0).max(1000000),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export const catalogSnapshot = catalogValues
  .omit({ expectedCurrency: true })
  .extend({ currency: z.string().regex(/^[A-Z]{3}$/), active: z.boolean() });
export const catalogItem = catalogSnapshot.extend({
  id: uuid,
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CatalogItem = z.infer<typeof catalogItem>;
export const catalogFilters = z
  .object({
    page: z.number().int().min(1).max(10000).default(1),
    q: z.string().trim().max(120).default(""),
    state: z.enum(["active", "archived", "all"]).default("active"),
  })
  .strict();
const pageFields = {
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pages: z.number().int().positive(),
};
export const catalogPage = z.object({
  ...pageFields,
  items: z.array(catalogItem),
});
export const catalogHistory = z.object({
  ...pageFields,
  items: z.array(
    z.object({
      id: uuid,
      version: z.number().int().nonnegative(),
      snapshot: catalogSnapshot,
      reason: z.string(),
      actorName: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
});
