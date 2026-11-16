import { beforeEach, describe, expect, it, vi } from "vitest";
import { serviceOrdersRouter } from "./routers/service-orders";
import { authedPost, authedPatch } from "./_core/nexoTransport";
vi.mock("./_core/nexoTransport", () => ({ authedGet: vi.fn(), authedPost: vi.fn(), authedPatch: vi.fn() }));
const id = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const scheduledFor = "2026-11-10T12:30:00.000Z";
const dueDate = "2026-11-11T18:00:00.000Z";
const order = {
  id, customerId, appointmentId: null, assignedToPersonId: null, title: "Instalação", description: null,
  status: "OPEN", priority: 2, scheduledFor, dueDate, startedAt: null, finishedAt: null, amountCents: 10000,
  cancellationReason: null, outcomeSummary: null, createdAt: scheduledFor, updatedAt: scheduledFor,
  customer: { id: customerId, name: "Ana", phone: null }, assignedTo: null,
};
const caller = () => serviceOrdersRouter.createCaller({ req: { headers: {} }, user: { token: "trusted", validated: true, role: "ADMIN" } } as any);

describe("service-order UTC datetime inputs", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(authedPost).mockResolvedValue(order); vi.mocked(authedPatch).mockResolvedValue(order); });
  it("forwards explicit UTC instants when creating an order", async () => {
    await caller().create({ customerId, title: "Instalação", scheduledFor, dueDate });
    expect(authedPost).toHaveBeenCalledWith(expect.anything(), "/service-orders", expect.objectContaining({ scheduledFor, dueDate }));
  });
  it("preserves exact UTC instants when editing an order", async () => {
    await caller().update({ id, title: "Instalação", scheduledFor, dueDate });
    expect(authedPatch).toHaveBeenCalledWith(expect.anything(), `/service-orders/${id}`, expect.objectContaining({ scheduledFor, dueDate }));
  });
  it.each(["create", "update"] as const)("rejects ambiguous local timestamps in %s instead of guessing the server timezone", async method => {
    const input = method === "create" ? { customerId, title: "Instalação", scheduledFor: "2026-11-10T09:30" } : { id, scheduledFor: "2026-11-10T09:30" };
    await expect((caller()[method] as any)(input)).rejects.toThrow();
    expect(authedPost).not.toHaveBeenCalled();
    expect(authedPatch).not.toHaveBeenCalled();
  });
});
