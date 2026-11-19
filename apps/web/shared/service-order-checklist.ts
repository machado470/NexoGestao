import { z } from "zod";
export const checklistCreate = z
  .object({
    serviceOrderId: z.string().uuid(),
    entryKey: z.string().uuid(),
    title: z.string().trim().min(3).max(160),
  })
  .strict();
export const checklistChange = z
  .object({
    serviceOrderId: z.string().uuid(),
    id: z.string().uuid(),
    completed: z.boolean(),
    expectedVersion: z.number().int().min(0).max(1000000),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(v => v.completed || (v.reason?.length ?? 0) >= 5, {
    message: "Informe o motivo para desmarcar a tarefa",
    path: ["reason"],
  });
export const checklistItem = z.object({
  id: z.string().uuid(),
  title: z.string(),
  completed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  completedByName: z.string().nullable(),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type ChecklistItem = z.infer<typeof checklistItem>;
