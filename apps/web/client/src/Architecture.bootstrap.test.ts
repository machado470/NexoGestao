import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Front bootstrap architecture guardrails", () => {
  const mainSource = readFileSync("client/src/main.tsx", "utf8");
  const appSource = readFileSync("client/src/App.tsx", "utf8");
  const authSource = readFileSync("client/src/contexts/AuthContext.tsx", "utf8");

  it("mantém árvore canônica QueryClientProvider -> TRPCProvider -> ErrorBoundary -> App", () => {
    expect(mainSource.includes("createRoot(root).render(") || mainSource.includes("createRoot(root);")).toBe(true);
    expect(mainSource).toContain("<QueryClientProvider client={queryClient}>");
    expect(mainSource).toContain("<TRPCProvider client={trpcClient} queryClient={queryClient}>");
    expect(mainSource).toContain("<ErrorBoundary routeContext=\"root\">");
    expect(mainSource).toContain("<App />");
  });

  it("evita createRoot paralelo fora do bootstrap principal", () => {
    const createRootInMain = (mainSource.match(/createRoot\(/g) ?? []).length;
    const createRootInApp = (appSource.match(/createRoot\(/g) ?? []).length;

    expect(createRootInMain).toBe(1);
    expect(createRootInApp).toBe(0);
  });

  it("mantém AuthProvider apenas no App e não no main", () => {
    expect(mainSource.includes("<AuthProvider>")).toBe(false);
    expect(appSource.includes("<AuthProvider>")).toBe(true);
  });

  it("AuthProvider sempre mantém children no Provider (sem return vazio)", () => {
    expect(authSource).toContain("return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;");
  });
});
