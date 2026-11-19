import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({ nexoFetch: vi.fn() }));
import { nexoFetch } from "../_core/nexoClient";
import { serviceOrdersRouter } from "./service-orders";
const fetch = vi.mocked(nexoFetch),
  id = "11111111-1111-4111-8111-111111111111",
  child = "22222222-2222-4222-8222-222222222222";
const caller = (authenticated = true) =>
  serviceOrdersRouter.createCaller({
    user: authenticated
      ? { validated: true, token: "test", role: "MANAGER" }
      : null,
    req: { headers: {} },
    res: {},
  } as any);
const record = {
  id,
  kind: "WARRANTY",
  title: "Retorno",
  reason: "Motivo do retorno registrado.",
  originalTitle: "Original",
  sourceAcceptanceId: null,
  createdByName: "Equipe",
  createdAt: "2026-11-19T12:00:00Z",
  caseState: "CLOSED",
  caseVersion: 1,
  caseReason: "Atendimento revisado e acompanhamento encerrado.",
  caseReviewedByName: "Gestora",
  caseReviewedAt: "2026-11-19T12:00:00Z",
  coverageVersion: 1,
  coverageReason: "Garantia aprovada por avaliação.",
  coverageReviewedByName: "Gestor",
  coverageReviewedAt: "2026-11-19T12:00:00Z",
  original: { id, title: "Original", status: "DONE" },
  child: {
    id: child,
    title: "Retorno",
    status: "DONE",
    billingTreatment: "RETURN_COVERED",
  },
};
beforeEach(() => fetch.mockReset());
describe("return case state BFF", () => {
  it("forwards versioned decisions to the scoped endpoint", async () => {
    fetch.mockResolvedValue(record);
    const input = {
      serviceOrderId: id,
      id,
      state: "CLOSED" as const,
      reason: record.coverageReason,
      expectedVersion: 0,
    };
    const result = await caller().setReturnCaseState(input);
    expect(result.caseState).toBe("CLOSED");
    expect(result.caseVersion).toBe(1);
    expect(fetch.mock.calls[0][1]).toBe(
      `/service-orders/${id}/returns/${id}/state`
    );
    expect(JSON.parse(fetch.mock.calls[0][2]!.body as string)).toEqual({
      state: "CLOSED",
      reason: record.coverageReason,
      expectedVersion: 0,
    });
  });
  it("rejects forged fields, invalid versions and missing session", async () => {
    const body = {
      serviceOrderId: id,
      id,
      state: "CLOSED" as const,
      reason: record.coverageReason,
      expectedVersion: 0,
    };
    for (const change of [
      { orgId: id },
      { reviewedByUserId: id },
      { expectedVersion: "0" },
      { state: "DONE" },
      { reason: "   " },
    ])
      await expect(
        caller().setReturnCaseState({ ...body, ...change } as any)
      ).rejects.toThrow();
    await expect(caller(false).setReturnCaseState(body)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
