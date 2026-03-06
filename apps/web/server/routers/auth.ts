import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

async function postJson(path: string, body: any) {
  const res = await fetch(`${NEXO_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || json?.raw || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  return json;
}

export const authRouter = router({
  // Login REAL (Nest)
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const out = await postJson(`/auth/login`, input);

      // esperado: { ok: true, data: { token, user, org... } } ou { token: ... }
      const token =
        out?.data?.token || out?.token || out?.accessToken || out?.data?.accessToken;

      if (!token) {
        throw new Error("Login não retornou token. Confira o formato da resposta em /auth/login.");
      }

      const cookieOptions = getSessionCookieOptions(ctx.req);

      ctx.res.cookie(NEXO_TOKEN_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        // 7 dias (ajusta depois se quiser)
        maxAge: 60 * 60 * 24 * 7,
        ...cookieOptions,
      });

      return out;
    }),

  // (Opcional) Register REAL (Nest) — só mantém se existir no backend
  register: publicProcedure
    .input(
      z.object({
        orgName: z.string().min(2),
        adminName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const out = await postJson(`/auth/register`, input);

      const token =
        out?.data?.token || out?.token || out?.accessToken || out?.data?.accessToken;

      if (token) {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(NEXO_TOKEN_COOKIE, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
          ...cookieOptions,
        });
      }

      return out;
    }),
});
