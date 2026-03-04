import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import cookie from "cookie";

// URL da API do NexoGestao - usar variável de ambiente ou localhost
// IMPORTANTE: API (Nest) é 3000. O BFF (apps/web) pode ser 3001+.
const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";

// Cookie onde vamos guardar o JWT do backend (Nest)
const NEXO_TOKEN_COOKIE = "nexo_token";

type CtxLike = {
  req: { headers: Record<string, any> };
  res: any;
};

function getTokenFromCookie(ctx: CtxLike): string | null {
  const raw = ctx?.req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];
  if (!token) return null;

  return token;
}

function getAuthHeader(ctx: CtxLike): string | null {
  const h = ctx?.req?.headers?.authorization;
  if (typeof h === "string" && h.trim().length > 0) return h;

  const token = getTokenFromCookie(ctx);
  if (!token) return null;

  return `Bearer ${token}`;
}

function setTokenCookie(ctx: CtxLike, token: string) {
  // Express res.cookie existe (não precisa cookie-parser)
  ctx.res.cookie(NEXO_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 7 dias
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearTokenCookie(ctx: CtxLike) {
  ctx.res.cookie(NEXO_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function nexoFetch(path: string, options: RequestInit = {}) {
  const url = `${NEXO_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export const nexoProxyRouter = router({
  // Endpoints de Bootstrap
  bootstrap: router({
    firstAdmin: publicProcedure
      .input(
        z.object({
          orgName: z.string(),
          adminName: z.string(),
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await nexoFetch("/bootstrap/first-admin", {
            method: "POST",
            body: JSON.stringify({
              orgName: input.orgName,
              adminName: input.adminName,
              email: input.email,
              password: input.password,
            }),
          });
        } catch (error: any) {
          console.error("[Nexo Proxy] Bootstrap failed:", error.message);
          throw new Error(`Falha ao criar conta: ${error.message}`);
        }
      }),
  }),

  // Endpoints de Autenticação
  auth: router({
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await nexoFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: input.email,
              password: input.password,
            }),
          });

          // Salva token em cookie httpOnly pro browser mandar automaticamente depois
          const token = result?.data?.token;
          if (typeof token === "string" && token.length > 0) {
            setTokenCookie(ctx as any, token);
          }

          return result;
        } catch (error: any) {
          console.error("[Nexo Proxy] Login failed:", error.message);
          throw new Error(`Falha ao fazer login: ${error.message}`);
        }
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      clearTokenCookie(ctx as any);
      return { ok: true } as const;
    }),

    // ⚠️ IMPORTANTE:
    // O backend NÃO tem /auth/me (deu 404). O "me" está no controller apps/api/src/me/me.controller.ts.
    // Então o endpoint correto é /me.
    me: publicProcedure.query(async ({ ctx }) => {
      try {
        const authHeader = getAuthHeader(ctx as any);
        if (!authHeader) throw new Error("Token não fornecido");

        return await nexoFetch("/me", {
          method: "GET",
          headers: {
            Authorization: authHeader,
          },
        });
      } catch (error: any) {
        console.error("[Nexo Proxy] Me failed:", error.message);
        throw new Error(`Falha ao obter dados do usuário: ${error.message}`);
      }
    }),
  }),

  // Endpoints de Clientes
  customers: router({
    list: publicProcedure.query(async ({ ctx }) => {
      try {
        const authHeader = getAuthHeader(ctx as any);
        const headers: Record<string, string> = {};
        if (authHeader) headers.Authorization = authHeader;

        return await nexoFetch("/customers", {
          method: "GET",
          headers,
        });
      } catch (error: any) {
        console.error("[Nexo Proxy] List customers failed:", error.message);
        throw new Error(`Falha ao listar clientes: ${error.message}`);
      }
    }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string(),
          phone: z.string(),
          email: z.string().email().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const authHeader = getAuthHeader(ctx as any);
          const headers: Record<string, string> = {};
          if (authHeader) headers.Authorization = authHeader;

          return await nexoFetch("/customers", {
            method: "POST",
            body: JSON.stringify(input),
            headers,
          });
        } catch (error: any) {
          console.error("[Nexo Proxy] Create customer failed:", error.message);
          throw new Error(`Falha ao criar cliente: ${error.message}`);
        }
      }),
  }),

  // Endpoints de Agendamentos
  appointments: router({
    list: publicProcedure.query(async ({ ctx }) => {
      try {
        const authHeader = getAuthHeader(ctx as any);
        const headers: Record<string, string> = {};
        if (authHeader) headers.Authorization = authHeader;

        return await nexoFetch("/appointments", {
          method: "GET",
          headers,
        });
      } catch (error: any) {
        console.error("[Nexo Proxy] List appointments failed:", error.message);
        throw new Error(`Falha ao listar agendamentos: ${error.message}`);
      }
    }),
  }),

  // Endpoints de Ordens de Serviço
  serviceOrders: router({
    list: publicProcedure.query(async ({ ctx }) => {
      try {
        const authHeader = getAuthHeader(ctx as any);
        const headers: Record<string, string> = {};
        if (authHeader) headers.Authorization = authHeader;

        return await nexoFetch("/service-orders", {
          method: "GET",
          headers,
        });
      } catch (error: any) {
        console.error("[Nexo Proxy] List service orders failed:", error.message);
        throw new Error(`Falha ao listar ordens de serviço: ${error.message}`);
      }
    }),
  }),

  // Endpoints de Finanças
  finance: router({
    overview: publicProcedure.query(async ({ ctx }) => {
      try {
        const authHeader = getAuthHeader(ctx as any);
        const headers: Record<string, string> = {};
        if (authHeader) headers.Authorization = authHeader;

        return await nexoFetch("/finance/overview", {
          method: "GET",
          headers,
        });
      } catch (error: any) {
        console.error("[Nexo Proxy] Finance overview failed:", error.message);
        throw new Error(`Falha ao obter overview financeiro: ${error.message}`);
      }
    }),
  }),

  // Endpoints de Admin
  admin: router({
    overview: publicProcedure.query(async ({ ctx }) => {
      try {
        const authHeader = getAuthHeader(ctx as any);
        const headers: Record<string, string> = {};
        if (authHeader) headers.Authorization = authHeader;

        return await nexoFetch("/admin/overview", {
          method: "GET",
          headers,
        });
      } catch (error: any) {
        console.error("[Nexo Proxy] Admin overview failed:", error.message);
        throw new Error(`Falha ao obter overview admin: ${error.message}`);
      }
    }),
  }),
});
