import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryObserver, onlineManager } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IpDiagnosticStateView, IpDiagnosticStatus } from "./IpDiagnosticPage";
import {
  DIAGNOSTIC_STATUS_TEXT,
  diagnosticErrorKind,
  resolveDiagnosticQueryState,
  type DiagnosticQuerySnapshot,
  type IpDiagnosticPayload,
} from "./IpDiagnostic.logic";

// Regression: on iPhones the panel could show neither a result nor an error. The result area sat
// below the fold with no feedback on "Verificar novamente", and a query paused by React Query
// (browser reported offline) rendered nothing at all. Every state must now be visible and explained.

const AT = Date.UTC(2026, 10, 22, 13, 45, 7);
const snap = (partial: Partial<DiagnosticQuerySnapshot>): DiagnosticQuerySnapshot => ({
  status: "pending",
  fetchStatus: "idle",
  dataUpdatedAt: 0,
  errorUpdatedAt: 0,
  ...partial,
});
const trpcError = (data: unknown) => Object.assign(new Error("x"), { name: "TRPCClientError", data });
const PAYLOAD: IpDiagnosticPayload = { self: { addresses: "masked", classification: "unverified", forwardedFor: { present: false, hops: 0, chain: [] }, realIp: { present: false } } };

describe("diagnostic query state", () => {
  it.each<[string, Partial<DiagnosticQuerySnapshot>, string, boolean, string]>([
    ["first load", { status: "pending", fetchStatus: "fetching" }, "loading", true, "Verificando..."],
    ["first load paused (browser offline)", { status: "pending", fetchStatus: "paused" }, "paused", false, DIAGNOSTIC_STATUS_TEXT.paused],
    ["nothing requested yet", { status: "pending", fetchStatus: "idle" }, "idle", false, DIAGNOSTIC_STATUS_TEXT.idle],
    ["success", { status: "success", dataUpdatedAt: AT }, "success", false, "Última verificação concluída às 13:45:07: Diagnóstico autorizado."],
    ["new check over previous results", { status: "success", fetchStatus: "fetching", dataUpdatedAt: AT }, "success", true, "Verificando..."],
    ["new check paused over previous results", { status: "success", fetchStatus: "paused", dataUpdatedAt: AT }, "success", false, DIAGNOSTIC_STATUS_TEXT.paused],
    ["403", { status: "error", errorUpdatedAt: AT, error: trpcError({ code: "FORBIDDEN", httpStatus: 403 }) }, "error", false, "Última verificação concluída às 13:45:07: Acesso negado."],
    ["new check over an error", { status: "error", fetchStatus: "fetching", errorUpdatedAt: AT, error: trpcError({ code: "FORBIDDEN" }) }, "error", true, "Verificando..."],
  ])("%s", (_label, partial, phase, checking, statusText) => {
    const state = resolveDiagnosticQueryState(snap(partial), "UTC");
    expect(state).toMatchObject({ phase, checking, statusText });
    expect(state.statusText.trim()).not.toBe("");
  });

  it("the last check reports the most recent outcome", () => {
    const failedAfterSuccess = resolveDiagnosticQueryState(snap({ status: "error", dataUpdatedAt: AT, errorUpdatedAt: AT + 5000, error: trpcError({ httpStatus: 429 }) }), "UTC");
    expect(failedAfterSuccess.lastCheck).toEqual({ at: AT + 5000, outcome: "error" });
    expect(failedAfterSuccess.statusText).toBe("Última verificação concluída às 13:45:12: Muitas consultas seguidas.");
    const recovered = resolveDiagnosticQueryState(snap({ status: "success", dataUpdatedAt: AT + 9000, errorUpdatedAt: AT }), "UTC");
    expect(recovered.lastCheck).toEqual({ at: AT + 9000, outcome: "success" });
  });

  it.each([
    [trpcError({ code: "UNAUTHORIZED", httpStatus: 401 }), "unauthorized"],
    [trpcError({ code: "FORBIDDEN", httpStatus: 403 }), "forbidden"],
    [trpcError({ code: "TOO_MANY_REQUESTS", httpStatus: 429 }), "rate_limited"],
    [trpcError({ code: "SERVICE_UNAVAILABLE", httpStatus: 503 }), "unavailable"],
    [trpcError({ code: "INTERNAL_SERVER_ERROR", httpStatus: 500 }), "error"],
    // No tRPC data: no valid response arrived. Reported as such, never as "you are offline".
    [trpcError(undefined), "no_response"],
    [new Error("plain"), "error"],
  ])("error %# → %s", (error, kind) => {
    expect(diagnosticErrorKind(error)).toBe(kind);
  });
});

