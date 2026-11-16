import { afterEach, describe, expect, it, vi } from "vitest";
import { expensesRouter } from "./routers/expenses";

const context = {
  req: { headers: { cookie: "nexo_token=trusted" }, cookies: { nexo_token: "trusted" } },
  res: { cookie: vi.fn(), clearCookie: vi.fn() },
  user: { token: "trusted", validated: true },
} as any;
const date = "2026-11-10T12:00:00.000Z";
const canonical = "2026-11-11T12:00:00.000Z";

afterEach(() => vi.restoreAllMocks());

describe("expense updates send only canonical API fields", () => {
  it.each([
    { input: { id: "expense", date }, expected: { occurredAt: date } },
    { input: { id: "expense", occurredAt: canonical }, expected: { occurredAt: canonical } },
    { input: { id: "expense", date, occurredAt: canonical, amount: 12.5 }, expected: { occurredAt: canonical, amountCents: 1250 } },
    { input: { id: "expense", notes: "" }, expected: { notes: "" } },
  ])("normalizes a legacy update: $input", async ({ input, expected }) => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "expense" }), { status: 200 }));
    await expensesRouter.createCaller(context).update(input);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toContain("/expenses/expense");
    expect(fetch.mock.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual(expected);
  });
  it("keeps the canonical updateExpense procedure compatible", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "expense" }), { status: 200 }));
    await expensesRouter.createCaller(context).updateExpense({ id: "expense", occurredAt: canonical, amount: 12.5, dueDay: 10 });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ occurredAt: canonical, amountCents: 1250, dueDay: 10 });
  });
});
