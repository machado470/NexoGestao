import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { nexoProxyRouter } from "./routers/nexo-proxy";
import { authRouter } from "./routers/auth";
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

import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

/**
 * Pega o token do cookie do request
 */
function getNexoTokenFromReq(req: any): string | null {
  const raw = req?.headers?.cookie;

  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];

  if (!token) return null;

  return token;
}

/**
 * Chama /me na API Nest do NexoGestão
 */
async function fetchNexoMe(req: any) {
  const token = getNexoTokenFromReq(req);

  if (!token) {
    return null;
  }

  const response = await fetch(`${NEXO_API_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export const appRouter = router({
  system: systemRouter,

  /**
   * Proxy da API NexoGestão
   */
  nexo: nexoProxyRouter,

  /**
   * Routers do portal
   */
  auth: authRouter,
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

  /**
   * Session Router
   * Agora conectado ao NexoGestão
   */
  session: router({
    me: publicProcedure.query(async ({ ctx }) => {
      return await fetchNexoMe(ctx.req);
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      /**
       * Limpa cookie do Nexo
       */
      ctx.res.cookie(NEXO_TOKEN_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });

      /**
       * Limpa cookie antigo do portal
       */
      const cookieOptions = getSessionCookieOptions(ctx.req);

      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });

      return {
        success: true,
      } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
