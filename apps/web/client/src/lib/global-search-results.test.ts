import { describe, expect, it } from "vitest";
import { normalizeGlobalSearchResults } from "./global-search-results";
describe("global search response contract", () => {
  it("reads the grouped BFF contract and paginated API collections", () => {
    const response = {
      ok: true,
      data: {
        query: "ana",
        customers: { data: [{ id: "c1", name: "Ana", phone: "11999" }] },
        serviceOrders: {
          data: { items: [{ id: "o1", title: "Visita Ana", number: "OS-1" }] },
        },
      },
    };
    const parsed = normalizeGlobalSearchResults(response, "STAFF");
    expect(parsed.valid).toBe(true);
    expect(parsed.results.map(x => x.route)).toEqual([
      "/customers?customerId=c1",
      "/service-orders?id=o1",
    ]);
    expect(parsed.results[0].title).toBe("Ana");
  });
  it("distinguishes a valid empty response from an invalid contract", () => {
    expect(
      normalizeGlobalSearchResults(
        { ok: true, data: { customers: [], serviceOrders: [] } },
        "ADMIN"
      )
    ).toEqual({ valid: true, results: [] });
    for (const value of [
      undefined,
      null,
      {},
      { ok: true, data: {} },
      { data: { customers: { wrong: [] }, serviceOrders: [] } },
    ]) {
      expect(normalizeGlobalSearchResults(value, "ADMIN").valid).toBe(false);
    }
  });
  it.each(["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const)(
    "keeps customer/order reads for %s",
    role => {
      expect(
        normalizeGlobalSearchResults(
          [
            { id: "c1", type: "customer", title: "Ana" },
            { id: "o1", type: "serviceOrder", title: "Visita" },
          ],
          role
        ).results
      ).toHaveLength(2);
    }
  );
  it.each(["STAFF", "VIEWER"] as const)(
    "does not offer financial results to %s",
    role => {
      expect(
        normalizeGlobalSearchResults(
          [
            {
              id: "f1",
              type: "charge",
              title: "Cobrança",
              route: "/customers",
            },
          ],
          role
        ).results
      ).toEqual([]);
    }
  );
  it("keeps finance for authorized roles and rejects missing roles", () => {
    const rows = [{ id: "f1", type: "charge", title: "Cobrança" }];
    expect(normalizeGlobalSearchResults(rows, "MANAGER").results[0].route).toBe(
      "/finances?chargeId=f1"
    );
    expect(normalizeGlobalSearchResults(rows, null).results).toEqual([]);
  });
  it("rebuilds routes from type and encoded identifier", () => {
    const parsed = normalizeGlobalSearchResults(
      [
        {
          id: "c&action=delete",
          type: "customer",
          title: "Nome",
          route: "https://external.invalid",
        },
        { id: "u", type: "unknown", title: "Unknown" },
      ],
      "ADMIN"
    );
    expect(parsed.results).toHaveLength(1);
    const url = new URL(parsed.results[0].route, "https://local.test");
    expect(url.searchParams.get("customerId")).toBe("c&action=delete");
    expect(url.searchParams.has("action")).toBe(false);
  });
});
