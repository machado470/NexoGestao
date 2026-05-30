import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsPageSource = readFileSync(new URL("./SettingsPage.tsx", import.meta.url), "utf8");

describe("SettingsPage organization settings contract", () => {
  it("envia name e timezone no payload canônico", () => {
    expect(settingsPageSource).toContain("updateMutation.mutate({ name, timezone })");
  });

  it("carrega name após reload sem fallback ambíguo para organizationName", () => {
    expect(settingsPageSource).toContain('setName(String(settings.name ?? ""))');
    expect(settingsPageSource).not.toContain("organizationName");
  });
});
