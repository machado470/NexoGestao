import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

// URL da API do NexoGestao - usar variável de ambiente ou localhost
const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3001";

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
      .mutation(async ({ input }) => {
        try {
          return await nexoFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: input.email,
              password: input.password,
            }),
          });
        } catch (error: any) {
          console.error("[Nexo Proxy] Login failed:", error.message);
          throw new Error(`Falha ao fazer login: ${error.message}`);
        }
      }),

    me: publicProcedure.query(async ({ ctx }) => {
      try {
        const authHeader = ctx.req.headers.authorization;
        if (!authHeader) {
          throw new Error("Token não fornecido");
        }

        return await nexoFetch("/auth/me", {
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
        const authHeader = ctx.req.headers.authorization;
        const headers: Record<string, string> = {};
        if (authHeader) {
          headers.Authorization = authHeader;
        }

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
          const authHeader = ctx.req.headers.authorization;
          const headers: Record<string, string> = {};
          if (authHeader) {
            headers.Authorization = authHeader;
          }

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
        const authHeader = ctx.req.headers.authorization;
        const headers: Record<string, string> = {};
        if (authHeader) {
          headers.Authorization = authHeader;
        }

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
        const authHeader = ctx.req.headers.authorization;
        const headers: Record<string, string> = {};
        if (authHeader) {
          headers.Authorization = authHeader;
        }

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
        const authHeader = ctx.req.headers.authorization;
        const headers: Record<string, string> = {};
        if (authHeader) {
          headers.Authorization = authHeader;
        }

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
        const authHeader = ctx.req.headers.authorization;
        const headers: Record<string, string> = {};
        if (authHeader) {
          headers.Authorization = authHeader;
        }

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