describe("diagnostic screen never renders an empty result area", () => {
  const render = (partial: Partial<DiagnosticQuerySnapshot>, data?: unknown) => {
    const state = resolveDiagnosticQueryState(snap(partial), "UTC");
    return {
      status: renderToStaticMarkup(<IpDiagnosticStatus state={state} />),
      area: renderToStaticMarkup(<IpDiagnosticStateView state={state} error={partial.error} data={data} onRetry={() => undefined} />),
    };
  };

  it.each<[string, Partial<DiagnosticQuerySnapshot>, unknown, string]>([
    ["loading", { status: "pending", fetchStatus: "fetching" }, undefined, "Consultando diagnóstico"],
    ["paused", { status: "pending", fetchStatus: "paused" }, undefined, "Verificação em espera"],
    ["idle", { status: "pending", fetchStatus: "idle" }, undefined, "Nenhum resultado ainda"],
    ["401", { status: "error", errorUpdatedAt: AT, error: trpcError({ httpStatus: 401 }) }, undefined, "Sessão expirada"],
    ["403", { status: "error", errorUpdatedAt: AT, error: trpcError({ httpStatus: 403 }) }, undefined, "Acesso negado"],
    ["429", { status: "error", errorUpdatedAt: AT, error: trpcError({ httpStatus: 429 }) }, undefined, "Muitas consultas seguidas"],
    ["503", { status: "error", errorUpdatedAt: AT, error: trpcError({ httpStatus: 503 }) }, undefined, "Serviço temporariamente indisponível"],
    ["no response", { status: "error", errorUpdatedAt: AT, error: trpcError(undefined) }, undefined, "Sem resposta do servidor"],
    ["success", { status: "success", dataUpdatedAt: AT }, PAYLOAD, "Diagnóstico autorizado"],
    ["success without data (defensive)", { status: "success", dataUpdatedAt: AT }, undefined, "Nenhum resultado ainda"],
    ["new check keeps previous results visible", { status: "success", fetchStatus: "fetching", dataUpdatedAt: AT }, PAYLOAD, "Diagnóstico autorizado"],
  ])("%s", (_label, partial, data, expected) => {
    const { status, area } = render(partial, data);
    expect(area).toContain(expected);
    expect(status).toMatch(/role="status"/);
    expect(status).toMatch(/aria-live="polite"/);
  });

  it("shows Verificando... with a spinner during a new check", () => {
    const { status } = render({ status: "success", fetchStatus: "fetching", dataUpdatedAt: AT }, PAYLOAD);
    expect(status).toContain("Verificando...");
    expect(status).toContain("animate-spin");
  });
});

describe("networkMode for the diagnostic query (React Query behaviour)", () => {
  afterEach(() => onlineManager.setOnline(true));

  async function observe(networkMode: "online" | "always", queryFn: () => Promise<unknown>) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new QueryObserver(client, { queryKey: ["diag", networkMode], queryFn, networkMode });
    const unsubscribe = observer.subscribe(() => undefined);
    await new Promise((r) => setTimeout(r, 20));
    return { observer, unsubscribe, client };
  }

  it("default 'online' mode pauses silently when the browser reports offline (the old blank screen)", async () => {
    onlineManager.setOnline(false);
    const queryFn = vi.fn(async () => PAYLOAD);
    const { observer, unsubscribe } = await observe("online", queryFn);
    expect(queryFn).not.toHaveBeenCalled();
    expect(observer.getCurrentResult()).toMatchObject({ status: "pending", fetchStatus: "paused", isLoading: false, isError: false });
    unsubscribe();
  });

  it("'always' sends the request even when the browser claims to be offline", async () => {
    onlineManager.setOnline(false);
    const queryFn = vi.fn(async () => PAYLOAD);
    const { observer, unsubscribe } = await observe("always", queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult()).toMatchObject({ status: "success", fetchStatus: "idle" });
    unsubscribe();
  });

  it("'always' turns a real transport failure into a visible error, not a pause", async () => {
    onlineManager.setOnline(false);
    const { observer, unsubscribe } = await observe("always", async () => {
      throw trpcError(undefined);
    });
    const result = observer.getCurrentResult();
    expect(result).toMatchObject({ status: "error", fetchStatus: "idle" });
    expect(diagnosticErrorKind(result.error)).toBe("no_response");
    unsubscribe();
  });

  it("a new check sends a new request and keeps the previous result while it runs", async () => {
    let release!: () => void;
    const queryFn = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(PAYLOAD)
      .mockImplementationOnce(() => new Promise((r) => { release = () => r(PAYLOAD); }));
    const { observer, unsubscribe } = await observe("always", queryFn);
    const pending = observer.refetch();
    await new Promise((r) => setTimeout(r, 5));
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult()).toMatchObject({ status: "success", fetchStatus: "fetching", data: PAYLOAD });
    release();
    await pending;
    expect(observer.getCurrentResult().fetchStatus).toBe("idle");
    unsubscribe();
  });
});

describe("page wiring", () => {
  const page = readFileSync(resolve(__dirname, "IpDiagnosticPage.tsx"), "utf8");

  it("uses networkMode 'always' only for this query", () => {
    expect(page.match(/networkMode: "always"/g)).toHaveLength(1);
  });

  it("renders the status and the result right below the header, before the disclaimer", () => {
    const body = page.slice(page.indexOf("export default function IpDiagnosticPage"));
    const header = body.indexOf("<AppOperationalHeader");
    const status = body.indexOf("<IpDiagnosticStatus");
    const area = body.indexOf("<IpDiagnosticStateView");
    const disclaimer = body.indexOf("<IpDiagnosticDisclaimer");
    expect(header).toBeGreaterThan(-1);
    expect(header).toBeLessThan(status);
    expect(status).toBeLessThan(area);
    expect(area).toBeLessThan(disclaimer);
  });

  it("a manual check keeps the status line on screen without moving a visible page", () => {
    const recheck = page.slice(page.indexOf("const showStatus"), page.indexOf("const state = resolveDiagnosticQueryState"));
    expect(recheck).toContain('scrollIntoView({ block: "nearest" })');
    expect(recheck).toContain("query.refetch().finally(showStatus)");
  });

  it("the button shows Verificando... while a request is in flight", () => {
    expect(page).toContain('{state.checking ? DIAGNOSTIC_STATUS_TEXT.checking : "Verificar novamente"}');
    expect(page).toContain("aria-busy={state.checking}");
  });
});
