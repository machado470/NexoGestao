import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import { unwrapNexoApiResponse } from "../_core/nexoEnvelope";
import {
  productInput,
  productSchema,
  productsSchema,
  movementInput,
  movementSchema,
  fiscalInput,
  fiscalSchema,
  fiscalListSchema,
  expenseInput,
  expenseSchema,
  healthSchema,
} from "../../shared/commerce";
async function read(ctx: any, path: string) {
  return unwrapNexoApiResponse(
    await nexoFetch(ctx, `/commerce/${path}`, { method: "GET" })
  );
}
async function write(ctx: any, path: string, input: unknown) {
  return unwrapNexoApiResponse(
    await nexoFetch(ctx, `/commerce/${path}`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  );
}
export const commerceRouter = router({
  products: adminProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        q: z.string().trim().max(120).default(""),
      })
    )
    .query(async ({ ctx, input }) =>
      productsSchema.parse(
        await read(
          ctx,
          `products?page=${input.page}&q=${encodeURIComponent(input.q)}`
        )
      )
    ),
  createProduct: adminProcedure
    .input(productInput)
    .mutation(async ({ ctx, input }) =>
      productSchema.parse(await write(ctx, "products", input))
    ),
  movements: adminProcedure.query(async ({ ctx }) =>
    z.array(movementSchema).parse(await read(ctx, "movements"))
  ),
  move: adminProcedure
    .input(movementInput)
    .mutation(async ({ ctx, input }) =>
      movementSchema.parse(await write(ctx, "movements", input))
    ),
  fiscalDrafts: adminProcedure.query(async ({ ctx }) =>
    fiscalListSchema.parse(await read(ctx, "fiscal-drafts"))
  ),
  createFiscalDraft: adminProcedure
    .input(fiscalInput)
    .mutation(async ({ ctx, input }) =>
      fiscalSchema.parse(await write(ctx, "fiscal-drafts", input))
    ),
  health: adminProcedure
    .input(
      z.object({
        month: z
          .string()
          .regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
          .optional(),
      })
    )
    .query(async ({ ctx, input }) =>
      healthSchema.parse(
        await read(ctx, `health${input.month ? `?month=${input.month}` : ""}`)
      )
    ),
  classifyExpenseCurrency: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(100),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
    )
    .mutation(async ({ ctx, input }) =>
      expenseSchema.parse(await write(ctx, "expenses/currency", input))
    ),
  recordExpense: adminProcedure
    .input(expenseInput)
    .mutation(async ({ ctx, input }) =>
      expenseSchema.parse(await write(ctx, "expenses", input))
    ),
});
