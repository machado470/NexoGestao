import { beforeEach, describe, expect, it, vi } from "vitest";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";

function makeReq(token = "token-1") {
  return {
    headers: { cookie: `nexo_token=${token}` },
    cookies: { nexo_token: token },
  } as any;
}

function makeRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;
}

describe("BFF validated session", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("login/session bootstrap válido mantém usuário validado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "u1", email: "admin@nexo.local", role: "ADMIN", organizationId: "org1" } }), { status: 200 }),
    );

    const ctx = await createContext({ req: makeReq(), res: makeRes() } as any);

    expect(ctx.user).toEqual(expect.objectContaining({
      token: "token-1",
      validated: true,
      id: "u1",
      organizationId: "org1",
    }));
    await expect(appRouter.createCaller(ctx).session.me()).resolves.toEqual(ctx.user);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("/me com 401 não cria sessão token-only", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "unauthorized" }), { status: 401 }),
    );

    const ctx = await createContext({ req: makeReq(), res: makeRes() } as any);

    expect(ctx.user).toBeNull();
  });

  it("/me indisponível não marca authenticated", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("fetch failed"), { code: "ECONNREFUSED" }));

    const ctx = await createContext({ req: makeReq(), res: makeRes() } as any);

    expect(ctx.user).toBeNull();
    expect(ctx.bootstrapError?.code).toBe("SERVICE_UNAVAILABLE");
    await expect(appRouter.createCaller(ctx).auth.me()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("/me com 429 preserva limitação sem fingir sessão inválida", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }));
    const ctx = await createContext({ req: makeReq("limited-token"), res: makeRes() } as any);
    expect(ctx.user).toBeNull();
    await expect(appRouter.createCaller(ctx).auth.me()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(appRouter.createCaller(ctx).session.me()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("protectedProcedure bloqueia token presente sem sessão validada", async () => {
    const caller = appRouter.createCaller({
      req: makeReq(),
      res: makeRes(),
      user: null,
    } as any);

    await expect(caller.nexo.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("logout limpa cookies de sessão", async () => {
    const res = makeRes();
    const caller = appRouter.createCaller({
      req: makeReq(),
      res,
      user: null,
    } as any);

    await expect(caller.session.logout()).resolves.toEqual({ success: true });
    expect(res.clearCookie).toHaveBeenCalledWith("nexo_token", expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith("token", expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith("auth_token", expect.any(Object));
  });

  it("establishSession retorna falha explícita e remove cookie quando /me falha", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "backend unavailable" }), { status: 503 }),
    );
    const res = makeRes();
    const caller = appRouter.createCaller({
      req: makeReq(),
      res,
      user: null,
    } as any);

    await expect(caller.nexo.auth.establishSession({ token: "token-1" })).resolves.toEqual({
      success: false,
      validated: false,
      validationStatus: "failed",
      me: null,
    });
    expect(res.clearCookie).toHaveBeenCalledWith("nexo_token", expect.any(Object));
  });
});
