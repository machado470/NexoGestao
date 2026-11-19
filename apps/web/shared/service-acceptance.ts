import { z } from "zod";
const uuid = z.string().uuid();
export const acceptanceCreate = z
  .object({
    serviceOrderId: uuid,
    entryKey: uuid,
    publicTitle: z.string().trim().min(3).max(160),
    publicSummary: z.string().trim().min(10).max(1000),
  })
  .strict();
export const acceptanceToken = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const acceptanceResponse = acceptanceToken
  .extend({
    responseKey: uuid,
    decision: z.enum(["ACCEPTED", "ISSUE"]),
    respondentName: z.string().trim().min(2).max(120),
    responseNote: z.string().trim().max(1000).optional(),
    confirmed: z.literal(true),
  })
  .strict()
  .refine(v => v.decision !== "ISSUE" || (v.responseNote?.length ?? 0) >= 10, {
    message: "Descreva o problema com pelo menos 10 caracteres",
    path: ["responseNote"],
  });
export const acceptancePublic = z.object({
  companyName: z.string(),
  publicTitle: z.string(),
  publicSummary: z.string(),
  expiresAt: z.string().datetime(),
  decision: z.enum(["ACCEPTED", "ISSUE"]).nullable(),
  respondedAt: z.string().datetime().nullable(),
});
export const acceptanceRecord = z.object({
  id: uuid,
  publicTitle: z.string(),
  publicSummary: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  decision: z.enum(["ACCEPTED", "ISSUE"]).nullable(),
  respondentName: z.string().nullable(),
  responseNote: z.string().nullable(),
  respondedAt: z.string().datetime().nullable(),
});
