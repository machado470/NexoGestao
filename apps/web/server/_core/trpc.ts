import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import cookie from "cookie";
import type { TrpcContext } from "./context";
import { isAdminRole } from "./roles";
import { upstreamErrorDetails } from "./nexoClient";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Only sanitized fields reach the browser: a stable upstream code and the wait in seconds.
  // tRPC adds stack traces whenever NODE_ENV was not "production" at boot (e.g. staging):
  // they are kept for local development only.
  errorFormatter({ shape, error }) {
    const { stack: _stack, ...data } = shape.data;
    const exposeStack = (process.env.NODE_ENV ?? "").toLowerCase() === "development";
    return { ...shape, data: { ...(exposeStack ? shape.data : data), ...upstreamErrorDetails(error) } };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

function readTokenFromCtx(ctx: TrpcContext): string | null {
  if (typeof ctx.user?.token === "string" && ctx.user.token.trim()) {
    return ctx.user.token.trim();
  }

  const authHeader = ctx.req?.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.trim()) {
    const normalized = authHeader.trim();
    if (normalized.toLowerCase().startsWith("bearer ")) {
      const bearerToken = normalized.slice(7).trim();
      if (bearerToken) return bearerToken;
    }
    return normalized;
  }

  const directCookie = ctx.req?.cookies?.nexo_token;
  if (typeof directCookie === "string" && directCookie.trim()) {
    return directCookie.trim();
  }

  const rawCookie = ctx.req?.headers?.cookie;
  if (typeof rawCookie !== "string" || !rawCookie.trim()) return null;

  const parsed = cookie.parse(rawCookie);
  const cookieToken = parsed?.nexo_token;
  return typeof cookieToken === "string" && cookieToken.trim()
    ? cookieToken.trim()
    : null;
}

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const token = readTokenFromCtx(ctx);

  if (!token || ctx.user?.validated !== true) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const token = readTokenFromCtx(ctx);

    if (!token || ctx.user?.validated !== true) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (!isAdminRole(ctx.user?.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
