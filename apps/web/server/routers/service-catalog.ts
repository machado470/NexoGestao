import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import { unwrapNexoApiResponse } from "../_core/nexoEnvelope";
import {
  catalogCreate,
  catalogEdit,
  catalogFilters,
  catalogHistory,
  catalogItem,
  catalogPage,
} from "../../shared/service-catalog";
const read = async (ctx: any, path: string) =>
  unwrapNexoApiResponse(
    await nexoFetch(ctx, "/service-catalog" + path, { method: "GET" })
  );
const write = async (ctx: any, path: string, body: unknown) =>
  unwrapNexoApiResponse(
    await nexoFetch(ctx, "/service-catalog" + path, {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
export const serviceCatalogRouter = router({
  list: protectedProcedure
    .input(catalogFilters)
    .query(async ({ ctx, input }) =>
      catalogPage.parse(
        await read(
          ctx,
          `?page=${input.page}&q=${encodeURIComponent(input.q)}&state=${input.state}`
        )
      )
    ),
  history: protectedProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          page: z.number().int().min(1).max(10000),
        })
        .strict()
    )
    .query(async ({ ctx, input }) =>
      catalogHistory.parse(
        await read(ctx, `/${input.id}/history?page=${input.page}`)
      )
    ),
  create: protectedProcedure
    .input(catalogCreate)
    .mutation(async ({ ctx, input }) =>
      catalogItem.parse(await write(ctx, "", input))
    ),
  edit: protectedProcedure
    .input(catalogEdit)
    .mutation(async ({ ctx, input }) => {
      const { id, ...body } = input;
      return catalogItem.parse(await write(ctx, `/${id}`, body));
    }),
});
