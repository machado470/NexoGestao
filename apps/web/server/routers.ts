import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { nexoProxyRouter } from "./routers/nexo-proxy";
import { authRouter } from "./routers/auth";
import { dataRouter } from "./routers/data";

export const appRouter = router({
  system: systemRouter,
  nexo: nexoProxyRouter,
  auth: authRouter,
  data: dataRouter,
  session: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
