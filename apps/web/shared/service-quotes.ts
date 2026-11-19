import { z } from "zod";
const uuid = z.string().uuid(),
  integer = z.number().int().min(0).max(2147483647);
export const quoteLine = z
  .object({
    serviceId: uuid,
    serviceVersion: integer,
    quantity: z.number().int().min(1).max(1000),
    unitCents: integer,
  })
  .strict();
export const quoteValues = z
  .object({
    title: z.string().trim().min(3).max(140),
    conditions: z.string().trim().min(10).max(3000),
    expectedCurrency: z.string().regex(/^[A-Z]{3}$/),
    items: z.array(quoteLine).min(1).max(10),
  })
  .strict();
export const quoteCreate = quoteValues
  .extend({ customerId: uuid, entryKey: uuid })
  .strict();
export const quoteRevise = quoteValues
  .extend({
    id: uuid,
    expectedVersion: integer,
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export const quoteShare = z
  .object({ id: uuid, expectedVersion: integer, entryKey: uuid })
  .strict();
export const quoteSnapshot = z.object({
  title: z.string(),
  conditions: z.string(),
  currency: z.string(),
  totalCents: integer,
  items: z.array(
    quoteLine.extend({
      code: z.string(),
      name: z.string(),
      description: z.string(),
      durationMinutes: z.number().int().nullable(),
      lineCents: integer,
    })
  ),
});
export const quoteRecord = z.object({
  id: uuid,
  customerId: uuid,
  customerName: z.string(),
  version: integer,
  status: z.enum(["DRAFT", "SHARED", "ACCEPTED", "REJECTED"]),
  snapshot: quoteSnapshot,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type QuoteRecord = z.infer<typeof quoteRecord>;
const page = {
  total: integer,
  page: z.number().int().positive(),
  pages: z.number().int().positive(),
};
export const quotePage = z.object({ ...page, items: z.array(quoteRecord) });
export const approvalRecord = z.object({
  id: uuid,
  quoteVersion: integer,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  decision: z.enum(["ACCEPTED", "REJECTED"]).nullable(),
  respondentName: z.string().nullable(),
  responseNote: z.string().nullable(),
  respondedAt: z.string().datetime().nullable(),
});
export const quoteDetail = z.object({
  quote: quoteRecord,
  revisions: z.array(
    z.object({
      version: integer,
      snapshot: quoteSnapshot,
      reason: z.string(),
      actorName: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
  approvals: z.array(approvalRecord),
  page: z.number().int().positive(),
  pages: z.number().int().positive(),
});
export const quoteToken = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const quoteAnswer = quoteToken
  .extend({
    responseKey: uuid,
    decision: z.enum(["ACCEPTED", "REJECTED"]),
    respondentName: z.string().trim().min(2).max(120),
    responseNote: z.string().trim().max(1000).optional(),
    confirmed: z.literal(true),
  })
  .strict()
  .refine(
    x => x.decision !== "REJECTED" || (x.responseNote?.length ?? 0) >= 10,
    {
      message: "Descreva o motivo da recusa com pelo menos 10 caracteres",
      path: ["responseNote"],
    }
  );
export const quotePublic = quoteSnapshot
  .omit({ items: true })
  .extend({
    companyName: z.string(),
    version: integer,
    items: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        quantity: z.number().int(),
        unitCents: integer,
        lineCents: integer,
        durationMinutes: z.number().int().nullable(),
      })
    ),
    expiresAt: z.string().datetime(),
    decision: z.enum(["ACCEPTED", "REJECTED"]).nullable(),
    respondedAt: z.string().datetime().nullable(),
  });
export type PublicQuote = z.infer<typeof quotePublic>;
