import { z } from "zod";
export const evidenceUpload = z
  .object({
    serviceOrderId: z.string().uuid(),
    entryKey: z.string().uuid(),
    description: z.string().trim().min(5).max(1000),
    imageBase64: z
      .string()
      .min(4)
      .max(87384)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    professionalConfirmed: z.literal(true),
  })
  .strict();
export const evidenceMetadata = z.object({
  id: z.string().uuid(),
  description: z.string(),
  uploadedByUserId: z.string(),
  uploadedByName: z.string(),
  createdAt: z.string().datetime(),
});
