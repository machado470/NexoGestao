import { describe, expect, it } from "vitest";
import {
  formatPlanQuota,
  formatPlanPeriod,
  normalizeBillingPlanCatalog,
  listEnabledPlanFeatures,
} from "./billing-plan-catalog";

describe("billing canonical plan catalog", () => {
  it("normaliza e ordena somente planos comerciais conhecidos", () => {
    expect(
      normalizeBillingPlanCatalog([
        {
          name: "PRO",
          displayName: "Pro",
          priceCents: 19900,
          quotas: { users: 10 },
          commercialLimits: {},
          features: { advanced_automation: true },
        },
        {
          name: "STARTER",
          displayName: "Basic",
          priceCents: 9900,
          quotas: { users: 5 },
          commercialLimits: {},
          features: {},
        },
        {
          name: "LEGACY",
          displayName: "Legacy",
          priceCents: 1,
        },
      ]).map(plan => plan.name)
    ).toEqual(["STARTER", "PRO"]);
  });

  it("representa limites ilimitados sem inventar valor comercial", () => {
    expect(formatPlanQuota(999999)).toBe("Ilimitado");
    expect(formatPlanQuota(30)).toBe("30");
    expect(formatPlanQuota(undefined)).toBe("Não informado");
  });

  it("humaniza apenas features habilitadas", () => {
    expect(
      listEnabledPlanFeatures({
        advanced_automation: true,
        priority_support: false,
      })
    ).toEqual(["Automação avançada"]);
  });
  it.each([["month", "Mensal"], ["year", "Anual"], [null, "Sem cobrança recorrente"], [undefined, "Periodicidade não informada pelo catálogo"]] as const)("formats the authoritative interval %s", (interval, label) => {
    expect(formatPlanPeriod(interval)).toBe(label);
  });
  it.each(["month", "year", null] as const)("preserves interval %s through catalog normalization", interval => {
    expect(normalizeBillingPlanCatalog([{ name: "PRO", priceCents: 19900, billingInterval: interval }])[0].billingInterval).toBe(interval);
  });
  it("does not invent an interval for an older or unknown API contract", () => {
    for (const item of [{}, { billingInterval: "week" }]) {
      const plan = normalizeBillingPlanCatalog([{ name: "PRO", priceCents: 19900, ...item }])[0];
      expect(plan.billingInterval).toBeUndefined();
      expect(formatPlanPeriod(plan.billingInterval)).toBe("Periodicidade não informada pelo catálogo");
    }
  });

});
