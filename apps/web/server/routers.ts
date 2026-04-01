import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { fetchNexoMe } from "./_core/context";
import { nexoProxyRouter } from "./routers/nexo-proxy";
import { dataRouter } from "./routers/data";
import { financeRouter } from "./routers/finance";
import { peopleRouter } from "./routers/people";
import { governanceRouter } from "./routers/governance";
import { dashboardRouter } from "./routers/dashboard";
import { contactRouter } from "./routers/contact";
import { expensesRouter } from "./routers/expenses";
import { invoicesRouter } from "./routers/invoices";
import { launchesRouter } from "./routers/launches";
import { referralsRouter } from "./routers/referrals";
import { aiRouter } from "./routers/ai";
import { financeAdvancedRouter } from "./routers/finance-advanced";
import { paymentsRouter } from "./routers/payments";

const NEXO_TOKEN_COOKIE = "nexo_token";

export const appRouter = router({
  system: systemRouter,

  nexo: nexoProxyRouter,

  data: dataRouter,
  finance: financeRouter,
  people: peopleRouter,
  governance: governanceRouter,
  dashboard: dashboardRouter,
  contact: contactRouter,
  expenses: expensesRouter,
  invoices: invoicesRouter,
  launches: launchesRouter,
  referrals: referralsRouter,
  ai: aiRouter,
  financeAdvanced: financeAdvancedRouter,
  payments: paymentsRouter,

  session: router({
    me: publicProcedure.query(async ({ ctx }) => {
      return await fetchNexoMe(ctx.req);
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);

      ctx.res.clearCookie(NEXO_TOKEN_COOKIE, {
        ...cookieOptions,
      });

      return {
        success: true,
      } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
