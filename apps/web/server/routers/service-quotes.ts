import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { nexoFetch, nexoPublicFetch } from "../_core/nexoClient";
import { unwrapNexoApiResponse } from "../_core/nexoEnvelope";
import {
  quoteConversion,
  quoteOrderOrigin,
  quoteCreate,
  quoteRevise,
  quoteShare,
  quotePage,
  quoteRecord,
  quoteDetail,
  quoteToken,
  quoteAnswer,
  quotePublic,
} from "../../shared/service-quotes";
const privateHeader = (ctx: any) =>
  ctx.res?.setHeader?.("Cache-Control", "private, no-store");
const read = async (ctx: any, path: string) => {
  privateHeader(ctx);
  return unwrapNexoApiResponse(
    await nexoFetch(ctx, "/service-quotes" + path, { method: "GET" })
  );
};
const write = async (ctx: any, path: string, body: unknown) => {
  privateHeader(ctx);
  return unwrapNexoApiResponse(
    await nexoFetch(ctx, "/service-quotes" + path, {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
};
const page = z.number().int().min(1).max(10000),
  uuid = z.string().uuid();
export const serviceQuotesRouter = router({
  currencyContext: protectedProcedure
    .input(
      z
        .object({
          serviceOrderIds: z.array(uuid).max(500),
          contextKey: z.string().max(1000).optional(),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      privateHeader(ctx);
      return z
        .object({
          items: z.array(
            z.object({
              serviceOrderId: uuid,
              currency: z.string().regex(/^[A-Z]{3}$/),
              source: z.enum(["QUOTE", "CHARGE", "LEGACY_BRL"]),
            })
          ),
        })
        .parse(
          unwrapNexoApiResponse(
            await nexoFetch(ctx, "/service-orders/currency-context", {
              method: "POST",
              body: JSON.stringify({ serviceOrderIds: input.serviceOrderIds }),
            })
          )
        );
    }),

  convert: protectedProcedure
    .input(
      z
        .object({
          id: uuid,
          expectedVersion: z.number().int().min(0).max(1000000),
        })
        .strict()
    )
    .output(quoteConversion)
    .mutation(async ({ ctx, input }) => {
      const { id, ...body } = input;
      return quoteConversion.parse(await write(ctx, `/${id}/convert`, body));
    }),
  orderOrigin: protectedProcedure
    .input(z.object({ serviceOrderId: uuid }).strict())
    .output(quoteOrderOrigin.nullable())
    .query(async ({ ctx, input }) => {
      privateHeader(ctx);
      return z
        .object({ origin: quoteOrderOrigin.nullable() })
        .parse(
          unwrapNexoApiResponse(
            await nexoFetch(
              ctx,
              `/service-orders/${input.serviceOrderId}/quote-origin`,
              { method: "GET" }
            )
          )
        ).origin;
    }),
  list: protectedProcedure
    .input(z.object({ page }).strict())
    .query(async ({ ctx, input }) =>
      quotePage.parse(await read(ctx, `?page=${input.page}`))
    ),
  detail: protectedProcedure
    .input(z.object({ id: uuid, page }).strict())
    .query(async ({ ctx, input }) =>
      quoteDetail.parse(await read(ctx, `/${input.id}?page=${input.page}`))
    ),
  create: protectedProcedure
    .input(quoteCreate)
    .mutation(async ({ ctx, input }) =>
      quoteRecord.parse(await write(ctx, "", input))
    ),
  revise: protectedProcedure
    .input(quoteRevise)
    .mutation(async ({ ctx, input }) => {
      const { id, ...body } = input;
      return quoteRecord.parse(await write(ctx, `/${id}/revise`, body));
    }),
  share: protectedProcedure
    .input(quoteShare)
    .mutation(async ({ ctx, input }) => {
      const { id, ...body } = input;
      return z
        .object({
          id: uuid,
          token: quoteToken.shape.token,
          expiresAt: z.string().datetime(),
        })
        .parse(await write(ctx, `/${id}/share`, body));
    }),
  revoke: protectedProcedure
    .input(z.object({ id: uuid, linkId: uuid }).strict())
    .mutation(async ({ ctx, input }) =>
      z
        .object({ revoked: z.literal(true) })
        .parse(
          await write(ctx, `/${input.id}/approvals/${input.linkId}/revoke`, {})
        )
    ),
  view: publicProcedure
    .input(quoteToken)
    .output(quotePublic)
    .mutation(async ({ ctx, input }) => {
      privateHeader(ctx);
      return unwrapNexoApiResponse(
        await nexoPublicFetch(ctx.req, "/quote-approval/view", {
          method: "POST",
          body: JSON.stringify(input),
        })
      );
    }),
  respond: publicProcedure
    .input(quoteAnswer)
    .output(quotePublic)
    .mutation(async ({ ctx, input }) => {
      privateHeader(ctx);
      return unwrapNexoApiResponse(
        await nexoPublicFetch(ctx.req, "/quote-approval/respond", {
          method: "POST",
          body: JSON.stringify(input),
        })
      );
    }),
});
