import { z } from "zod";
const uuid = z.string().uuid();
export const returnCreate = z
  .object({
    serviceOrderId: uuid,
    entryKey: uuid,
    kind: z.enum(["WARRANTY", "REWORK"]),
    title: z.string().trim().min(3).max(140),
    reason: z.string().trim().min(10).max(2000),
    sourceAcceptanceId: uuid.optional(),
  })
  .strict();
const order = z.object({
  id: uuid,
  title: z.string(),
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]),
});
export const returnRecord = z.object({
  id: uuid,
  kind: z.enum(["WARRANTY", "REWORK"]),
  title: z.string(),
  reason: z.string(),
  originalTitle: z.string(),
  sourceAcceptanceId: uuid.nullable(),
  createdByName: z.string(),
  createdAt: z.string().datetime(),
  child: order,
  original: order,
});
export const returnPage = z.object({
  items: z.array(returnRecord),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pages: z.number().int().positive(),
  origin: returnRecord.nullable(),
  issues: z.array(
    z.object({
      id: uuid,
      publicTitle: z.string(),
      responseNote: z.string().nullable(),
      respondedAt: z.string().datetime().nullable(),
    })
  ),
});
